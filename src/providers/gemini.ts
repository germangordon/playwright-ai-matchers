import type {
  AIProvider,
  Effort,
  EvalResult,
  EvalType,
  EvaluateOptions,
} from './base';
import { JSON_SYSTEM_PROMPT, buildUserPrompt } from '../prompts';
import { AIProviderError } from '../errors';

// Minimal structural types — the real SDK is loaded dynamically so users who
// don't use Gemini are not forced to install @google/generative-ai.
type GeminiUsageMetadata = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

type GeminiGenerateResult = {
  response: {
    text: () => string;
    usageMetadata?: GeminiUsageMetadata;
  };
};

type GeminiModelInstance = {
  generateContent: (request: {
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  }) => Promise<GeminiGenerateResult>;
};

type GeminiClient = {
  getGenerativeModel: (params: {
    model: string;
    systemInstruction?: string;
    generationConfig?: Record<string, unknown>;
  }) => GeminiModelInstance;
};

const DEFAULT_EFFORT: Effort = 'medium';
const MAX_OUTPUT_TOKENS = 4096;

// SchemaType values from @google/generative-ai — hard-coded to avoid a
// value-level runtime import (which would force the package to load eagerly).
const SCHEMA_STRING = 'string';
const SCHEMA_BOOLEAN = 'boolean';
const SCHEMA_OBJECT = 'object';

const RESPONSE_SCHEMA = {
  type: SCHEMA_OBJECT,
  properties: {
    pass: {
      type: SCHEMA_BOOLEAN,
      description:
        "True if the response satisfies the evaluation type's positive condition per the rubric.",
    },
    reason: {
      type: SCHEMA_STRING,
      description:
        'A single sentence under ~200 chars naming the specific evidence that drove the verdict.',
    },
  },
  required: ['pass', 'reason'],
} as const;

export interface GeminiProviderOptions {
  apiKey?: string;
  model?: string;
  defaultEffort?: Effort;
  client?: GeminiClient;
  effortModelMap?: Partial<Record<Effort, string>>;
}

const DEFAULT_EFFORT_MODEL_MAP: Record<Effort, string> = {
  low: 'gemini-2.5-flash-lite',
  medium: 'gemini-2.5-flash',
  high: 'gemini-2.5-pro',
  xhigh: 'gemini-2.5-pro',
};

export class GeminiProvider implements AIProvider {
  private readonly apiKey: string | undefined;
  private readonly explicitClient: GeminiClient | undefined;
  private readonly overrideModel: string | undefined;
  private readonly defaultEffort: Effort;
  private readonly effortModelMap: Record<Effort, string>;
  private clientPromise: Promise<GeminiClient> | undefined;

  constructor(options: GeminiProviderOptions = {}) {
    this.explicitClient = options.client;
    this.apiKey =
      options.apiKey ??
      process.env.GOOGLE_API_KEY ??
      process.env.GEMINI_API_KEY;
    this.overrideModel = options.model;
    this.defaultEffort = options.defaultEffort ?? DEFAULT_EFFORT;
    this.effortModelMap = {
      ...DEFAULT_EFFORT_MODEL_MAP,
      ...(options.effortModelMap ?? {}),
    };

    if (!this.explicitClient && !this.apiKey) {
      throw new AIProviderError(
        'playwright-ai-matchers: GOOGLE_API_KEY (or GEMINI_API_KEY) is not set and no apiKey was passed to GeminiProvider.',
      );
    }
  }

  async evaluate(
    text: string,
    criteria: string,
    type: EvalType,
    options: EvaluateOptions = {},
  ): Promise<EvalResult> {
    const effort = options.effort ?? this.defaultEffort;
    const model = this.overrideModel ?? this.effortModelMap[effort];
    const client = await this.resolveClient();
    const userPrompt = buildUserPrompt({ text, criteria, type });

    // Gemini 2.0 thinking models are preview-only and don't accept
    // responseSchema — fall back to mime-type-only JSON for those.
    const supportsResponseSchema = !/thinking/i.test(model);

    const generationConfig: Record<string, unknown> = {
      responseMimeType: 'application/json',
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0,
    };
    if (supportsResponseSchema) {
      generationConfig.responseSchema = RESPONSE_SCHEMA;
    }

    const modelInstance = client.getGenerativeModel({
      model,
      systemInstruction: JSON_SYSTEM_PROMPT,
      generationConfig,
    });

    let result: GeminiGenerateResult;
    try {
      result = await modelInstance.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new AIProviderError(
        `Gemini API error: ${message}`,
        model,
        err,
      );
    }

    const raw = result.response.text();
    if (!raw || !raw.trim()) {
      throw new AIProviderError(
        'Gemini returned an empty response.',
        model,
        result,
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(extractJson(raw)) as Record<string, unknown>;
    } catch (err) {
      throw new AIProviderError(
        `Gemini returned content that is not valid JSON: ${raw.slice(0, 200)}`,
        model,
        err,
      );
    }

    if (typeof parsed.pass !== 'boolean' || typeof parsed.reason !== 'string') {
      throw new AIProviderError(
        `Gemini verdict has invalid shape: ${JSON.stringify(parsed)}`,
        model,
        parsed,
      );
    }

    const usage = result.response.usageMetadata;
    return {
      pass: parsed.pass,
      reason: parsed.reason,
      model,
      effort,
      usage: usage
        ? {
            inputTokens: usage.promptTokenCount ?? 0,
            outputTokens: usage.candidatesTokenCount ?? 0,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
          }
        : undefined,
    };
  }

  private async resolveClient(): Promise<GeminiClient> {
    if (this.explicitClient) return this.explicitClient;
    if (!this.clientPromise) {
      this.clientPromise = loadGeminiClient(this.apiKey!);
    }
    return this.clientPromise;
  }
}

async function loadGeminiClient(apiKey: string): Promise<GeminiClient> {
  let mod: { GoogleGenerativeAI: new (apiKey: string) => GeminiClient };
  try {
    mod = (await import('@google/generative-ai')) as unknown as typeof mod;
  } catch (err) {
    throw new AIProviderError(
      "playwright-ai-matchers: the '@google/generative-ai' package is required to use GeminiProvider. Install it with `npm install @google/generative-ai`.",
      undefined,
      err,
    );
  }
  return new mod.GoogleGenerativeAI(apiKey);
}

// Gemini occasionally wraps JSON in ```json fences even when responseMimeType
// is application/json (most commonly on preview thinking models). Strip them.
function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1] : trimmed;
}
