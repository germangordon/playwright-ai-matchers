import { ClaudeProvider } from './claude';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';
import { OllamaProvider } from './ollama';
import type { AIProvider, EvaluationMiddleware } from './base';
import { AIProviderError } from '../errors';

export { ClaudeProvider } from './claude';
export { OpenAIProvider } from './openai';
export { GeminiProvider } from './gemini';
export { OllamaProvider } from './ollama';
export { CachedProvider } from './cached';
export type { ClaudeProviderOptions } from './claude';
export type { OpenAIProviderOptions } from './openai';
export type { GeminiProviderOptions } from './gemini';
export type { OllamaProviderOptions } from './ollama';
export type { CacheOptions } from './cached';
export type {
  AIProvider,
  EvalType,
  Effort,
  EvalResult,
  EvalUsage,
  EvaluateOptions,
  EvaluationMiddleware,
} from './base';

let _defaultProvider: AIProvider | null = null;
let _middleware: EvaluationMiddleware | null = null;

export function getDefaultProvider(): AIProvider {
  if (!_defaultProvider) {
    _defaultProvider = detectProvider();
  }
  return _defaultProvider;
}

export function setDefaultProvider(provider: AIProvider | null): void {
  _defaultProvider = provider;
}

export function setMiddleware(mw: EvaluationMiddleware | null): void {
  _middleware = mw;
}

export function getMiddleware(): EvaluationMiddleware | null {
  return _middleware;
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
  if (process.env.OLLAMA_MODEL || process.env.OLLAMA_BASE_URL) {
    return new OllamaProvider();
  }
  throw new AIProviderError(
    'playwright-ai-matchers: no provider detected. ' +
      'Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY for cloud providers — ' +
      'or set OLLAMA_MODEL (e.g. "llama3.2") to use a local model via Ollama. ' +
      'You can also call setDefaultProvider() or pass a provider via the `provider` matcher option.',
  );
}
