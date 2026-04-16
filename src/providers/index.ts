import { ClaudeProvider } from './claude';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';
import type { AIProvider } from './base';
import { AIProviderError } from '../errors';

export { ClaudeProvider } from './claude';
export { OpenAIProvider } from './openai';
export { GeminiProvider } from './gemini';
export type { ClaudeProviderOptions } from './claude';
export type { OpenAIProviderOptions } from './openai';
export type { GeminiProviderOptions } from './gemini';
export type {
  AIProvider,
  EvalType,
  Effort,
  EvalResult,
  EvalUsage,
  EvaluateOptions,
} from './base';

let _defaultProvider: AIProvider | null = null;

export function getDefaultProvider(): AIProvider {
  if (!_defaultProvider) {
    _defaultProvider = detectProvider();
  }
  return _defaultProvider;
}

export function setDefaultProvider(provider: AIProvider | null): void {
  _defaultProvider = provider;
}

function detectProvider(): AIProvider {
  if (process.env.ANTHROPIC_API_KEY) {
    return new ClaudeProvider();
  }
  if (process.env.OPENAI_API_KEY) {
    return new OpenAIProvider();
  }
  if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) {
    return new GeminiProvider();
  }
  throw new AIProviderError(
    'playwright-ai-matchers: no provider API key detected. Set one of ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY — or pass a provider explicitly via setDefaultProvider() or the `provider` matcher option.',
  );
}
