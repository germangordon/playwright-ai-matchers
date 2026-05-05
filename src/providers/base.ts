export type EvalType =
  | 'means_about'
  | 'satisfies'
  | 'hallucinates'
  | 'helpful'
  | 'intent'
  | 'sentiment';

export type Effort = 'low' | 'medium' | 'high' | 'xhigh';

export interface EvalUsage {
  inputTokens: number;
  outputTokens: number;
  /** Only populated by providers that support prompt caching (e.g., Anthropic). */
  cacheReadTokens?: number;
  /** Only populated by providers that support prompt caching (e.g., Anthropic). */
  cacheCreationTokens?: number;
}

export interface EvalResult {
  pass: boolean;
  reason: string;
  model: string;
  effort: Effort;
  reasoning?: string;
  usage?: EvalUsage;
}

export interface EvaluateOptions {
  effort?: Effort;
}

export interface EvaluationMiddleware {
  beforeEvaluate?(text: string, criteria: string, type: EvalType): Promise<{ text: string; criteria: string }>;
  afterEvaluate?(result: EvalResult): Promise<EvalResult>;
}

export interface AIProvider {
  /** Optional identifier included in cache keys. Defaults to constructor name. */
  readonly id?: string;
  evaluate(
    text: string,
    criteria: string,
    type: EvalType,
    options?: EvaluateOptions,
  ): Promise<EvalResult>;
}
