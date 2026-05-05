import { test, expect } from '@playwright/test';
import { buildUserPrompt, SHARED_SYSTEM_PROMPT } from '../../src/prompts';
import type { EvalType } from '../../src/providers/base';

test.describe('buildUserPrompt', () => {
  const evalTypes: EvalType[] = ['means_about', 'satisfies', 'hallucinates', 'helpful', 'intent', 'sentiment'];

  for (const type of evalTypes) {
    test(`builds prompt for type "${type}"`, () => {
      const result = buildUserPrompt({
        text: 'Hello world',
        criteria: 'test criterion',
        type,
      });

      expect(result).toContain('Hello world');
      expect(result).toContain(`Evaluation type: ${type}`);
      expect(result).toContain('Evaluate against the rubric');
    });
  }

  test('means_about includes TOPIC', () => {
    const result = buildUserPrompt({
      text: 'The Pro plan costs $49/month',
      criteria: 'pricing',
      type: 'means_about',
    });

    expect(result).toContain('TOPIC: "pricing"');
  });

  test('satisfies includes CRITERION', () => {
    const result = buildUserPrompt({
      text: 'Starts at $49/month.',
      criteria: 'mentions a specific price',
      type: 'satisfies',
    });

    expect(result).toContain('CRITERION: "mentions a specific price"');
  });

  test('hallucinates includes CONTEXT block', () => {
    const result = buildUserPrompt({
      text: 'Pro costs $49 with a free trial',
      criteria: 'Pro plan is $49/month.',
      type: 'hallucinates',
    });

    expect(result).toContain('CONTEXT (the only ground truth)');
    expect(result).toContain('Pro plan is $49/month.');
  });

  test('helpful has no additional criteria', () => {
    const result = buildUserPrompt({
      text: 'To reset your password, go to Settings.',
      criteria: '',
      type: 'helpful',
    });

    expect(result).toContain('(No additional criteria');
  });

  test('intent includes INTENT', () => {
    const result = buildUserPrompt({
      text: 'We are sorry for the downtime.',
      criteria: 'apologizing for a service outage',
      type: 'intent',
    });

    expect(result).toContain('INTENT: "apologizing for a service outage"');
  });

  test('sentiment includes SENTIMENT LABEL', () => {
    const result = buildUserPrompt({
      text: 'That sounds really frustrating — let me help.',
      criteria: 'empathetic',
      type: 'sentiment',
    });

    expect(result).toContain('SENTIMENT LABEL: "empathetic"');
  });

  test('wraps text in triple-quote block', () => {
    const result = buildUserPrompt({
      text: 'test response',
      criteria: 'test',
      type: 'satisfies',
    });

    expect(result).toContain('RESPONSE (artifact under test)');
    expect(result).toContain('"""\ntest response\n"""');
  });
});

test.describe('SHARED_SYSTEM_PROMPT', () => {
  test('contains core principles', () => {
    expect(SHARED_SYSTEM_PROMPT).toContain('Core principles');
    expect(SHARED_SYSTEM_PROMPT).toContain('Ground decisions strictly in the evidence');
  });

  test('contains all six evaluation type rubrics', () => {
    expect(SHARED_SYSTEM_PROMPT).toContain('Type: means_about');
    expect(SHARED_SYSTEM_PROMPT).toContain('Type: satisfies');
    expect(SHARED_SYSTEM_PROMPT).toContain('Type: hallucinates');
    expect(SHARED_SYSTEM_PROMPT).toContain('Type: helpful');
    expect(SHARED_SYSTEM_PROMPT).toContain('Type: intent');
    expect(SHARED_SYSTEM_PROMPT).toContain('Type: sentiment');
  });

  test('contains output contract', () => {
    expect(SHARED_SYSTEM_PROMPT).toContain('submit_evaluation');
    expect(SHARED_SYSTEM_PROMPT).toContain('pass');
    expect(SHARED_SYSTEM_PROMPT).toContain('reason');
  });

  test('contains triage heuristics', () => {
    expect(SHARED_SYSTEM_PROMPT).toContain('Triage heuristics');
  });

  test('contains common failure modes', () => {
    expect(SHARED_SYSTEM_PROMPT).toContain('Common failure modes');
  });
});
