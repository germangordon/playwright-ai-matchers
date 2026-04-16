import { expect } from '@playwright/test';
import type { ExpectMatcherState } from '@playwright/test';
import { getDefaultProvider } from './providers';
import type { AIProvider, Effort, EvalType } from './providers/base';
import { formatMatcherMessage } from './errors';

export interface MatcherOptions {
  provider?: AIProvider;
  effort?: Effort;
}

async function runMatcher(args: {
  received: string;
  criteria: string;
  type: EvalType;
  options: MatcherOptions | undefined;
  isNot: boolean;
  passHeader: string;
  failHeader: string;
}) {
  const { received, criteria, type, options, isNot, passHeader, failHeader } =
    args;
  const provider = options?.provider ?? getDefaultProvider();
  const result = await provider.evaluate(received, criteria, type, {
    effort: options?.effort,
  });
  return {
    pass: result.pass,
    message: () =>
      formatMatcherMessage({
        header: isNot ? passHeader : failHeader,
        received,
        result,
      }),
  };
}

expect.extend({
  async toMeanSomethingAbout(
    this: ExpectMatcherState,
    received: string,
    topic: string,
    options?: MatcherOptions,
  ) {
    return runMatcher({
      received,
      criteria: topic,
      type: 'means_about',
      options,
      isNot: this.isNot,
      passHeader: `Expected response NOT to be about "${topic}", but it was.`,
      failHeader: `Expected response to mean something about "${topic}", but it didn't.`,
    });
  },

  async toSatisfy(
    this: ExpectMatcherState,
    received: string,
    criterion: string,
    options?: MatcherOptions,
  ) {
    return runMatcher({
      received,
      criteria: criterion,
      type: 'satisfies',
      options,
      isNot: this.isNot,
      passHeader: `Expected response NOT to satisfy: "${criterion}", but it did.`,
      failHeader: `Expected response to satisfy: "${criterion}", but it didn't.`,
    });
  },

  async toHallucinate(
    this: ExpectMatcherState,
    received: string,
    context: string,
    options?: MatcherOptions,
  ) {
    return runMatcher({
      received,
      criteria: context,
      type: 'hallucinates',
      options,
      isNot: this.isNot,
      passHeader: `Expected response NOT to hallucinate facts outside the provided context, but it did.`,
      failHeader: `Expected response to hallucinate facts not in context, but none were detected.`,
    });
  },

  async toBeHelpful(
    this: ExpectMatcherState,
    received: string,
    options?: MatcherOptions,
  ) {
    return runMatcher({
      received,
      criteria: '',
      type: 'helpful',
      options,
      isNot: this.isNot,
      passHeader: `Expected response NOT to be helpful, but it was.`,
      failHeader: `Expected response to be helpful, but it wasn't.`,
    });
  },

  async toIAHaveIntent(
    this: ExpectMatcherState,
    received: string,
    intent: string,
    options?: MatcherOptions,
  ) {
    return runMatcher({
      received,
      criteria: intent,
      type: 'intent',
      options,
      isNot: this.isNot,
      passHeader: `Expected response NOT to express the intent "${intent}", but it did.`,
      failHeader: `Expected response to express the intent "${intent}", but it didn't.`,
    });
  },

  async toIAHaveSentiment(
    this: ExpectMatcherState,
    received: string,
    sentiment: string,
    options?: MatcherOptions,
  ) {
    return runMatcher({
      received,
      criteria: sentiment,
      type: 'sentiment',
      options,
      isNot: this.isNot,
      passHeader: `Expected response NOT to convey "${sentiment}" sentiment, but it did.`,
      failHeader: `Expected response to convey "${sentiment}" sentiment, but it didn't.`,
    });
  },
});
