// Register all AI matchers with Playwright's expect()
import './matchers';

// Re-export the EvalResult type for users who want to inspect raw results
export type { EvalResult } from './claude';

// Type augmentation — augments the global PlaywrightTest.Matchers namespace
// which is what Playwright's MakeMatchers/BaseMatchers actually reads.
// Must use declare global + namespace PlaywrightTest with both <R, T> params
// to match the signature in playwright/types/test.d.ts.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace PlaywrightTest {
    interface Matchers<R, T> {
      /**
       * Asserts that the AI response meaningfully relates to the given topic.
       *
       * @example
       * await expect(response).toMeanSomethingAbout('billing and pricing');
       */
      toMeanSomethingAbout(topic: string): Promise<R>;

      /**
       * Asserts that the AI response satisfies a plain-language criterion.
       *
       * @example
       * await expect(response).toSatisfy('should mention a specific price or redirect user');
       */
      toSatisfy(criterion: string): Promise<R>;

      /**
       * Asserts that the AI response hallucinates facts not present in the given context.
       * Use with `.not` to assert that no hallucination occurred.
       *
       * @example
       * await expect(response).not.toHallucinate('The pro plan costs $49/month');
       */
      toHallucinate(context: string): Promise<R>;

      /**
       * Asserts that the AI response is genuinely helpful — not an error, refusal, or empty reply.
       *
       * @example
       * await expect(response).toBeHelpful();
       */
      toBeHelpful(): Promise<R>;
    }
  }
}
