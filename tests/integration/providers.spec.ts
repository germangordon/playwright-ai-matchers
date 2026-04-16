/**
 * Cross-provider contract integration suite.
 *
 * Runs a semantically-ambiguous `toSatisfy`-style evaluation against every
 * provider whose API key is present in the environment, then asserts that:
 *   1. Every provider returns EvalResult with the same shape.
 *   2. `reasoning` is populated for providers that surface chain-of-thought
 *      (Claude adaptive thinking = summarized). OpenAI/Gemini do NOT return
 *      reasoning text in the response payload — that is a provider-side
 *      limitation, not a bug in this library, and is documented as such.
 *
 * Run with:   npx tsx tests/integration/providers.spec.ts
 */

import {
  ClaudeProvider,
  OpenAIProvider,
  GeminiProvider,
  type AIProvider,
  type EvalResult,
  type Effort,
} from '../../src';

// ---- Tiny assertion helpers ------------------------------------------------

let failures = 0;
function assert(condition: unknown, message: string): void {
  if (!condition) {
    failures++;
    console.error(`  ❌ ${message}`);
  } else {
    console.log(`  ✅ ${message}`);
  }
}

function section(title: string): void {
  console.log(`\n━━━ ${title} ━━━`);
}

// ---- Edge-case input -------------------------------------------------------

// Sarcasm + hidden numeric cue. A naive keyword matcher would pass because
// "$49" does not appear; a real semantic evaluator should resolve "four-nine"
// to a numeric price and pass.
const EDGE_CASE_TEXT =
  "Oh SURE, our pricing is a mystery wrapped in an enigma — I'd say the Pro plan runs you about four-nine a month, give or take, if you can tolerate the cryptic checkout page.";

const EDGE_CASE_CRITERION =
  'mentions a specific numeric price, even if expressed in words rather than digits';

// ---- Provider rigs ---------------------------------------------------------

type ProviderRig = {
  name: string;
  envKey: string;
  surfacesReasoning: boolean; // Whether the provider returns chain-of-thought
  build: () => AIProvider;
};

const rigs: ProviderRig[] = [
  {
    name: 'Claude (Anthropic)',
    envKey: 'ANTHROPIC_API_KEY',
    surfacesReasoning: true,
    build: () => new ClaudeProvider(),
  },
  {
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    surfacesReasoning: false,
    build: () => new OpenAIProvider(),
  },
  {
    name: 'Gemini (Google)',
    envKey: 'GOOGLE_API_KEY',
    surfacesReasoning: false,
    build: () => new GeminiProvider(),
  },
];

// ---- Contract validator ----------------------------------------------------

function validateContract(result: EvalResult, rig: ProviderRig, effort: Effort): void {
  assert(typeof result.pass === 'boolean', '`pass` is boolean');
  assert(
    typeof result.reason === 'string' && result.reason.length > 0,
    '`reason` is non-empty string',
  );
  assert(typeof result.model === 'string', '`model` is string');
  assert(result.effort === effort, `\`effort\` echoes back ("${effort}")`);

  if (result.usage) {
    assert(typeof result.usage.inputTokens === 'number', '`usage.inputTokens` is number');
    assert(typeof result.usage.outputTokens === 'number', '`usage.outputTokens` is number');
    assert(
      typeof result.usage.cacheReadTokens === 'number',
      '`usage.cacheReadTokens` is number',
    );
    assert(
      typeof result.usage.cacheCreationTokens === 'number',
      '`usage.cacheCreationTokens` is number',
    );
  } else {
    console.log('  ℹ  usage not reported (provider-specific)');
  }

  if (rig.surfacesReasoning) {
    assert(
      typeof result.reasoning === 'string' && result.reasoning.trim().length > 0,
      `\`reasoning\` populated at effort="${effort}" (provider surfaces chain-of-thought)`,
    );
  } else {
    console.log(
      `  ℹ  reasoning not populated — ${rig.name} SDK does not return chain-of-thought (expected)`,
    );
  }
}

// ---- Main runner -----------------------------------------------------------

async function main(): Promise<void> {
  console.log('Cross-provider contract suite — v2.0');
  console.log('Edge case:', JSON.stringify(EDGE_CASE_TEXT));
  console.log('Criterion:', JSON.stringify(EDGE_CASE_CRITERION));

  const executed: string[] = [];
  const skipped: string[] = [];
  const errored: { name: string; error: string }[] = [];

  for (const rig of rigs) {
    section(rig.name);

    if (!process.env[rig.envKey]) {
      console.log(`  ⏭  SKIPPED — ${rig.envKey} not set`);
      skipped.push(rig.name);
      continue;
    }

    // `medium` is free-tier-friendly on Gemini (flash). Claude still enables
    // adaptive thinking at medium+, so the reasoning assertion below is valid
    // for the one provider that surfaces chain-of-thought.
    const effort: Effort = 'medium';
    let result: EvalResult;
    try {
      const provider = rig.build();
      const started = Date.now();
      result = await provider.evaluate(
        EDGE_CASE_TEXT,
        EDGE_CASE_CRITERION,
        'satisfies',
        { effort },
      );
      const elapsed = Date.now() - started;
      console.log(`  ⏱  ${elapsed}ms · model=${result.model} · pass=${result.pass}`);
      console.log(`  💬  reason: ${result.reason}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ threw: ${message}`);
      errored.push({ name: rig.name, error: message });
      continue;
    }

    validateContract(result, rig, effort);
    executed.push(rig.name);
  }

  // ---- Summary -------------------------------------------------------------

  section('Summary');
  console.log(`  Executed: ${executed.length ? executed.join(', ') : '(none)'}`);
  console.log(`  Skipped:  ${skipped.length ? skipped.join(', ') : '(none)'}`);
  if (errored.length) {
    console.log(`  Errored:`);
    for (const e of errored) console.log(`    - ${e.name}: ${e.error}`);
  }
  console.log(`  Assertion failures: ${failures}`);

  if (failures > 0 || errored.length > 0) {
    process.exit(1);
  }
  if (executed.length === 0) {
    console.log(
      '\n⚠  No provider keys present — set at least ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY to run real validation.',
    );
    process.exit(2);
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
