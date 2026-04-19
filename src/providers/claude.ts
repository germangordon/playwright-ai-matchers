import Anthropic from '@anthropic-ai/sdk';
import type {
  AIProvider,
  Effort,
  EvalResult,
  EvalType,
  EvaluateOptions,
} from './base';
import { SHARED_SYSTEM_PROMPT, buildUserPrompt } from '../prompts';
import { AIProviderError } from '../errors';

const DEFAULT_MODEL = 'claude-opus-4-7';
const DEFAULT_EFFORT: Effort = 'medium';
const MAX_TOKENS = 8192;

const SUBMIT_EVALUATION_TOOL: Anthropic.Tool = {
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
  client?: Anthropic;
}

export class ClaudeProvider implements AIProvider {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly defaultEffort: Effort;

  constructor(options: ClaudeProviderOptions = {}) {
    if (options.client) {
      this.client = options.client;
    } else {
      const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new AIProviderError(
          'playwright-ai-matchers: ANTHROPIC_API_KEY is not set and no apiKey was passed to ClaudeProvider.',
        );
      }
      this.client = new Anthropic({ apiKey });
    }
    this.model = options.model ?? DEFAULT_MODEL;
    this.defaultEffort = options.defaultEffort ?? DEFAULT_EFFORT;
  }

  async evaluate(
    text: string,
    criteria: string,
    type: EvalType,
    options: EvaluateOptions = {},
  ): Promise<EvalResult> {
    const effort = options.effort ?? this.defaultEffort;
    const userPrompt = buildUserPrompt({ text, criteria, type });

    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: this.model,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: 'text',
          text: SHARED_SYSTEM_PROMPT,
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

    let finalMessage: Anthropic.Message;
    try {
      const stream = this.client.messages.stream(params);
      finalMessage = await stream.finalMessage();
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        throw new AIProviderError(
          `Claude API error (${err.status ?? 'unknown'}): ${err.message}`,
          this.model,
          err,
        );
      }
      throw err;
    }

    const toolUse = finalMessage.content.find(
      (block): block is Anthropic.ToolUseBlock =>
        block.type === 'tool_use' && block.name === 'submit_evaluation',
    );
    if (!toolUse) {
      throw new AIProviderError(
        `Claude did not call submit_evaluation. stop_reason=${finalMessage.stop_reason}`,
        this.model,
        finalMessage,
      );
    }

    const input = toolUse.input as Record<string, unknown>;
    if (typeof input.pass !== 'boolean' || typeof input.reason !== 'string') {
      throw new AIProviderError(
        `submit_evaluation tool returned an invalid payload: ${JSON.stringify(input)}`,
        this.model,
        finalMessage,
      );
    }

    const reasoning = finalMessage.content
      .filter((b): b is Anthropic.ThinkingBlock => b.type === 'thinking')
      .map((b) => b.thinking)
      .filter((t) => t && t.trim().length > 0)
      .join('\n\n');

    return {
      pass: input.pass,
      reason: input.reason,
      model: this.model,
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
}

function effortToApi(effort: Effort): 'low' | 'medium' | 'high' | 'max' {
  // SDK 0.85 does not yet type "xhigh" — it is accepted by the Opus 4.7 API.
  // Cast through to preserve the public four-level surface while the SDK catches up.
  return effort === 'xhigh' ? ('xhigh' as 'high') : effort;
}
