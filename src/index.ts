import './matchers';

export type {
  AIProvider,
  EvalType,
  Effort,
  EvalResult,
  EvalUsage,
  EvaluateOptions,
  EvaluationMiddleware,
  ClaudeProviderOptions,
  OpenAIProviderOptions,
  GeminiProviderOptions,
} from './providers';
export {
  ClaudeProvider,
  OpenAIProvider,
  GeminiProvider,
  OllamaProvider,
  getDefaultProvider,
  setDefaultProvider,
  setMiddleware,
  getMiddleware,
} from './providers';
export { CachedProvider } from './providers/cached';
export type { CacheOptions } from './providers/cached';
export type { OllamaProviderOptions } from './providers/ollama';
export { AIProviderError } from './errors';
export type { MatcherOptions } from './matchers';

import type { MatcherOptions } from './matchers';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace PlaywrightTest {
    interface Matchers<R, T> {
      /**
       * Asserts that the AI response meaningfully relates to the given topic.
       *
       * Accepts a `string` or a Playwright `Locator` (text is extracted automatically).
       *
       * @example
       * await expect(response).toMeanSomethingAbout('billing and pricing');
       * await expect(page.locator('main')).toMeanSomethingAbout('product features');
       */
      toMeanSomethingAbout(
        topic: string,
        options?: MatcherOptions,
      ): Promise<R>;

      /**
       * Asserts that the AI response satisfies a plain-language criterion.
       *
       * Accepts a `string` or a Playwright `Locator` (text is extracted automatically).
       *
       * @example
       * await expect(response).toSatisfy('mentions a specific price');
       * await expect(page.locator('.hero')).toSatisfy('has a clear call to action');
       */
      toSatisfy(criterion: string, options?: MatcherOptions): Promise<R>;

      /**
       * Asserts that the AI response hallucinates facts not present in the given context.
       * Use with `.not` to assert that no hallucination occurred.
       *
       * Accepts a `string` or a Playwright `Locator` (text is extracted automatically).
       *
       * @example
       * await expect(response).not.toHallucinate('The pro plan costs $49/month');
       */
      toHallucinate(context: string, options?: MatcherOptions): Promise<R>;

      /**
       * Asserts that the AI response is genuinely helpful — not an error, refusal, or empty reply.
       *
       * Accepts a `string` or a Playwright `Locator` (text is extracted automatically).
       *
       * @example
       * await expect(response).toBeHelpful();
       */
      toBeHelpful(options?: MatcherOptions): Promise<R>;

      /**
       * Asserts that the AI response expresses or enacts the given communicative intent.
       *
       * Accepts a `string` or a Playwright `Locator` (text is extracted automatically).
       *
       * @example
       * await expect(response).toHaveIntent('apologizing for a service outage');
       */
      toHaveIntent(intent: string, options?: MatcherOptions): Promise<R>;

      /**
       * Asserts that the AI response conveys the given emotional tone.
       *
       * Accepts a `string` or a Playwright `Locator` (text is extracted automatically).
       *
       * @example
       * await expect(response).toHaveSentiment('empathetic');
       */
      toHaveSentiment(
        sentiment: string,
        options?: MatcherOptions,
      ): Promise<R>;

      /**
       * @deprecated Use `toHaveIntent` instead.
       */
      toIAHaveIntent(intent: string, options?: MatcherOptions): Promise<R>;

      /**
       * @deprecated Use `toHaveSentiment` instead.
       */
      toIAHaveSentiment(
        sentiment: string,
        options?: MatcherOptions,
      ): Promise<R>;
    }
  }
}
