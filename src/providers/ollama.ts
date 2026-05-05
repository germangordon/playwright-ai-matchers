import type { AIProvider, Effort, EvalResult, EvalType, EvaluateOptions } from './base';
import { buildSystemPrompt, buildUserPrompt } from '../prompts';
import { AIProviderError } from '../errors';
import { extractJson } from '../utils/extractJson';

const DEFAULT_MODEL = 'llama3.2';
const DEFAULT_EFFORT: Effort = 'medium';

export interface OllamaProviderOptions {
  /** Base URL of the Ollama server. Defaults to OLLAMA_BASE_URL env var or http://localhost:11434. */
  baseUrl?: string;
  /** Model name to use. Defaults to OLLAMA_MODEL env var or 'llama3.2'. */
  model?: string;
  defaultEffort?: Effort;
}

/**
 * Provider for locally-running Ollama models (llama3.2, mistral, qwen2.5, phi4, gemma2, …).
 * No API key required — just have Ollama running on localhost.
 *
 * **Limitations:** Ollama's OpenAI-compatible API does not expose token usage counts
 * or chain-of-thought reasoning. The `EvalResult` returned by this provider will have
 * `usage` and `reasoning` as `undefined`.
 *
 * @example
 * import { setDefaultProvider, OllamaProvider } from 'playwright-ai-matchers';
 * setDefaultProvider(new OllamaProvider({ model: 'llama3.2' }));
 */
export class OllamaProvider implements AIProvider {
  readonly id: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly defaultEffort: Effort;

  constructor(options: OllamaProviderOptions = {}) {
    this.baseUrl = (
      options.baseUrl ??
      process.env.OLLAMA_BASE_URL ??
      'http://localhost:11434'
    ).replace(/\/$/, '');
    this.model = options.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL;
    this.defaultEffort = options.defaultEffort ?? DEFAULT_EFFORT;
    this.id = `ollama:${this.model}`;
  }

  async evaluate(
    text: string,
    criteria: string,
    type: EvalType,
    options: EvaluateOptions = {},
  ): Promise<EvalResult> {
    const effort = options.effort ?? this.defaultEffort;
    const systemPrompt = buildSystemPrompt(type, 'json');
    const userPrompt = buildUserPrompt({ text, criteria, type });

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          stream: false,
          temperature: 0,
        }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new AIProviderError(
        `Ollama connection error — is Ollama running at ${this.baseUrl}? Start it with \`ollama serve\`. Original error: ${message}`,
        this.model,
        err,
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new AIProviderError(
        `Ollama API error (HTTP ${response.status}): ${body.slice(0, 200)}`,
        this.model,
      );
    }

    let json: Record<string, unknown>;
    try {
      json = (await response.json()) as Record<string, unknown>;
    } catch (err) {
      throw new AIProviderError('Ollama returned a non-JSON response body.', this.model, err);
    }

    const choices = json.choices as Array<{ message: { content: string } }> | undefined;
    const content = choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new AIProviderError(
        `Ollama returned no message content. Full response: ${JSON.stringify(json).slice(0, 300)}`,
        this.model,
        json,
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(extractJson(content)) as Record<string, unknown>;
    } catch (err) {
      throw new AIProviderError(
        `Ollama returned content that is not valid JSON: ${content.slice(0, 200)}`,
        this.model,
        err,
      );
    }

    if (typeof parsed.pass !== 'boolean' || typeof parsed.reason !== 'string') {
      throw new AIProviderError(
        `Ollama verdict has invalid shape — got: ${JSON.stringify(parsed)}. ` +
          'Try a larger or more instruction-following model (e.g. llama3.2, qwen2.5, mistral).',
        this.model,
        parsed,
      );
    }

    return {
      pass: parsed.pass,
      reason: parsed.reason,
      model: this.model,
      effort,
    };
  }
}
