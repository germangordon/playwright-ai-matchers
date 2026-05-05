# Usage Guide — playwright-ai-matchers

Step-by-step guide for testing AI outputs with Playwright's `expect()`.

This guide assumes you already know Playwright. If you came from the README and want to go deeper, you're in the right place.

---

## 1. The problem we solve

Traditional matchers validate **characters**, not **meaning**:

```ts
// Fragile: breaks if the LLM changes a comma
await expect(response).toContain('Your order was shipped on Tuesday');
```

With LLM outputs, that fails in production all the time. The model says *"We dispatched your order on Tuesday"* and the test fails. The intent is the same; the string isn't.

`playwright-ai-matchers` adds matchers that **validate meaning**:

```ts
await expect(response).toSatisfy(
  'confirms the order was dispatched and provides a date',
);
```

Under the hood, an evaluator LLM (Claude by default) reads the response, decides pass/fail, and — on failure — returns **a human-readable reason** explaining why.

---

## 2. Installation

```bash
npm install --save-dev playwright-ai-matchers
```

Pick **one** provider and install it as a peer dependency:

```bash
# Anthropic Claude (default, recommended for prompt caching + adaptive thinking)
npm install --save-dev @anthropic-ai/sdk

# OpenAI
npm install --save-dev openai

# Google Gemini
npm install --save-dev @google/generative-ai

# Ollama (local, no API key needed — just run `ollama serve`)
# No extra package required
```

Requires `@playwright/test >= 1.40`.

---

## 3. Setup

Export the API key for your chosen provider:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# or OPENAI_API_KEY, or GOOGLE_API_KEY
```

In your spec, a single import registers all matchers:

```ts
import { test, expect } from '@playwright/test';
import 'playwright-ai-matchers';
```

The import is **side-effect**: without it, the matchers don't exist.

---

## 4. The 6 matchers — when to use each

| Matcher | What it validates | When to use it |
|---|---|---|
| `toSatisfy(criterion)` | Arbitrary plain-language criterion | Generic case, default for most things |
| `toMeanSomethingAbout(topic)` | Response is about a topic | Routing validation: "did the bot understand this was a pricing question?" |
| `toHallucinate(context)` | Response invents facts outside the context | RAG, agents, any flow where fidelity matters (use with `.not`) |
| `toBeHelpful()` | Response is substantive, not empty | Detect refusals, errors, short useless replies |
| `toHaveIntent(intent)` | Response performs a communicative intent | Agents: is it actually scheduling? Escalating? Apologizing? |
| `toHaveSentiment(tone)` | Response conveys an emotional tone | Support chatbots, brand tone validation |

### `toSatisfy` — the most flexible

```ts
await expect(response).toSatisfy(
  'explains the structure of a JWT and how it is transmitted',
);
```

Rule: write the criterion **literal and specific**. "Explains well" is useless — "explains the three parts of a JWT and mentions the Authorization header" works.

### `toMeanSomethingAbout` — for routing

```ts
await expect(response).toMeanSomethingAbout('pricing');
await expect(response).not.toMeanSomethingAbout('billing');
```

Useful when testing an intent classifier or chatbot router.

### `toHallucinate` — the money matcher

```ts
const groundTruth = 'The Pro plan costs $20/month. There is no public Enterprise plan.';

// Assert fidelity: the normal case
await expect(respuesta).not.toHallucinate(groundTruth);

// Or validate that you catch an injected hallucination
await expect(respuestaInventada).toHallucinate(groundTruth);
```

You'll almost always use this with `.not`: asserting that the response **does not** invent anything outside the `groundTruth`.

### `toBeHelpful` — detect empty responses

```ts
await expect(response).toBeHelpful();
```

Fails against *"Sorry, I can't help with that"* or *"Great question!"* with no substance. Does **not** fail against refusals **with an alternative** (*"I can't process it directly, but you can go to Settings → Billing"*).

### `toHaveIntent` — for agents

```ts
await expect(response).toHaveIntent('schedule a meeting with the user');
```

Intent = what the response is **doing** communicatively (scheduling, escalating, apologizing), not what topic it's about.

### `toHaveSentiment` — for tone

```ts
await expect(response).toHaveSentiment('empathetic');
await expect(response).toHaveSentiment('reassuring');
await expect(response).not.toHaveSentiment('aggressive');
```

Labels can be any descriptive string: "empathetic", "professional and serious", "apologetic and urgent".

---

## 5. Effort levels — tune cost vs reliability

```ts
await expect(response).toSatisfy('complex criterion', { effort: 'high' });
```

| Effort | When to use |
|---|---|
| `low` | Obvious cases, high volume, fast CI |
| `medium` (default) | Most cases |
| `high` | Ambiguous criteria, borderline cases |
| `xhigh` | Critical reviews, compliance, legal evaluations |

More effort = more LLM reasoning tokens = better verdicts on ambiguous cases, at higher cost and latency.

---

## 6. Providers — when to choose which

| | Claude (default) | OpenAI | Gemini | Ollama |
|---|:---:|:---:|:---:|:---:|
| Prompt caching | ✅ native | ⚠️ auto | ❌ | ❌ |
| Adaptive thinking | ✅ | ✅ | ✅ | ❌ |
| Cost in large suites | $ | $$ | $ | Free |
| Setup | API key + SDK | API key + SDK | API key + SDK | `ollama serve` |
| Usage / reasoning in result | ✅ | ✅ | ✅ | ❌ |

**Default: Claude Opus 4.7.** Prompt caching means that after the first assertions, the rubric (~10k tokens) is cached and subsequent calls are cheap.

**Ollama limitation:** Ollama's OpenAI-compatible API does not expose token usage counts or chain-of-thought reasoning. `EvalResult.usage` and `EvalResult.reasoning` will be `undefined` when using `OllamaProvider`.

To change the global default:

```ts
import { setDefaultProvider, OpenAIProvider } from 'playwright-ai-matchers';

