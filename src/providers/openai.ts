import type {
  AIProvider,
  Effort,
  EvalResult,
  EvalType,
  EvaluateOptions,
} from './base';
import { JSON_SYSTEM_PROMPT, buildUserPrompt } from '../prompts';
import { AIProviderError } from '../errors';

// Typed without importing the SDK statically so consumers who don't use OpenAI
// don't need the package installed. Actual client is loaded dynamically.
type OpenAIClient = {
  chat: {
    completions: {
      create: (params: Record<string, unknown>) => Promise<{
        choices: Array<{
          message: { content: string | null };
          finish_reason: string;
        }>;
        usage?: {
          prompt_tokens: number;
          completion_tokens: number;
        };
      }>;
    };
  };
};

const DEFAULT_EFFORT: Effort = 'medium';
const MAX_OUTPUT_TOKENS = 4096;

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pass: {
      type: 'boolean',
      description:
        "True if the response satisfies the evaluation type's positive condition per the rubric.",
    },
    reason: {
      type: 'string',
      description:
        'A single sentence under ~200 chars naming the specific evidence that drove the verdict.',
    },
  },
  required: ['pass', 'reason'],
} as const;

export interface OpenAIProviderOptions {
  apiKey?: string;
  model?: string;
  defaultEffort?: Effort;
  client?: OpenAIClient;
  effortModelMap?: Partial<Record<Effort, string>>;
}

const DEFAULT_EFFORT_MODEL_MAP: Record<Effort, string> = {
  low: 'gpt-4o-mini',
  medium: 'gpt-4o',
  high: 'o3-mini',
  xhigh: 'o3',
};

const REASONING_EFFORT_MAP: Record<Effort, 'low' | 'medium' | 'high'> = {
  low: 'low',
  medium: 'medium',
  high: 'medium',
  xhigh: 'high',
};

export class OpenAIProvider implements AIProvider {
  private readonly apiKey: string | undefined;
  private readonly explicitClient: OpenAIClient | undefined;
  private readonly overrideModel: string | undefined;
  private readonly defaultEffort: Effort;
  private readonly effortModelMap: Record<Effort, string>;
  private clientPromise: Promise<OpenAIClient> | undefined;

  constructor(options: OpenAIProviderOptions = {}) {
    this.explicitClient = options.client;
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    this.overrideModel = options.model;
    this.defaultEffort = options.defaultEffort ?? DEFAULT_EFFORT;
    this.effortModelMap = {
      ...DEFAULT_EFFORT_MODEL_MAP,
      ...(options.effortModelMap ?? {}),
    };

    if (!this.explicitClient && !this.apiKey) {
      throw new AIProviderError(
        'playwright-ai-matchers: OPENAI_API_KEY is not set and no apiKey was passed to OpenAIProvider.',
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
    const isReasoning = isReasoningModel(model);
    const client = await this.resolveClient();
    const userPrompt = buildUserPrompt({ text, criteria, type });

    const params: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: JSON_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'evaluation',
          strict: true,
          schema: RESPONSE_SCHEMA,
        },
      },
    };

    if (isReasoning) {
      params.max_completion_tokens = MAX_OUTPUT_TOKENS;
      params.reasoning_effort = REASONING_EFFORT_MAP[effort];
    } else {
      params.max_tokens = MAX_OUTPUT_TOKENS;
    }

    let completion;
    try {
      completion = await client.chat.completions.create(params);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new AIProviderError(
        `OpenAI API error: ${message}`,
        model,
        err,
      );
    }

    const choice = completion.choices[0];
    if (!choice || !choice.message || typeof choice.message.content !== 'string') {
      throw new AIProviderError(
        `OpenAI returned no message content. finish_reason=${choice?.finish_reason ?? 'unknown'}`,
        model,
        completion,
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(choice.message.content) as Record<string, unknown>;
    } catch (err) {
      throw new AIProviderError(
        `OpenAI returned content that is not valid JSON: ${choice.message.content.slice(0, 200)}`,
        model,
        err,
      );
    }

    if (typeof parsed.pass !== 'boolean' || typeof parsed.reason !== 'string') {
      throw new AIProviderError(
        `OpenAI verdict has invalid shape: ${JSON.stringify(parsed)}`,
        model,
        parsed,
      );
    }

    return {
      pass: parsed.pass,
      reason: parsed.reason,
      model,
      effort,
      usage: completion.usage
        ? {
            inputTokens: completion.usage.prompt_tokens,
            outputTokens: completion.usage.completion_tokens,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
          }
        : undefined,
    };
  }

  private async resolveClient(): Promise<OpenAIClient> {
    if (this.explicitClient) return this.explicitClient;
    if (!this.clientPromise) {
      this.clientPromise = loadOpenAIClient(this.apiKey!);
    }
    return this.clientPromise;
  }
}

async function loadOpenAIClient(apiKey: string): Promise<OpenAIClient> {
  let mod: { default: new (opts: { apiKey: string }) => unknown };
  try {
    mod = (await import('openai')) as unknown as typeof mod;
  } catch (err) {
    throw new AIProviderError(
      "playwright-ai-matchers: the 'openai' package is required to use OpenAIProvider. Install it with `npm install openai`.",
      undefined,
      err,
    );
  }
  const Ctor = mod.default;
  return new Ctor({ apiKey }) as OpenAIClient;
}

function isReasoningModel(model: string): boolean {
  return /^o\d/i.test(model);
}
