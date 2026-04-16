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
  cacheReadTokens: number;
  cacheCreationTokens: number;
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

export interface AIProvider {
  evaluate(
    text: string,
    criteria: string,
    type: EvalType,
    options?: EvaluateOptions,
  ): Promise<EvalResult>;
}
