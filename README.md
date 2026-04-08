# playwright-ai-matchers

AI-powered semantic matchers for Playwright's `expect()`. Uses the Anthropic API (Claude) to evaluate non-deterministic AI responses in your end-to-end tests.

## Installation

```bash
npm install playwright-ai-matchers @anthropic-ai/sdk
```

Set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## How it fits into your workflow

1. A developer builds a feature with an AI chatbot
2. You (the QA Engineer) write a test that opens the app, sends a message to the chatbot, and captures the response
3. You use playwright-ai-matchers to assert that the response makes sense — not just that it appeared
4. Playwright runs the test on every push, catching regressions automatically

> You write the test. You decide what question the user asks, what criteria the response must meet, and what ground-truth context to check against. The library gives you the tools — the judgment is yours.

## Setup

Import the package in `playwright.config.ts` to apply it to all tests:

```typescript
// playwright.config.ts  (recommended — applies to all tests)
import { defineConfig } from '@playwright/test';
import 'playwright-ai-matchers';

export default defineConfig({
  // your config here
});
```

Or per test file:

```typescript
import { test, expect } from '@playwright/test';
import 'playwright-ai-matchers';
```

## Usage

You write the test. You decide what question the user asks, what criteria the response must meet, and what ground-truth context to check against. The library gives you the tools — the judgment is yours.

```typescript
import { test, expect } from '@playwright/test';
import 'playwright-ai-matchers';

test('chatbot correctly answers a delivery status question', async ({ page }) => {
  await page.goto('https://your-app.com/chat');
  await page.locator('.chat-input').fill('Where is my order?');
  await page.locator('.send-button').click();
  await page.locator('.chat-response').waitFor();

  const response = await page.locator('.chat-response').textContent();

  await expect(response).toMeanSomethingAbout('order status');
  await expect(response).toSatisfy('should mention an order number or estimated delivery time');
  await expect(response).not.toHallucinate('Order #4521 is on its way, arrives in 20 minutes');
  await expect(response).toBeHelpful();
});
```

## Matchers

### `toMeanSomethingAbout(topic: string)`

Asserts the response meaningfully relates to the given topic.

```typescript
await expect(response).toMeanSomethingAbout('refund policy');
await expect(response).not.toMeanSomethingAbout('competitor products');
```

### `toSatisfy(criterion: string)`

Asserts the response satisfies a plain-language criterion. Write it like a requirement.

```typescript
await expect(response).toSatisfy('should acknowledge the user by name');
await expect(response).toSatisfy('must not recommend any specific third-party service');
```

### `toHallucinate(context: string)`

Asserts whether the response invents facts not present in the provided context. Typically used with `.not` to guard against hallucination.

```typescript
// Assert the chatbot didn't invent facts outside our knowledge base snippet
await expect(response).not.toHallucinate(
  'Our Pro plan is $49/month. Our Enterprise plan has custom pricing.'
);

// Assert that a response about a fictional topic does hallucinate
await expect(response).toHallucinate('');
```

### `toBeHelpful()`

Asserts the response is a genuine, useful answer — not an error message, a flat refusal, or an empty reply.

```typescript
await expect(response).toBeHelpful();
await expect(errorFallback).not.toBeHelpful();
```

## Error messages

When a matcher fails, the error shows exactly what went wrong:

```
Error: Expected response to mean something about "billing and pricing", but it didn't.
Reason:   The response discusses general greetings and does not address billing, pricing, or payment topics.
Received: Hi! I'm here to help. What would you like to know today?
```

## Example output

**Passing test:**

```
✓ AI chatbot responds correctly to a billing question (6.3s)
```

**Failing test:**

```
Error: Expected response to mean something about "billing and pricing", but it didn't.
Reason:   The response discusses general greetings and does not address billing, pricing, or payment topics.
Received: Hi! I'm here to help. What would you like to know today?
```

## How it works

Each matcher sends the response text to **Claude Haiku** (`claude-haiku-4-5-20251001`) with a carefully crafted evaluation prompt. Claude returns `{ "pass": boolean, "reason": string }` which drives the assertion result and failure message.

API calls are made at assertion time — one Claude call per matcher invocation. Failures include the AI's reasoning so you know exactly why an assertion failed.

## TypeScript

Full type declarations are included. After importing `playwright-ai-matchers`, all four matchers appear in autocomplete on `expect()`.

```typescript
import 'playwright-ai-matchers';

// ✅ TypeScript knows about these:
await expect(text).toMeanSomethingAbout('...');
await expect(text).toSatisfy('...');
await expect(text).not.toHallucinate('...');
await expect(text).toBeHelpful();
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |

## Limitations

Each matcher makes one API call to Claude at assertion time. Tests with many matchers will run slower and incur Anthropic API costs proportional to the number of assertions.

## License

MIT
