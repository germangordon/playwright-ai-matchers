import type {
  AIProvider,
  Effort,
  EvalResult,
  EvalType,
  EvaluateOptions,
} from './base';
import { buildSystemPrompt, buildUserPrompt } from '../prompts';
import { AIProviderError } from '../errors';

// Structural types — the real SDK is loaded dynamically so users who
// don't use Claude are not forced to install @anthropic-ai/sdk.

type AnthropicTool = {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
};

type AnthropicMessage = {
  role: string;
  content: string;
};

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; name: string; input: Record<string, unknown> }
  | { type: 'thinking'; thinking: string };

type AnthropicUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

type AnthropicMessageResult = {
  content: AnthropicContentBlock[];
  stop_reason: string | null;
  usage: AnthropicUsage;
};

type AnthropicMessagesStream = {
  finalMessage: () => Promise<AnthropicMessageResult>;
};

type AnthropicMessages = {
  stream: (params: Record<string, unknown>) => AnthropicMessagesStream;
};

type AnthropicClient = {
  messages: AnthropicMessages;
};

type AnthropicAPIError = Error & { status?: number };

const DEFAULT_MODEL = 'claude-opus-4-7';
const DEFAULT_EFFORT: Effort = 'medium';
const MAX_TOKENS = 8192;

const SUBMIT_EVALUATION_TOOL: AnthropicTool = {
  name: 'submit_evaluation',
  description:
    'Submit the pass/fail verdict for this evaluation. Must be called exactly once.',
  input_schema: {
    type: 'object',
    properties: {
      pass: {
        type: 'boolean',
        description:
          'True if the response satisfies the evaluation type\'s positive condition per the rubric.',
      },
      reason: {
        type: 'string',
        description:
          'A single sentence under ~200 chars naming the specific evidence that drove the verdict.',
      },
    },
    required: ['pass', 'reason'],
  },
};

export interface ClaudeProviderOptions {
  apiKey?: string;
  model?: string;
  defaultEffort?: Effort;
  client?: AnthropicClient;
}

export class ClaudeProvider implements AIProvider {
  readonly id: string;
  private readonly apiKey: string | undefined;
  private readonly explicitClient: AnthropicClient | undefined;
  private readonly overrideModel: string | undefined;
  private readonly defaultEffort: Effort;
  private clientPromise: Promise<AnthropicClient> | undefined;

  constructor(options: ClaudeProviderOptions = {}) {
    this.explicitClient = options.client;
    this.apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    this.overrideModel = options.model;
    this.defaultEffort = options.defaultEffort ?? DEFAULT_EFFORT;
    this.id = `claude:${this.overrideModel ?? DEFAULT_MODEL}`;

    if (!this.explicitClient && !this.apiKey) {
      throw new AIProviderError(
        'playwright-ai-matchers: ANTHROPIC_API_KEY is not set and no apiKey was passed to ClaudeProvider.',
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
    const model = this.overrideModel ?? DEFAULT_MODEL;
    const client = await this.resolveClient();
    const userPrompt = buildUserPrompt({ text, criteria, type });

    const systemPrompt = buildSystemPrompt(type, 'tool');

    const params: Record<string, unknown> = {
      model,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [SUBMIT_EVALUATION_TOOL],
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: userPrompt }],
      output_config: { effort: effortToApi(effort) },
    };

    if (effort !== 'low') {
      params.thinking = { type: 'adaptive', display: 'summarized' };
    } else {
      params.thinking = { type: 'disabled' };
    }

    let finalMessage: AnthropicMessageResult;
    try {
      const stream = client.messages.stream(params);
      finalMessage = await stream.finalMessage();
    } catch (err) {
      const anthropicErr = err as AnthropicAPIError;
      if (isAnthropicAPIError(anthropicErr)) {
        throw new AIProviderError(
          `Claude API error (${anthropicErr.status ?? 'unknown'}): ${anthropicErr.message}`,
          model,
          err,
        );
      }
      throw err;
    }

    const toolUse = finalMessage.content.find(
      (block): block is Extract<typeof block, { type: 'tool_use' }> =>
        block.type === 'tool_use' && block.name === 'submit_evaluation',
    );
    if (!toolUse) {
      throw new AIProviderError(
        `Claude did not call submit_evaluation. stop_reason=${finalMessage.stop_reason}`,
        model,
        finalMessage,
      );
    }

    const input = toolUse.input;
    if (typeof input.pass !== 'boolean' || typeof input.reason !== 'string') {
      throw new AIProviderError(
        `submit_evaluation tool returned an invalid payload: ${JSON.stringify(input)}`,
        model,
        finalMessage,
      );
    }

    const reasoning = finalMessage.content
      .filter((b): b is Extract<typeof b, { type: 'thinking' }> => b.type === 'thinking')
      .map((b) => b.thinking)
      .filter((t) => t && t.trim().length > 0)
      .join('\n\n');

    return {
      pass: input.pass,
      reason: input.reason,
      model,
      effort,
      reasoning: reasoning || undefined,
      usage: {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
        cacheReadTokens: finalMessage.usage.cache_read_input_tokens ?? 0,
        cacheCreationTokens: finalMessage.usage.cache_creation_input_tokens ?? 0,
      },
    };
  }

  private async resolveClient(): Promise<AnthropicClient> {
    if (this.explicitClient) return this.explicitClient;
    if (!this.clientPromise) {
      this.clientPromise = loadAnthropicClient(this.apiKey!);
    }
    return this.clientPromise;
  }
}

async function loadAnthropicClient(apiKey: string): Promise<AnthropicClient> {
  let mod: { default: new (opts: { apiKey: string }) => AnthropicClient };
  try {
    mod = (await import('@anthropic-ai/sdk')) as unknown as typeof mod;
  } catch (err) {
    throw new AIProviderError(
      "playwright-ai-matchers: the '@anthropic-ai/sdk' package is required to use ClaudeProvider. Install it with `npm install @anthropic-ai/sdk`.",
      undefined,
      err,
    );
  }
  return new mod.default({ apiKey });
}

function isAnthropicAPIError(err: Error): err is AnthropicAPIError {
  return 'status' in err && typeof (err as AnthropicAPIError).status === 'number';
}

function effortToApi(effort: Effort): 'low' | 'medium' | 'high' | 'max' {
  // SDK 0.85 does not yet type "xhigh" — it is accepted by the Opus 4.7 API.
  // Cast through to preserve the public four-level surface while the SDK catches up.
  return effort === 'xhigh' ? ('xhigh' as 'high') : effort;
}
