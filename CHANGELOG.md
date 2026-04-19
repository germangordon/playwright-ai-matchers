# Changelog

## v2.0.0 — 2026-04-20

Primera release estable de la v2: API multi-provider con matchers semánticos.

### Nuevos matchers
- `toSatisfy(criterion)` — valida una respuesta contra un criterio en lenguaje natural.
- `toMeanSomethingAbout(topic)` — valida que la respuesta trate genuinamente sobre un tema.
- `toHallucinate(context)` — detecta hechos inventados contra una fuente de verdad. Usable con `.not`.
- `toBeHelpful()` — valida que la respuesta no sea una negativa, error o respuesta vacía.
- `toIAHaveIntent(intent)` — valida la intención comunicativa.
- `toIAHaveSentiment(sentiment)` — valida el tono emocional.

### Proveedores
- `ClaudeProvider` (default) — Claude Opus 4.7 con prompt caching, thinking adaptive y forced tool use.
- `OpenAIProvider` — GPT-4o / o3-mini.
- `GeminiProvider` — Gemini 2.5.
- Auto-detección por variable de entorno (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`).
- `setDefaultProvider()` y opción `provider` por matcher para overrides.

### Effort levels
- `low | medium | high | xhigh`, default `medium`.

## v0.1.0

- Initial release.
