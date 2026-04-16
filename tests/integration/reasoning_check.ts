/**
 * Deep Reasoning + Format Robustness validation.
 *
 * Three sub-tests:
 *   A. OpenAI at effort='high' (o3-mini) — validates `reasoning_effort` is
 *      accepted by the API and the contract stays intact.
 *   B. Gemini at effort='xhigh' (gemini-2.5-pro) — validates 2.5-Pro's
 *      built-in thinking surface.
 *   C. Gemini markdown-wrap robustness — injects a fake Gemini client that
 *      returns ```json\n{...}\n``` (a known misbehavior of thinking-grade
 *      models) and asserts the provider's fence-stripping logic recovers.
 *
 * Run with:   npx tsx --env-file=.env tests/integration/reasoning_check.ts
 */

import {
  OpenAIProvider,
  GeminiProvider,
  AIProviderError,
  type EvalResult,
} from '../../src';

let failures = 0;
function assert(condition: unknown, message: string): void {
  if (!condition) {
    failures++;
    console.error(`  ❌ ${message}`);
  } else {
    console.log(`  ✅ ${message}`);
  }
}

const TEXT =
  'Our pricing is tiered by seat count — starter is about fifteen dollars per user monthly, and the enterprise tier runs you about four-nine a seat with volume discounts available.';

const CRITERION =
  'names at least two different numeric prices, even if expressed in words';

// ---- A. OpenAI live --------------------------------------------------------

async function testOpenAIHigh(): Promise<void> {
  console.log('\n━━━ A. OpenAI at effort=high (o3-mini) ━━━');
  if (!process.env.OPENAI_API_KEY) {
    console.log('  ⏭  SKIPPED — OPENAI_API_KEY not set');
    return;
  }

  const provider = new OpenAIProvider();
  const started = Date.now();
  let result: EvalResult;
  try {
    result = await provider.evaluate(TEXT, CRITERION, 'satisfies', {
      effort: 'high',
    });
  } catch (err) {
    failures++;
    console.error(`  ❌ OpenAI threw:`, err instanceof Error ? err.message : err);
    return;
  }
  const elapsed = Date.now() - started;

  console.log(`  ⏱  ${elapsed}ms · model=${result.model} · pass=${result.pass}`);
  console.log(`  💬 reason: ${result.reason}`);

  assert(/^o\d/i.test(result.model), `model is an o-series reasoning model (got "${result.model}")`);
  assert(typeof result.pass === 'boolean', '`pass` is boolean');
  assert(typeof result.reason === 'string' && result.reason.length > 0, '`reason` populated');
  assert(result.effort === 'high', '`effort` echoes back as "high"');
  console.log(
    '  ℹ  OpenAI o-series consumes reasoning tokens internally but does not surface chain-of-thought in chat completions — `reasoning` is expected to be undefined.',
  );
}

// ---- B. Gemini live --------------------------------------------------------

async function testGeminiXhigh(): Promise<void> {
  console.log('\n━━━ B. Gemini at effort=xhigh (gemini-2.5-pro) ━━━');
  if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
    console.log('  ⏭  SKIPPED — GOOGLE_API_KEY / GEMINI_API_KEY not set');
    return;
  }

  const provider = new GeminiProvider();
  const started = Date.now();
  let result: EvalResult;
  try {
    result = await provider.evaluate(TEXT, CRITERION, 'satisfies', {
      effort: 'xhigh',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/429|quota|free.?tier/i.test(message)) {
      console.log(`  ⏭  QUOTA-BLOCKED on free tier — not a code defect.`);
      console.log(`     Raw: ${message.slice(0, 200)}...`);
      return;
    }
    failures++;
    console.error(`  ❌ Gemini threw:`, message);
    return;
  }
  const elapsed = Date.now() - started;

  console.log(`  ⏱  ${elapsed}ms · model=${result.model} · pass=${result.pass}`);
  console.log(`  💬 reason: ${result.reason}`);

  assert(/2\.5-pro/.test(result.model), `model is gemini-2.5-pro (got "${result.model}")`);
  assert(typeof result.pass === 'boolean', '`pass` is boolean');
  assert(typeof result.reason === 'string' && result.reason.length > 0, '`reason` populated');
  assert(result.effort === 'xhigh', '`effort` echoes back as "xhigh"');
  console.log(
    '  ℹ  Gemini 2.5 Pro runs thinking internally but does not expose chain-of-thought text in generateContent responses — `reasoning` is expected to be undefined.',
  );
}

// ---- C. Gemini markdown-wrap robustness (offline) --------------------------

async function testGeminiMarkdownFence(): Promise<void> {
  console.log('\n━━━ C. Gemini markdown-wrap robustness (offline) ━━━');

  // Fake client that simulates a thinking model wrapping JSON in ```json fences.
  // This is the exact failure mode src/providers/gemini.ts:extractJson guards
  // against; injecting a controlled response lets us exercise it without the API.
  const cases: Array<{ label: string; payload: string }> = [
    {
      label: '```json ... ``` fences',
      payload: '```json\n{"pass": true, "reason": "Two prices: fifteen and four-nine."}\n```',
    },
    {
      label: '``` ... ``` fences (no language tag)',
      payload: '```\n{"pass": false, "reason": "No numeric value present."}\n```',
    },
    {
      label: 'raw JSON (no fences)',
      payload: '{"pass": true, "reason": "Resolved word-prices to digits."}',
    },
    {
      label: 'JSON with leading/trailing whitespace',
      payload: '   \n  {"pass": true, "reason": "OK"}  \n  ',
    },
  ];

  for (const tc of cases) {
    const fakeClient = {
      getGenerativeModel: () => ({
        generateContent: async () => ({
          response: {
            text: () => tc.payload,
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 10,
              totalTokenCount: 20,
            },
          },
        }),
      }),
    };

    const provider = new GeminiProvider({
      apiKey: 'fake',
      client: fakeClient,
    });

    let result: EvalResult | undefined;
    let caught: unknown;
    try {
      result = await provider.evaluate('dummy', 'dummy', 'satisfies');
    } catch (err) {
      caught = err;
    }

    if (caught) {
      failures++;
      console.error(
        `  ❌ ${tc.label}: threw instead of parsing — ${caught instanceof Error ? caught.message : caught}`,
      );
      continue;
    }

    assert(result !== undefined, `${tc.label}: returned a result`);
    assert(
      result && typeof result.pass === 'boolean',
      `${tc.label}: \`pass\` parsed as boolean`,
    );
    assert(
      result && typeof result.reason === 'string' && result.reason.length > 0,
      `${tc.label}: \`reason\` parsed as string`,
    );
  }

  // Negative case: malformed JSON should raise AIProviderError (not crash).
  console.log('\n  Negative case: truly malformed payload should throw AIProviderError');
  const badClient = {
    getGenerativeModel: () => ({
      generateContent: async () => ({
        response: {
          text: () => 'this is not JSON at all, sorry',
        },
      }),
    }),
  };
  const provider = new GeminiProvider({ apiKey: 'fake', client: badClient });
  let caught: unknown;
  try {
    await provider.evaluate('dummy', 'dummy', 'satisfies');
  } catch (err) {
    caught = err;
  }
  assert(caught instanceof AIProviderError, 'malformed payload raises AIProviderError');
}

// ---- Main ------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Deep reasoning + format robustness — v2.0');

  await testOpenAIHigh();
  await testGeminiXhigh();
  await testGeminiMarkdownFence();

  console.log(`\n━━━ Summary ━━━`);
  console.log(`  Assertion failures: ${failures}`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
