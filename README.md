# 🤖 Playwright AI Matchers v2.0

**Universal AI-Powered Semantic Assertions for Playwright — one API, three frontier providers, zero non-determinism.**

[![npm version](https://img.shields.io/npm/v/playwright-ai-matchers.svg)](https://www.npmjs.com/package/playwright-ai-matchers)
[![npm downloads](https://img.shields.io/npm/dm/playwright-ai-matchers.svg)](https://www.npmjs.com/package/playwright-ai-matchers)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)

Drop-in matchers that extend `expect()` so your test suite can assert the *meaning* of AI-generated output — not just its shape. Stop chasing brittle regexes. Let a frontier model judge the response, then gate CI on the verdict.

```typescript
await expect(chatbotResponse).toSatisfy('mentions a specific, numeric price');
await expect(chatbotResponse).not.toHallucinate(knowledgeBaseArticle);
await expect(chatbotResponse).toIAHaveSentiment('empathetic');
```

---

## Why v2.0?

The v1 line shipped a Claude-only matcher set. v2.0 is a ground-up rewrite around a **provider-agnostic Strategy pattern** — same matchers, pick your LLM.

### 🌐 Truly Agnostic
First-class adapters for **Anthropic Claude**, **OpenAI**, and **Google Gemini**. Ship the same test suite across teams that standardize on different vendors — or A/B your evaluator to measure judge agreement.

### 🧠 Deep Reasoning by Default
v2.0 wires the matcher's `effort` knob straight into each provider's thinking surface: **Claude Opus 4.7 adaptive thinking**, **OpenAI o3 reasoning models**, **Gemini 2.0 Flash Thinking**. Semantic verdicts are backed by chain-of-thought — not a single-pass pattern match.

### 💰 Cost-Efficient by Design
- **Prompt Caching** on Claude: a ~4,800-token rubric is cached across every assertion in a run. 90%+ input-token cost reduction on repeat calls.
- **Structured Outputs** on OpenAI (`json_schema` + `strict: true`) and Gemini (`responseSchema`): eliminates the malformed-JSON retry loop.
- **Forced Tool Use** on Claude (`tool_choice: {type: "tool"}`): deterministic verdict shape, no regex parsing.

### 🔒 Zero-Config, Full Retrocompat
If your v1 suite had `ANTHROPIC_API_KEY` set, **it still works — nothing to change**. Drop in an `OPENAI_API_KEY` or `GOOGLE_API_KEY` and the factory auto-detects the new provider.

---

## Compatibility Matrix

The matcher's `effort` option maps to a model tier inside each provider. Higher effort means deeper reasoning, higher quality, and higher cost — `low` is a fast screener, `xhigh` is the final-judgment tier.

| `effort` | 🟣 Anthropic Claude       | 🟢 OpenAI                 | 🔵 Google Gemini            |
| :------- | :------------------------ | :------------------------ | :-------------------------- |
| `low`    | Opus 4.7 · effort=`low`   | `gpt-4o-mini`             | `gemini-2.5-flash-lite`     |
| `medium` | Opus 4.7 · effort=`medium` *(default)* | `gpt-4o`     | `gemini-2.5-flash`          |
| `high`   | Opus 4.7 · effort=`high`  | `o3-mini` · reasoning=`medium` | `gemini-2.5-pro`       |
| `xhigh`  | Opus 4.7 · effort=`xhigh` | `o3` · reasoning=`high`   | `gemini-2.5-pro`            |

> **Deep reasoning** kicks in at `high` and above across all providers. Below that, models run in fast single-pass mode.

---

## Installation

```bash
npm install playwright-ai-matchers
```

Then install **only** the SDK for the provider(s) you plan to use:

```bash
# Claude
npm install @anthropic-ai/sdk

# OpenAI
npm install openai

# Google Gemini
npm install @google/generative-ai
```

The provider SDKs are declared as **optional peer dependencies** — you don't pay for vendors you don't use.

### Setup

Import the package once in `playwright.config.ts` so all tests pick up the matchers:

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import 'playwright-ai-matchers';

export default defineConfig({
  // your Playwright config
});
```

### Auto-detection via Environment Variables

The factory walks this priority chain on first use:

| Priority | Env Var                               | Provider          |
| :------- | :------------------------------------ | :---------------- |
| 1        | `ANTHROPIC_API_KEY`                   | Claude Opus 4.7   |
| 2        | `OPENAI_API_KEY`                      | OpenAI            |
| 3        | `GOOGLE_API_KEY` *(or `GEMINI_API_KEY`)* | Google Gemini  |

```bash
# .env — set whichever you have, the library picks it up automatically
export ANTHROPIC_API_KEY=sk-ant-...
# or
export OPENAI_API_KEY=sk-proj-...
# or
export GOOGLE_API_KEY=AIza...
```

### Forcing a Specific Provider

If multiple keys are present, or you need to pin to a vendor for a specific run, override the default explicitly:

```typescript
// e.g. in a global setup file
import {
  setDefaultProvider,
  OpenAIProvider,
  GeminiProvider,
  ClaudeProvider,
} from 'playwright-ai-matchers';

// Force OpenAI globally, overriding env-based detection.
setDefaultProvider(new OpenAIProvider({ defaultEffort: 'high' }));
```

Or pin a single assertion:

```typescript
const gemini = new GeminiProvider();
await expect(response).toSatisfy('mentions a refund policy', {
  provider: gemini,
  effort: 'xhigh',
});
```

---

## Usage

All matchers share the same shape: `(criterion, options?)`. The `options` object accepts `{ provider?, effort? }`.

### `toSatisfy` — plain-language assertion

```typescript
import { test, expect } from '@playwright/test';

test('pricing bot quotes a real number', async ({ page }) => {
  await page.goto('/chat');
  await page.getByRole('textbox').fill('How much is the Pro plan?');
  await page.getByRole('button', { name: 'Send' }).click();

  const reply = await page.getByTestId('bot-message').innerText();

  await expect(reply).toSatisfy('mentions a specific monthly price in USD', {
    effort: 'high', // deep reasoning for the price-check gate
  });
});
```

### `toIAHaveIntent` — communicative intent

```typescript
test('outage page apologizes', async ({ page }) => {
  await page.goto('/status');
  const banner = await page.getByTestId('incident-banner').innerText();

  await expect(banner).toIAHaveIntent(
    'apologizing to users for an ongoing service outage',
  );
});
```

### `toIAHaveSentiment` — emotional tone

```typescript
test('support reply is empathetic', async ({ page }) => {
  const reply = await triggerSupportFlow(page, 'I lost access to my account');

  await expect(reply).toIAHaveSentiment('empathetic', { effort: 'medium' });
});
```

<details>
<summary><b>Full matcher reference</b> — click to expand</summary>

| Matcher                        | Signature                              | What it asserts                                                                 |
| :----------------------------- | :------------------------------------- | :------------------------------------------------------------------------------ |
| `toMeanSomethingAbout(topic)`  | `(topic, options?)`                    | The response is genuinely *about* `topic` (not a keyword match).                |
| `toSatisfy(criterion)`         | `(criterion, options?)`                | Free-form plain-language assertion — the primary workhorse.                     |
| `toHallucinate(context)`       | `(context, options?)`                  | Response contains claims not supported by `context`. Use with `.not` to gate.   |
| `toBeHelpful()`                | `(options?)`                           | Not a refusal, error, empty string, or "I can't help with that" boilerplate.    |
| `toIAHaveIntent(intent)`       | `(intent, options?)`                   | Response *enacts* the given communicative intent.                               |
| `toIAHaveSentiment(sentiment)` | `(sentiment, options?)`                | Response conveys the given emotional tone.                                      |

All matchers support `.not` for negation and accept `{ provider, effort }` as the final argument.

</details>

---

## Observability — Rich Failure Messages

When an assertion fails, Playwright's error output shows the **model**, **effort tier**, the **one-sentence verdict reason**, and — when adaptive thinking is enabled — a **snippet of the model's reasoning**. Engineers triaging a failing test see *why* the verdict landed where it did, not just that it failed.

```
Error: Expected response to satisfy: "mentions a specific, numeric price", but it didn't.
Model:     claude-opus-4-7 (effort: high)
Reason:    Response discusses pricing in general terms but names no concrete number or currency.
Reasoning: The response says "our plans are competitively priced" and "get in touch for a quote"
           — both deflect from the price question. The criterion requires a specific numeric
           value (e.g., "$49/month"), which is absent. Verdict: pass=false.
Received:  "Our plans are competitively priced to fit teams of every size. Get in touch for a
           tailored quote!"

  at tests/pricing.spec.ts:14:27
```

Every failed matcher call returns:
- **`model`** — the exact model ID that rendered the verdict (useful for cross-vendor drift investigations)
- **`effort`** — the tier the judge ran at, so you can rerun the same assertion at a higher tier
- **`reason`** — a single-sentence, evidence-anchored justification
- **`reasoning`** — the model's chain-of-thought (Claude adaptive thinking · summarized), truncated to 400 chars
- **`received`** — the artifact under test, verbatim

---

## License

MIT © German Gordon
