import { expect } from '@playwright/test';
import type { ExpectMatcherState } from '@playwright/test';
import {
  evalMeansSomethingAbout,
  evalSatisfies,
  evalHallucinates,
  evalIsHelpful,
} from './claude';

expect.extend({
  async toMeanSomethingAbout(
    this: ExpectMatcherState,
    received: string,
    topic: string,
  ) {
    const { isNot } = this;
    const result = await evalMeansSomethingAbout(received, topic);
    return {
      pass: result.pass,
      message: () =>
        isNot
          ? [
              `Expected response NOT to be about "${topic}", but it was.`,
              `Reason:   ${result.reason}`,
              `Received: ${received}`,
            ].join('\n')
          : [
              `Expected response to mean something about "${topic}", but it didn't.`,
              `Reason:   ${result.reason}`,
              `Received: ${received}`,
            ].join('\n'),
    };
  },

  async toSatisfy(
    this: ExpectMatcherState,
    received: string,
    criterion: string,
  ) {
    const { isNot } = this;
    const result = await evalSatisfies(received, criterion);
    return {
      pass: result.pass,
      message: () =>
        isNot
          ? [
              `Expected response NOT to satisfy: "${criterion}", but it did.`,
              `Reason:   ${result.reason}`,
              `Received: ${received}`,
            ].join('\n')
          : [
              `Expected response to satisfy: "${criterion}", but it didn't.`,
              `Reason:   ${result.reason}`,
              `Received: ${received}`,
            ].join('\n'),
    };
  },

  async toHallucinate(
    this: ExpectMatcherState,
    received: string,
    context: string,
  ) {
    const { isNot } = this;
    const result = await evalHallucinates(received, context);
    return {
      pass: result.pass,
      message: () =>
        isNot
          ? [
              `Expected response NOT to hallucinate facts outside the provided context, but it did.`,
              `Reason:   ${result.reason}`,
              `Received: ${received}`,
            ].join('\n')
          : [
              `Expected response to hallucinate facts not in context, but none were detected.`,
              `Reason:   ${result.reason}`,
              `Received: ${received}`,
            ].join('\n'),
    };
  },

  async toBeHelpful(this: ExpectMatcherState, received: string) {
    const { isNot } = this;
    const result = await evalIsHelpful(received);
    return {
      pass: result.pass,
      message: () =>
        isNot
          ? [
              `Expected response NOT to be helpful, but it was.`,
              `Reason:   ${result.reason}`,
              `Received: ${received}`,
            ].join('\n')
          : [
              `Expected response to be helpful, but it wasn't.`,
              `Reason:   ${result.reason}`,
              `Received: ${received}`,
            ].join('\n'),
    };
  },
});
