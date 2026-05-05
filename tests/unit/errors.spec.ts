import { test, expect } from '@playwright/test';
import { formatMatcherMessage, AIProviderError } from '../../src/errors';
import type { EvalResult } from '../../src/providers/base';

function makeResult(overrides: Partial<EvalResult> = {}): EvalResult {
  return {
    pass: false,
    reason: 'Missing specific price in response.',
    model: 'claude-opus-4-7',
    effort: 'medium',
    ...overrides,
  };
}

test.describe('formatMatcherMessage', () => {
  test('includes header, model, effort, reason, and received', () => {
    const result = makeResult();
    const msg = formatMatcherMessage({
      header: 'Expected response to satisfy: "mentions price", but it didn\'t.',
      received: 'We have affordable pricing.',
      result,
    });

    expect(msg).toContain('Expected response to satisfy: "mentions price"');
    expect(msg).toContain('Model:     claude-opus-4-7 (effort: medium)');
    expect(msg).toContain('Reason:    Missing specific price in response.');
    expect(msg).toContain('Received:  We have affordable pricing.');
  });

  test('includes reasoning when present', () => {
    const result = makeResult({
      reasoning: 'The response says "affordable pricing" which is vague and does not contain a specific number or currency.',
    });
    const msg = formatMatcherMessage({
      header: 'Test header',
      received: 'test',
      result,
    });

    expect(msg).toContain('Reasoning: The response says "affordable pricing"');
  });

  test('omits reasoning when empty', () => {
    const result = makeResult({ reasoning: '' });
    const msg = formatMatcherMessage({
      header: 'Test header',
      received: 'test',
      result,
    });

    expect(msg).not.toContain('Reasoning:');
  });

  test('omits reasoning when undefined', () => {
    const result = makeResult({ reasoning: undefined });
    const msg = formatMatcherMessage({
      header: 'Test header',
      received: 'test',
      result,
    });

    expect(msg).not.toContain('Reasoning:');
  });

  test('truncates long reasoning', () => {
    const longReasoning = 'a'.repeat(500);
    const result = makeResult({ reasoning: longReasoning });
    const msg = formatMatcherMessage({
      header: 'Test header',
      received: 'test',
      result,
    });

    expect(msg).toContain('Reasoning: ');
    const reasoningLine = msg.split('\n').find((l) => l.startsWith('Reasoning:'));
    expect(reasoningLine).toBeDefined();
    expect(reasoningLine!.length).toBeLessThanOrEqual(412);
    expect(reasoningLine!).toContain('…');
  });

  test('uses isNot passHeader correctly', () => {
    const result = makeResult({ pass: true });
    const msg = formatMatcherMessage({
      header: 'Expected response NOT to be about "pricing", but it was.',
      received: 'The Pro plan costs $49/month.',
      result,
    });

    expect(msg).toContain('NOT to be about "pricing"');
  });
});

test.describe('AIProviderError', () => {
  test('includes model and raw payload', () => {
    const raw = { stop_reason: 'tool_use' };
    const err = new AIProviderError('Test error', 'claude-opus-4-7', raw);

    expect(err.message).toBe('Test error');
    expect(err.name).toBe('AIProviderError');
    expect(err.model).toBe('claude-opus-4-7');
    expect(err.raw).toBe(raw);
  });

  test('works without optional fields', () => {
    const err = new AIProviderError('No provider detected');

    expect(err.message).toBe('No provider detected');
    expect(err.model).toBeUndefined();
    expect(err.raw).toBeUndefined();
  });
});
