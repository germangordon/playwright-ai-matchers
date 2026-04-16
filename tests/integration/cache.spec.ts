/**
 * Anthropic prompt-caching validation.
 *
 * Runs the SAME evaluation twice back-to-back. First call primes the cache
 * (cache_creation_input_tokens > 0, cache_read_input_tokens = 0). Second
 * call should hit the cache (cache_read_input_tokens > 0).
 *
 * The cached prefix is the SHARED_SYSTEM_PROMPT (~4,800 tokens) — prompt
 * caching on Opus 4.7 requires a ≥4,096-token prefix to activate.
 *
 * Run with:   npx tsx tests/integration/cache.spec.ts
 */

import { ClaudeProvider, type EvalResult } from '../../src';

async function main(): Promise<void> {
  console.log('Anthropic prompt-caching validation — v2.0');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('⏭  SKIPPED — ANTHROPIC_API_KEY not set');
    process.exit(2);
  }

  const provider = new ClaudeProvider();

  const text = 'The Pro plan is $49/month billed annually.';
  const criterion = 'mentions a specific dollar price';

  console.log('\n━━━ Call 1 (priming) ━━━');
  const r1 = await provider.evaluate(text, criterion, 'satisfies', { effort: 'low' });
  report(1, r1);

  console.log('\n━━━ Call 2 (should read cache) ━━━');
  const r2 = await provider.evaluate(text, criterion, 'satisfies', { effort: 'low' });
  report(2, r2);

  console.log('\n━━━ Verdict ━━━');
  const cacheRead = r2.usage?.cacheReadTokens ?? 0;
  const cacheCreated1 = r1.usage?.cacheCreationTokens ?? 0;

  if (cacheCreated1 > 0) {
    console.log(`  ✅ Call 1 primed the cache: cacheCreationTokens=${cacheCreated1}`);
  } else {
    console.log(
      `  ⚠  Call 1 did not create a cache entry (cacheCreationTokens=${cacheCreated1}). ` +
        'Could mean: another run already primed it very recently, or the prompt slipped below the 4K-token threshold.',
    );
  }

  if (cacheRead > 0) {
    console.log(`  ✅ Call 2 READ the cache: cacheReadTokens=${cacheRead}`);
    process.exit(0);
  } else {
    console.error(`  ❌ Call 2 did NOT read the cache: cacheReadTokens=${cacheRead}`);
    console.error(
      '     Investigate: (1) system prompt byte-stable across calls? (2) prefix ≥ 4K tokens? (3) cache_control applied?',
    );
    process.exit(1);
  }
}

function report(n: number, r: EvalResult): void {
  console.log(`  pass=${r.pass}  reason="${r.reason}"`);
  if (r.usage) {
    console.log(
      `  usage: input=${r.usage.inputTokens} output=${r.usage.outputTokens} ` +
        `cacheRead=${r.usage.cacheReadTokens} cacheCreation=${r.usage.cacheCreationTokens}`,
    );
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
