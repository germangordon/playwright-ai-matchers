import { AIProviderError } from './errors';

export async function runWithRetry<T>(
  fn: () => Promise<T>,
  retries: number,
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt < retries && isRetryable(err)) {
        const delayMs = 500 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw new AIProviderError('runWithRetry: exhausted all attempts without returning or throwing');
}

function isRetryable(err: unknown): boolean {
  if (err instanceof AIProviderError) return true;
  if (err instanceof Error && isNetworkError(err)) return true;
  return false;
}

function isNetworkError(err: Error): boolean {
  const patterns = [
    'fetch',
    'econnreset',
    'etimedout',
    'econnrefused',
    'enotfound',
    'socket hang up',
    'network error',
  ];
  const msg = err.message.toLowerCase();
  return patterns.some((p) => msg.includes(p));
}
