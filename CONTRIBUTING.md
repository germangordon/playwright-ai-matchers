# Contributing

## Setup

```bash
git clone https://github.com/your-org/playwright-ai-matchers.git
cd playwright-ai-matchers
npm install
```

## Build

```bash
npm run build
```

Output is written to `dist/`.

## Running tests

Tests require a valid Anthropic API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npx playwright test
```
