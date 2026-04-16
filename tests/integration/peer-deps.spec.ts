/**
 * Peer-deps "controlled failure" suite.
 *
 * Verifies that when a user instantiates OpenAIProvider or GeminiProvider
 * WITHOUT the corresponding SDK installed, they get the friendly
 * AIProviderError guiding them to `npm install ...` — NOT a generic
 * `MODULE_NOT_FOUND` stack trace.
 *
 * Strategy: authentic "not installed" simulation by renaming the package
 * directory in node_modules for the duration of one evaluate() call. The
 * ESM resolver has no cache hit, fails to find the module, and our
 * dynamic import() falls into the AIProviderError branch — exactly what a
 * brand-new user who ran `npm install playwright-ai-matchers` without
 * installing the SDK would hit.
 *
 * We restore on every exit path (normal completion, error, SIGINT).
 *
 * Run with:   npx tsx tests/integration/peer-deps.spec.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { AIProviderError, OpenAIProvider, GeminiProvider } from '../../src';

const NODE_MODULES = path.resolve(__dirname, '../../node_modules');

let failures = 0;
function assert(condition: unknown, message: string): void {
  if (!condition) {
    failures++;
    console.error(`  ❌ ${message}`);
  } else {
    console.log(`  ✅ ${message}`);
  }
}

type Hidden = { pkg: string; original: string; hidden: string };
const hidden: Hidden[] = [];

function restoreAll(): void {
  while (hidden.length) {
    const h = hidden.pop()!;
    try {
      if (fs.existsSync(h.hidden)) {
        fs.renameSync(h.hidden, h.original);
      }
    } catch (err) {
      console.error(`WARN: failed to restore ${h.pkg}:`, err);
    }
  }
}

process.on('exit', restoreAll);
process.on('SIGINT', () => {
  restoreAll();
  process.exit(130);
});

async function withHiddenPackage<T>(pkg: string, fn: () => Promise<T>): Promise<T> {
  const original = path.join(NODE_MODULES, pkg);
  const hiddenPath = path.join(NODE_MODULES, `.${pkg.replace(/\//g, '_')}.hidden.test`);
  if (!fs.existsSync(original)) {
    throw new Error(
      `Cannot run peer-deps test: ${pkg} is not installed to begin with.`,
    );
  }
  // Move out of the way. Parent dir must exist for nested packages (e.g. @google/...).
  fs.mkdirSync(path.dirname(hiddenPath), { recursive: true });
  fs.renameSync(original, hiddenPath);
  hidden.push({ pkg, original, hidden: hiddenPath });
  try {
    return await fn();
  } finally {
    // Restore ASAP so subsequent tests aren't blocked.
    const idx = hidden.findIndex((h) => h.pkg === pkg);
    if (idx >= 0) {
      const h = hidden.splice(idx, 1)[0];
      if (fs.existsSync(h.hidden)) fs.renameSync(h.hidden, h.original);
    }
  }
}

async function testMissingSDK(params: {
  label: string;
  pkg: string;
  envKey: string;
  fakeKey: string;
  build: () => { evaluate: (...args: unknown[]) => Promise<unknown> };
  expectedHints: string[];
}): Promise<void> {
  console.log(`\n━━━ ${params.label} — simulating missing \`${params.pkg}\` ━━━`);

  const prev = process.env[params.envKey];
  process.env[params.envKey] = params.fakeKey;

  let caught: unknown;
  try {
    await withHiddenPackage(params.pkg, async () => {
      const provider = params.build();
      await provider.evaluate('hello', 'non-empty', 'satisfies');
    });
  } catch (err) {
    caught = err;
  } finally {
    if (prev === undefined) delete process.env[params.envKey];
    else process.env[params.envKey] = prev;
  }

  assert(caught !== undefined, 'an error was thrown');
  assert(
    caught instanceof AIProviderError,
    'error is an instance of AIProviderError (not a raw MODULE_NOT_FOUND)',
  );

  const message = caught instanceof Error ? caught.message : String(caught);
  console.log(`  📝 message: ${message}`);

  for (const hint of params.expectedHints) {
    assert(message.includes(hint), `error message mentions "${hint}"`);
  }

  assert(
    !/MODULE_NOT_FOUND|^Cannot find module/i.test(message),
    'error message is NOT a raw Node MODULE_NOT_FOUND',
  );
}

async function main(): Promise<void> {
  console.log('Peer-deps controlled-failure suite — v2.0');

  await testMissingSDK({
    label: 'OpenAIProvider',
    pkg: 'openai',
    envKey: 'OPENAI_API_KEY',
    fakeKey: 'sk-test-peer-deps',
    build: () => new OpenAIProvider(),
    expectedHints: ["'openai'", 'npm install openai', 'OpenAIProvider'],
  });

  await testMissingSDK({
    label: 'GeminiProvider',
    pkg: '@google/generative-ai',
    envKey: 'GOOGLE_API_KEY',
    fakeKey: 'AIza-test-peer-deps',
    build: () => new GeminiProvider(),
    expectedHints: [
      "'@google/generative-ai'",
      'npm install @google/generative-ai',
      'GeminiProvider',
    ],
  });

  console.log(`\n━━━ Summary ━━━`);
  console.log(`  Assertion failures: ${failures}`);
  if (failures > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  })
  .finally(restoreAll);
