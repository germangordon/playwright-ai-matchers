import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CachedProvider } from '../../src/providers/cached';
import type { AIProvider, EvalResult, EvalType, EvaluateOptions } from '../../src/providers/base';

function makeMockProvider(result: EvalResult): AIProvider {
  return {
    evaluate: async (_text: string, _criteria: string, _type: EvalType, _options?: EvaluateOptions) => result,
  };
}

function makeResult(): EvalResult {
  return {
    pass: true,
    reason: 'Response discusses pricing with a specific amount.',
    model: 'test-model',
    effort: 'medium',
  };
}

test.describe('CachedProvider', () => {
  let cacheDir: string;

  test.beforeEach(() => {
    cacheDir = path.join(os.tmpdir(), `cache-test-${Date.now()}`);
  });

  test.afterEach(() => {
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  test('caches result and returns it on subsequent calls', async () => {
    let evaluateCalls = 0;
    const inner: AIProvider = {
      evaluate: async () => {
        evaluateCalls++;
        return makeResult();
      },
    };
    const provider = new CachedProvider(inner, { dir: cacheDir, ttlSeconds: 3600 });

    const result1 = await provider.evaluate('test text', 'pricing', 'means_about');
    const result2 = await provider.evaluate('test text', 'pricing', 'means_about');

    expect(result1).toEqual(result2);
    expect(evaluateCalls).toBe(1);
  });

  test('cache key includes provider identity', async () => {
    const result = makeResult();
    const providerA = new CachedProvider(makeMockProvider(result), { dir: cacheDir, ttlSeconds: 3600, namespace: 'provider-a' });
    const providerB = new CachedProvider(makeMockProvider({ ...result, pass: false }), { dir: cacheDir, ttlSeconds: 3600, namespace: 'provider-b' });

    const resultA = await providerA.evaluate('same text', 'same criteria', 'satisfies');
    const resultB = await providerB.evaluate('same text', 'same criteria', 'satisfies');

    expect(resultA.pass).toBe(true);
    expect(resultB.pass).toBe(false);
  });

  test('different effort levels produce separate cache entries', async () => {
    let evaluateCalls = 0;
    const inner: AIProvider = {
      evaluate: async (_text, _criteria, _type, options) => ({
        ...makeResult(),
        effort: options?.effort ?? 'medium',
      }),
    };
    const provider = new CachedProvider(inner, { dir: cacheDir, ttlSeconds: 3600 });

    const low = await provider.evaluate('text', 'criteria', 'satisfies', { effort: 'low' });
    const high = await provider.evaluate('text', 'criteria', 'satisfies', { effort: 'high' });

    expect(low.effort).toBe('low');
    expect(high.effort).toBe('high');
  });

  test('expired TTL triggers re-evaluation', async () => {
    let evaluateCalls = 0;
    const inner: AIProvider = {
      evaluate: async () => {
        evaluateCalls++;
        return makeResult();
      },
    };
    const provider = new CachedProvider(inner, { dir: cacheDir, ttlSeconds: 1 });

    await provider.evaluate('text', 'criteria', 'satisfies');
    await new Promise((r) => setTimeout(r, 1100));
    await provider.evaluate('text', 'criteria', 'satisfies');

    expect(evaluateCalls).toBe(2);
  });

  test('different texts produce separate cache entries', async () => {
    const texts: string[] = [];
    const inner: AIProvider = {
      evaluate: async (text) => {
        texts.push(text);
        return makeResult();
      },
    };
    const provider = new CachedProvider(inner, { dir: cacheDir, ttlSeconds: 3600 });

    await provider.evaluate('text A', 'criteria', 'satisfies');
    await provider.evaluate('text B', 'criteria', 'satisfies');

    expect(texts).toEqual(['text A', 'text B']);
  });

  test('best-effort write does not throw on filesystem errors', async () => {
    const inner: AIProvider = {
      evaluate: async () => makeResult(),
    };
    const provider = new CachedProvider(inner, { dir: '/nonexistent/readonly/path', ttlSeconds: 3600 });

    await expect(provider.evaluate('text', 'criteria', 'satisfies')).resolves.toBeDefined();
  });
});
