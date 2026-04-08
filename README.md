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

## Setup

Import the package once — either in your test file or in a global setup file:

```typescript
// playwright.config.ts  (recommended — applies to all tests)
import './node_modules/playwright-ai-matchers/dist';
// or in a setup file referenced by globalSetup
```

Or per test file:

```typescript
import { test, expect } from '@playwright/test';
import 'playwright-ai-matchers';
```

## Usage

```typescript
import { test, expect } from '@playwright/test';
import 'playwright-ai-matchers';

test('AI chatbot responds correctly to a billing question', async ({ page }) => {
  await page.goto('https://your-app.com/chat');
  await page.locator('#user-input').fill('How much does the Pro plan cost?');
  await page.locator('#send-button').click();
  await page.locator('.ai-response').waitFor();

  const response = await page.locator('.ai-response').textContent();

  // Does the response relate to the right topic?
  await expect(response).toMeanSomethingAbout('billing and pricing');

  // Does it meet a plain-language criterion?
  await expect(response).toSatisfy('should mention a specific price or redirect the user to the pricing page');

  // Does it avoid making up facts not in the context?
  await expect(response).not.toHallucinate('The pro plan costs $49/month');

  // Is it actually useful to the user?
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

## License

MIT
