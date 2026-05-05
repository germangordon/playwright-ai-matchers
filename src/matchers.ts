import { expect } from '@playwright/test';
import type { ExpectMatcherState } from '@playwright/test';
import { getDefaultProvider, getMiddleware } from './providers';
import type { AIProvider, Effort, EvalType } from './providers/base';
import { formatMatcherMessage, AIProviderError } from './errors';
import { runWithRetry } from './retry';

export interface MatcherOptions {
  provider?: AIProvider;
  effort?: Effort;
  retries?: number;
}

async function resolveText(received: unknown): Promise<string> {
  if (typeof received === 'string') return received;
  if (isLocator(received)) {
    return received.innerText();
  }
  throw new AIProviderError(
    `playwright-ai-matchers: expected a string or Playwright Locator, got ${typeof received}`,
  );
}

function isLocator(value: unknown): value is { innerText: () => Promise<string> } {
  return value !== null
    && typeof value === 'object'
    && typeof (value as Record<string, unknown>).innerText === 'function';
}

async function runMatcher(args: {
  received: unknown;
  criteria: string;
  type: EvalType;
  options: MatcherOptions | undefined;
  isNot: boolean;
  passHeader: string;
  failHeader: string;
}) {
  const { received, criteria, type, options, isNot, passHeader, failHeader } = args;
  let text = await resolveText(received);
  let resolvedCriteria = criteria;
  const provider = options?.provider ?? getDefaultProvider();
  const retries = options?.retries ?? 2;
  const middleware = getMiddleware();

  if (middleware?.beforeEvaluate) {
    const transformed = await middleware.beforeEvaluate(text, criteria, type);
    text = transformed.text;
    resolvedCriteria = transformed.criteria;
  }

  const result = await runWithRetry(
    () => provider.evaluate(text, resolvedCriteria, type, { effort: options?.effort }),
    retries,
  );

  const finalResult = middleware?.afterEvaluate
    ? await middleware.afterEvaluate(result)
    : result;

  return {
    pass: finalResult.pass,
    message: () =>
      formatMatcherMessage({
        header: isNot ? passHeader : failHeader,
        received: text,
        result: finalResult,
      }),
  };
}

expect.extend({
  async toMeanSomethingAbout(
    this: ExpectMatcherState,
    received: unknown,
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
    received: unknown,
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
    received: unknown,
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
    received: unknown,
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

  async toHaveIntent(
    this: ExpectMatcherState,
    received: unknown,
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

  async toHaveSentiment(
    this: ExpectMatcherState,
    received: unknown,
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

  // Deprecated aliases — kept for backwards compatibility with v2 code
  async toIAHaveIntent(
    this: ExpectMatcherState,
    received: unknown,
    intent: string,
    options?: MatcherOptions,
  ) {
    console.warn(
      '[playwright-ai-matchers] toIAHaveIntent is deprecated — use toHaveIntent instead.',
    );
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
    received: unknown,
    sentiment: string,
    options?: MatcherOptions,
  ) {
    console.warn(
      '[playwright-ai-matchers] toIAHaveSentiment is deprecated — use toHaveSentiment instead.',
    );
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
