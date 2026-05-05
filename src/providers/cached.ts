import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { AIProvider, EvalResult, EvalType, EvaluateOptions } from './base';

export interface CacheOptions {
  /** Directory to store cache files. Defaults to `.playwright-ai-cache` in cwd. */
  dir?: string;
  /** How long a cached result is valid, in seconds. Defaults to 86400 (24 hours). */
  ttlSeconds?: number;
  /**
   * An arbitrary string mixed into every cache key.
   * Change this to bust the cache when you update your prompts or provider model.
   */
  namespace?: string;
}

interface CacheEntry {
  result: EvalResult;
  cachedAt: number;
}

/**
 * Wraps any AIProvider and caches evaluation results to disk between test runs.
 *
 * @example
 * import { ClaudeProvider, CachedProvider, setDefaultProvider } from 'playwright-ai-matchers';
 * setDefaultProvider(new CachedProvider(new ClaudeProvider(), { ttlSeconds: 86400 }));
 */
export class CachedProvider implements AIProvider {
  private readonly inner: AIProvider;
  private readonly dir: string;
  private readonly ttlMs: number;
  private readonly namespace: string;

  constructor(inner: AIProvider, options: CacheOptions = {}) {
    this.inner = inner;
    this.dir = options.dir ?? path.join(process.cwd(), '.playwright-ai-cache');
    this.ttlMs = (options.ttlSeconds ?? 86400) * 1000;
    this.namespace = options.namespace ?? '';
  }

  async evaluate(
    text: string,
    criteria: string,
    type: EvalType,
    options: EvaluateOptions = {},
  ): Promise<EvalResult> {
    const key = this.cacheKey(text, criteria, type, options);
    const cached = this.read(key);
    if (cached) return cached;

    const result = await this.inner.evaluate(text, criteria, type, options);
    this.write(key, result);
    return result;
  }

  private cacheKey(
    text: string,
    criteria: string,
    type: EvalType,
    options: EvaluateOptions,
  ): string {
    const payload = JSON.stringify({
      ns: this.namespace,
      provider: this.inner.id ?? this.inner.constructor.name,
      text,
      criteria,
      type,
      effort: options.effort ?? 'medium',
    });
    return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 40);
  }

  private filePath(key: string): string {
    return path.join(this.dir, `${key}.json`);
  }

  private read(key: string): EvalResult | null {
    const fp = this.filePath(key);
    try {
      const raw = fs.readFileSync(fp, 'utf-8');
      const entry: CacheEntry = JSON.parse(raw);
      if (Date.now() - entry.cachedAt > this.ttlMs) {
        fs.unlinkSync(fp);
        return null;
      }
      return entry.result;
    } catch {
      return null;
    }
  }

  private write(key: string, result: EvalResult): void {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const entry: CacheEntry = { result, cachedAt: Date.now() };
      fs.writeFileSync(this.filePath(key), JSON.stringify(entry, null, 2), 'utf-8');
    } catch {
      // Cache writes are best-effort — never fail a test because of a cache error
    }
  }
}
