# playwright-ai-matchers

[![npm version](https://badge.fury.io/js/playwright-ai-matchers.svg)](https://www.npmjs.com/package/playwright-ai-matchers)
[![npm downloads](https://img.shields.io/npm/dm/playwright-ai-matchers.svg)](https://www.npmjs.com/package/playwright-ai-matchers)
[![CI](https://github.com/germangordon/playwright-ai-matchers/actions/workflows/ci.yml/badge.svg)](https://github.com/germangordon/playwright-ai-matchers/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Semantic assertions for Playwright's `expect()`, powered by LLMs. Validate **intent, truthfulness, tone, and meaning** instead of exact strings.

```ts
import { test, expect } from '@playwright/test';
import 'playwright-ai-matchers';

test('support bot is empathetic', async ({ page }) => {
  const response = 'I'm so sorry for the delay — I've escalated your case with high priority.';
  await expect(response).toHaveSentiment('empathetic');
});
```

Works with plain strings **and** Playwright Locators — text is extracted automatically:

```ts
await expect(page.locator('.hero')).toSatisfy('has a clear call to action');
```

---

## Why

Traditional matchers (`toContain`, `toMatch`) break against LLM variability. They can't tell you whether a response **hallucinated a fact**, **maintained the right tone**, or **fulfilled its purpose** — only whether specific characters are present.

This library adds matchers that delegate validation to an LLM judge (Claude, GPT, or Gemini), return `pass: boolean`, and — on failure — surface the **exact reason** the verdict was reached.

```
Error: Expected response to convey "empathetic" sentiment, but it didn't.
Model:     claude-opus-4-7 (effort: medium)
Reason:    Tone is purely procedural ("Submit a ticket via the portal") — no acknowledgment of frustration.
Received:  "Submit a ticket via the portal."
```

---

## Installation

```bash
npm install --save-dev playwright-ai-matchers
```

Install the peer dependency for **one** provider:

```bash
# Anthropic Claude (default — recommended for prompt caching + adaptive thinking)
npm install --save-dev @anthropic-ai/sdk

# OpenAI
npm install --save-dev openai

# Google Gemini
npm install --save-dev @google/generative-ai
```

Requires `@playwright/test >= 1.40`.

---

## Setup

Export an API key for the provider you want to use. The library auto-detects which key is present:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# or
export OPENAI_API_KEY=sk-...
# or
export GOOGLE_API_KEY=AIza...   # (alias: GEMINI_API_KEY)
```

One import in your test file registers all matchers:

```ts
import 'playwright-ai-matchers';
```

No `expect.extend()` call needed.

---

## Matchers

All matchers accept a natural-language criterion and an optional `{ effort, provider, retries }` config.

### `toSatisfy(criterion)`
The response meets an arbitrary criterion expressed in plain language.

```ts
await expect(response).toSatisfy('explains the three parts of a JWT');
```

### `toMeanSomethingAbout(topic)`
The response genuinely engages with a topic.

```ts
await expect(response).toMeanSomethingAbout('pricing');
await expect(response).not.toMeanSomethingAbout('billing');
```

### `toHallucinate(context)`
The response invents facts not present in the provided context. Use with `.not` to assert fidelity.

```ts
const groundTruth = 'The Pro plan costs $49/month. No Enterprise plan is publicly listed.';
await expect(response).not.toHallucinate(groundTruth);
```

### `toBeHelpful()`
The response is substantive — not a refusal, error message, or empty reply.

```ts
await expect(response).toBeHelpful();
```

### `toHaveIntent(intent)`
The response expresses or enacts a communicative intent.

```ts
await expect(response).toHaveIntent('scheduling a meeting with the user');
```

### `toHaveSentiment(sentiment)`
The response conveys an emotional tone.

```ts
await expect(response).toHaveSentiment('empathetic');
await expect(response).not.toHaveSentiment('aggressive');
```

---

## Locator support

All matchers accept a Playwright `Locator` in place of a string. The text content is extracted automatically via `innerText()`:

```ts
test('hero section has a clear CTA', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page.locator('main')).toSatisfy('has a clear call to action');
  await expect(page.locator('.hero')).toHaveIntent('attracting visitors to a trial or demo');
});
```

---

## Effort levels

Each matcher accepts `{ effort: 'low' | 'medium' | 'high' | 'xhigh' }`. Default: `medium`.

```ts
await expect(response).toSatisfy('reasoning is logically sound', { effort: 'high' });
```

| Effort | When to use |
|--------|-------------|
| `low` | Obvious cases, high-volume, fast CI |
| `medium` | Most cases (default) |
| `high` | Ambiguous criteria, borderline cases |
| `xhigh` | Critical reviews, compliance, legal evaluations |

Higher effort = more LLM reasoning tokens = better verdicts on hard cases, at higher cost and latency.

---

## Retry logic

Matchers automatically retry on transient API errors. The default is 2 retries with exponential backoff. Override per matcher:

```ts
await expect(response).toSatisfy('criterion', { retries: 3 });
```

Set `retries: 0` to disable retries entirely.

---

## Cross-run caching

Wrap any provider in `CachedProvider` to cache evaluation results to disk between CI runs. Identical inputs (text + criteria + model + effort) return the cached verdict without an API call.

```ts
import { ClaudeProvider, CachedProvider, setDefaultProvider } from 'playwright-ai-matchers';

setDefaultProvider(
  new CachedProvider(new ClaudeProvider(), {
    ttlSeconds: 86400,  // 24 hours
    namespace: 'v1',    // bump this to bust the cache after rubric changes
  })
);
```

Cache files are stored in `.playwright-ai-cache/` in the project root. Add it to `.gitignore`.

---

## Providers

If you export only one API key, the library uses it. To force a provider globally:

```ts
import { setDefaultProvider, ClaudeProvider } from 'playwright-ai-matchers';

setDefaultProvider(new ClaudeProvider({ model: 'claude-opus-4-7' }));
```

Or pass a provider per matcher:

```ts
import { OpenAIProvider } from 'playwright-ai-matchers';

await expect(response).toSatisfy('criterion', {
  provider: new OpenAIProvider({ model: 'gpt-4o' }),
});
```

| Feature | Claude (Anthropic) | OpenAI | Gemini | Ollama (local) |
|---------|:-----------------:|:------:|:------:|:--------------:|
| Semantic evaluation | ✅ | ✅ | ✅ | ✅ |
| Prompt caching | ✅ native | ⚠️ auto | ❌ | ❌ |
| Adaptive thinking | ✅ | ✅ | ✅ | ❌ |
| No API key needed | ❌ | ❌ | ❌ | ✅ |
| Runs offline | ❌ | ❌ | ❌ | ✅ |

Default is Claude Opus 4.7 — prompt caching makes the ~10k-token rubric cheap after the first assertion in a run.

### Ollama — run evaluations locally, no API key

Use any model available in [Ollama](https://ollama.com) without sending data to external APIs:

```bash
# Install Ollama, then pull a model
ollama pull llama3.2
```

```ts
import { setDefaultProvider, OllamaProvider } from 'playwright-ai-matchers';

setDefaultProvider(new OllamaProvider({ model: 'llama3.2' }));
```

Or set environment variables (no code change needed):

```bash
export OLLAMA_MODEL=llama3.2
# optional: export OLLAMA_BASE_URL=http://localhost:11434
```

**Recommended models for evaluation quality:** `llama3.2`, `qwen2.5`, `mistral`, `phi4`, `gemma2`

> **Note:** Local models are less consistent than Claude or GPT-4o on ambiguous criteria. Use `effort: 'high'` for borderline cases and validate your setup with a few known-pass / known-fail examples before relying on results in CI.

---

## Cost & latency

Each assertion makes **one LLM call**.

- **Latency:** ~1–3s with `effort: 'medium'`; 3–8s with `high`
- **Cost:** with Claude Opus 4.7 + prompt caching in repeated suites, ~$0.01–0.03 per assertion
- **CI:** set `workers: 1` or `2` if you hit rate limits
- **Tip:** use `CachedProvider` in CI to avoid re-evaluating identical assertions across runs

---

## CI (GitHub Actions)

```yaml
- name: Run Playwright tests
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx playwright test
```

---

## Troubleshooting

**`no provider API key detected`**
Export `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GOOGLE_API_KEY` before running tests.

**`Claude did not call submit_evaluation`**
Rate limit or truncated response. The matcher will retry automatically (up to `retries` times). Lower `effort` to `low` if it persists.

**`Property 'toSatisfy' not found`**
Missing the `import 'playwright-ai-matchers'` side-effect import in the spec file.

**Matcher receives a `Locator` instead of a string**
Just pass the Locator directly — text extraction is automatic as of v2.1.

---

## Examples

See `test/demo.spec.ts` for a demo with all matchers against fixed strings.

See `examples/` for a real E2E test against an AI chat interface.

See [`docs/GUIDE.md`](docs/GUIDE.md) for the full guide: when to use each matcher, common patterns (live web, APIs, RAG), CI, costs, and troubleshooting.

---

## License

MIT © Germán Gordón
