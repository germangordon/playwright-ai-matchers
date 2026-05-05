# AGENTS.md

## Project Context

This is **playwright-ai-matchers**, an open-source NPM library that extends Playwright with AI-powered matchers. It is **not a web application** — it is a testing utility library.

## Stack & Tooling

- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js
- **Package manager**: NPM only
- **Build**: `tsc -p tsconfig.build.json`
- **Typecheck**: `tsc -p tsconfig.test.json --noEmit`

## Architecture Rules

### 1. Library, Not an Application

- This is a **testing framework-agnostic library** that extends Playwright's `expect()`.
- **Never** suggest, install, or reference UI frameworks (React, Vue, Angular, Svelte, etc.).
- **Never** add server, CLI app, or web app scaffolding.

### 2. Dependency Discipline & LLM Agnosticism

- The core value of this library is being **100% LLM-agnostic**.
- **No Hard SDK Dependencies:** Never hardcode or require specific provider SDKs (e.g., `@anthropic-ai/sdk`, `openai`) as `dependencies`. If needed, they must be `peerDependencies` or injected dynamically.
- **Interface-First Design:** All AI integrations must rely on a generic standard interface (e.g., Model Context Protocol — MCP) or abstract adapter classes. The library must never assume the user is running Claude, GPT, or a local model.
- **Lightweight:** Do not install external dependencies without asking first. Prefer native Node.js APIs (like `fetch` for generic REST calls to AI endpoints) over bulky third-party wrapper packages.

### 3. Typing & Code Style

- Use **explicit types** on all public APIs, function signatures, and return values. Avoid `any`.
- Prioritize **readable, straightforward code** over clever abstractions or metaprogramming.
- Follow existing patterns in `src/` for file structure, naming, and exports.
- No comments unless they explain non-obvious behavior or trade-offs.

### 4. Paths & Environment

- Keep file paths and environment variables **configurable and relative**.
- Do not hardcode absolute paths, ports, or hostnames.
- The project will integrate with **isolated Docker containers** — assume no local state persistence.

### 5. Testing

- Tests live in `tests/`. Use Playwright Test (`@playwright/test`).
- Do not modify test infrastructure without justification.
- Run `npm run typecheck` before considering any change complete.

## Workflow

1. Read existing code to understand conventions before making changes.
2. Make minimal, focused changes.
3. Run typecheck to validate.
4. Do **not** commit changes unless explicitly asked.
