import { test, expect } from '@playwright/test';
import { runWithRetry } from '../../src/retry';
import { AIProviderError } from '../../src/errors';

test.describe('runWithRetry', () => {
  test('returns result on first success', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      return 'ok';
    };
    const result = await runWithRetry(fn, 2);
    expect(result).toBe('ok');
    expect(calls).toBe(1);
  });

  test('retries on AIProviderError and succeeds', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 2) throw new AIProviderError('Rate limited');
      return 'ok';
    };

    const result = await runWithRetry(fn, 2);
    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });

  test('retries on network errors and succeeds', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 2) throw new TypeError('fetch failed');
      return 'ok';
    };

    const result = await runWithRetry(fn, 2);
    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });

  test('retries on ECONNRESET error', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 2) throw new Error('read ECONNRESET');
      return 'ok';
    };

    const result = await runWithRetry(fn, 2);
    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });

  test('throws after exhausting retries on AIProviderError', async () => {
    const fn = async () => {
      throw new AIProviderError('Persistent failure');
    };

    await expect(runWithRetry(fn, 2)).rejects.toThrow('Persistent failure');
  });

  test('throws immediately on non-retryable error', async () => {
    const fn = async () => {
      throw new SyntaxError('Invalid JSON');
    };

    await expect(runWithRetry(fn, 2)).rejects.toThrow('Invalid JSON');
  });

  test('does not retry on generic Error', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      throw new Error('Something went wrong');
    };

    await expect(runWithRetry(fn, 3)).rejects.toThrow('Something went wrong');
    expect(calls).toBe(1);
  });

  test('respects zero retries', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 2) throw new AIProviderError('Rate limited');
      return 'ok';
    };

    await expect(runWithRetry(fn, 0)).rejects.toThrow('Rate limited');
    expect(calls).toBe(1);
  });
});