setDefaultProvider(new OpenAIProvider({ model: 'gpt-4o' }));
```

For a single matcher:

```ts
await expect(response).toSatisfy('criterion', {
  provider: new OpenAIProvider({ model: 'gpt-4o' }),
});
```

---

## 7. Common patterns

### Live web — scrape and validate

```ts
test('the landing page says what it claims', async ({ page }) => {
  await page.goto('https://my-site.com');
  await page.waitForLoadState('networkidle').catch(() => {});
  const hero = await page.locator('main').innerText();

  await expect(hero).toSatisfy('mentions the product and its key benefits');
  await expect(hero).toHaveIntent('attract the visitor to a trial or demo');
});
```

### API response — JSON → string

```ts
test('the /support endpoint responds with empathy', async ({ request }) => {
  const r = await request.post('/support', { data: { issue: 'late order' } });
  const { message } = await r.json();

  await expect(message).toHaveSentiment('empathetic');
  await expect(message).toBeHelpful();
});
```

### Chatbot with context — validate fidelity

```ts
test('the bot does not invent data outside the catalog', async () => {
  const catalog = readFileSync('./fixtures/catalog.md', 'utf-8');
  const answer = await chatbot.ask('how much is the Pro plan?');

  await expect(answer).not.toHallucinate(catalog);
  await expect(answer).toMeanSomethingAbout('pricing');
});
```

### The money shot — capture the reason on failure

When a test fails, Playwright shows something like:

```
Error: Expected response to convey "aggressive" sentiment, but it didn't.
Model:     claude-opus-4-7 (effort: medium)
Reason:    Tone is apologetic and empathetic — the opposite of aggressive register.
Received:  "I'm very sorry for the delay..."
```

That `Reason` is gold for triage: it tells you exactly **why** it failed, without re-running the test or digging through logs.

---

## 8. Middleware — intercept evaluations

You can hook into evaluations for logging, PII redaction, text truncation, or custom post-processing:

```ts
import { setMiddleware } from 'playwright-ai-matchers';

setMiddleware({
  async beforeEvaluate(text, criteria, type) {
    // Truncate long responses to save tokens
    if (text.length > 4000) {
      return { text: text.slice(0, 4000) + '…', criteria };
    }
    return { text, criteria };
  },
  async afterEvaluate(result) {
    // Log every evaluation
    console.log(`[${result.model}] ${result.pass ? 'PASS' : 'FAIL'}: ${result.reason}`);
    return result;
  },
});
```

---

## 9. CI (GitHub Actions)

```yaml
- name: Run Playwright tests
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx playwright test
```

**CI tips:**

- Lower `workers` to `1` or `2` if you hit rate limits
- Use `effort: 'low'` for low-signal PRs and `medium` on main
- Claude's prompt caching works **within a run** — not across runs, so don't optimize for that

---

## 10. Cost and latency — be realistic

Each assertion is **one LLM call**:

- **Latency:** ~1-3s with `medium`, 3-8s with `high`
- **Cost:** with Claude Opus 4.7 + caching, ~$0.01-0.03 per assertion in repeated suites
- **Volume:** 500 assertions in daily CI = ~$5-15/month, depending on effort

Don't use these matchers for things a traditional matcher already validates well. `toContain('error')` is still the right tool for checking an exact string.

---

## 11. When NOT to use these matchers

- **Known exact strings:** use `toContain`, `toMatch`, `toEqual`. They're free and instant.
- **DOM element lists:** use Playwright locators.
- **JSON schemas:** use Zod, Ajv, or native `expect.objectContaining` matchers.
- **Performance/latency:** no. These matchers measure meaning, not time.
- **Pure unit tests:** if you can test without an LLM evaluator, do it. Reserve AI matchers for when the output **is** LLM-generated.

---

## 12. Troubleshooting

| Error | Cause | Solution |
|---|---|---|
| `no provider API key detected` | Missing env var | `export ANTHROPIC_API_KEY=...` |
| `Claude did not call submit_evaluation` | Rate limit or truncation | Retry or lower `effort` |
| `Property 'toSatisfy' not found` | Missing side-effect import | Add `import 'playwright-ai-matchers'` to spec |
| `the '@anthropic-ai/sdk' package is required` | SDK not installed | `npm install @anthropic-ai/sdk` |
| `the 'openai' package is required` | SDK not installed | `npm install openai` |

---

## 13. Examples in this repo

- `test/demo.spec.ts` — 4 main matchers against fixed strings
- `examples/ai-validation.spec.ts` — real E2E test against DuckDuckGo Chat

Run the demo:

```bash
set -a; source .env; set +a   # if using a .env
npx playwright test test/demo.spec.ts --reporter=list
```
