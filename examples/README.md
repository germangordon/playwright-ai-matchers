# Examples

Tests de ejemplo que usan `playwright-ai-matchers` contra servicios reales.

## `ai-validation.spec.ts`

Test E2E contra el chat con IA de DuckDuckGo. Muestra:

- `dismissPopups` — helper para cerrar modales de consentimiento.
- Polling de respuesta streaming hasta que se estabiliza.
- Uso de `toSatisfy` sobre el texto capturado.

**Ojo**: este test depende del DOM de DuckDuckGo y del modelo que ellos sirvan. Si DDG cambia su interfaz, el test se rompe. Está acá como demo visual, no como parte de la suite.

### Correrlo

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npx playwright test examples/ai-validation.spec.ts --headed
```
