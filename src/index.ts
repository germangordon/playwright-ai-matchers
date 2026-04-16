import './matchers';

export type {
  AIProvider,
  EvalType,
  Effort,
  EvalResult,
  EvalUsage,
  EvaluateOptions,
  ClaudeProviderOptions,
  OpenAIProviderOptions,
  GeminiProviderOptions,
} from './providers';
export {
  ClaudeProvider,
  OpenAIProvider,
  GeminiProvider,
  getDefaultProvider,
  setDefaultProvider,
} from './providers';
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
       * @example
       * await expect(response).toMeanSomethingAbout('billing and pricing');
       * await expect(response).toMeanSomethingAbout('pricing', { effort: 'high' });
       */
      toMeanSomethingAbout(
        topic: string,
        options?: MatcherOptions,
      ): Promise<R>;

      /**
       * Asserts that the AI response satisfies a plain-language criterion.
       *
       * @example
       * await expect(response).toSatisfy('mentions a specific price');
       */
      toSatisfy(criterion: string, options?: MatcherOptions): Promise<R>;

      /**
       * Asserts that the AI response hallucinates facts not present in the given context.
       * Use with `.not` to assert that no hallucination occurred.
       *
       * @example
       * await expect(response).not.toHallucinate('The pro plan costs $49/month');
       */
      toHallucinate(context: string, options?: MatcherOptions): Promise<R>;

      /**
       * Asserts that the AI response is genuinely helpful — not an error, refusal, or empty reply.
       *
       * @example
       * await expect(response).toBeHelpful();
       */
      toBeHelpful(options?: MatcherOptions): Promise<R>;

      /**
       * Asserts that the AI response expresses or enacts the given communicative intent.
       *
       * @example
       * await expect(response).toIAHaveIntent('apologizing for a service outage');
       */
      toIAHaveIntent(intent: string, options?: MatcherOptions): Promise<R>;

      /**
       * Asserts that the AI response conveys the given emotional tone.
       *
       * @example
       * await expect(response).toIAHaveSentiment('empathetic');
       */
      toIAHaveSentiment(
        sentiment: string,
        options?: MatcherOptions,
      ): Promise<R>;
    }
  }
}
