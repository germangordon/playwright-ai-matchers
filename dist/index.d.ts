import './matchers';
export type { EvalResult } from './claude';
declare global {
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
//# sourceMappingURL=index.d.ts.map