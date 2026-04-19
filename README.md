# Playwright AI Matchers

Aserciones semánticas para `expect()` de Playwright, impulsadas por LLMs. Validá **intenciones, veracidad, tono y significado** en lugar de strings exactos.

```ts
import { test, expect } from '@playwright/test';
import 'playwright-ai-matchers';

test('el bot de soporte es empático', async () => {
  const response = 'Lamento mucho la demora, ya escalé tu caso con prioridad.';
  await expect(response).toIAHaveSentiment('empático');
});
```

---

## ¿Por qué?

Los matchers tradicionales (`toContain`, `toMatch`) se rompen contra la variabilidad de los LLMs. No pueden decirte si la respuesta **alucinó un dato**, si **mantiene el tono**, o si **cumple su objetivo** — solo si contiene caracteres.

Esta librería agrega matchers que delegan la validación a un LLM evaluador (Claude, GPT o Gemini), devuelven `pass: boolean` y — cuando fallan — el **motivo exacto** de por qué fallaron.

---

## Instalación

```bash
npm install --save-dev playwright-ai-matchers
```

Peer dependencies (instalá **solo el proveedor que vas a usar**):

```bash
# Anthropic Claude (default, recomendado)
npm install --save-dev @anthropic-ai/sdk

# OpenAI
npm install --save-dev openai

# Google Gemini
npm install --save-dev @google/generative-ai
```

Requiere `@playwright/test >= 1.40`.

---

## Configuración

Exportá **una** API key del proveedor que quieras usar. La librería autodetecta cuál está disponible:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# o
export OPENAI_API_KEY=sk-...
# o
export GOOGLE_API_KEY=AIza...   # (alias: GEMINI_API_KEY)
```

En tu test, un solo import registra todos los matchers:

```ts
import 'playwright-ai-matchers';
```

No hace falta `expect.extend()` ni configurar nada más.

---

## Matchers disponibles

Todos reciben un criterio en lenguaje natural y (opcional) `{ effort, provider }`.

### `toSatisfy(criterion)`
La respuesta cumple un criterio arbitrario expresado en lenguaje natural.

```ts
await expect(response).toSatisfy('explica la estructura de un JWT');
```

### `toMeanSomethingAbout(topic)`
La respuesta trata genuinamente sobre un tema.

```ts
await expect(response).toMeanSomethingAbout('pricing');
await expect(response).not.toMeanSomethingAbout('billing');
```

### `toHallucinate(context)`
La respuesta inventa hechos no presentes en el contexto. Usalo con `.not` para asegurar fidelidad.

```ts
const groundTruth = 'La Primera Junta la presidió Cornelio Saavedra.';
await expect(respuestaFiel).not.toHallucinate(groundTruth);
await expect(respuestaInventada).toHallucinate(groundTruth);
```

### `toBeHelpful()`
La respuesta es sustantiva — no es una negativa, un error, o una respuesta vacía.

```ts
await expect(response).toBeHelpful();
```

### `toIAHaveIntent(intent)`
La respuesta expresa o ejecuta una intención comunicativa.

```ts
await expect(response).toIAHaveIntent('agendar una reunión con el usuario');
```

### `toIAHaveSentiment(sentiment)`
La respuesta transmite un tono emocional.

```ts
await expect(response).toIAHaveSentiment('empático');
```

---

## Effort levels

Cada matcher acepta `{ effort: 'low' | 'medium' | 'high' | 'xhigh' }`. Default: `medium`.

```ts
await expect(response).toSatisfy('el razonamiento es válido', { effort: 'high' });
```

Más effort = más tokens de thinking = respuestas más confiables en casos ambiguos, a mayor costo y latencia.

---

## Proveedores

Si solo exportás una API key, la librería la usa. Si querés forzar uno:

```ts
import { setDefaultProvider, ClaudeProvider } from 'playwright-ai-matchers';

setDefaultProvider(new ClaudeProvider({ model: 'claude-opus-4-7' }));
```

También podés pasar un provider por matcher:

```ts
import { OpenAIProvider } from 'playwright-ai-matchers';

await expect(response).toSatisfy('criterion', {
  provider: new OpenAIProvider({ model: 'gpt-4o' }),
});
```

| Feature         | Claude (Anthropic) | OpenAI | Gemini |
|-----------------|:------------------:|:------:|:------:|
| Semantic match  | ✅                 | ✅     | ✅     |
| Prompt caching  | ✅ nativo          | ⚠️ auto | ❌    |
| Thinking/reasoning | ✅ adaptive     | ✅     | ✅     |
| Streaming       | ✅                 | ✅     | ✅     |

El default es Claude Opus 4.7 por el caching y el thinking adaptativo (pensado para suites grandes).

---

## Costo y latencia

Cada assertion hace **una llamada al LLM**, así que no es gratis ni instantáneo.

- **Latencia**: ~1-3s por assertion con `effort: 'medium'`; 3-8s con `high`.
- **Costo**: con Claude Opus 4.7 + prompt caching en suites repetidas, ~$0.01-0.03 por assertion. Con OpenAI/Gemini variar según modelo.
- **CI**: configurá `workers: 1` o `2` si hitteás rate limits.

---

## Uso en CI (GitHub Actions)

```yaml
- name: Run Playwright tests
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx playwright test
```

---

## Troubleshooting

**`no provider API key detected`**
Exportá `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, o `GOOGLE_API_KEY` antes de correr los tests.

**`Claude did not call submit_evaluation`**
Rate limit o response truncada. Reintentá o bajá `effort` a `low`.

**`Property 'toSatisfy' not found`**
Falta el `import 'playwright-ai-matchers'` en el spec. El import es **side-effect**; sin él los matchers no se registran.

**El matcher recibe un `Locator` en vez de string**
Los matchers esperan `string`. Extrae el texto con `await locator.innerText()` antes.

---

## Ejemplos

Ver `test/demo.spec.ts` para un demo con los 4 matchers principales contra strings fijos.

Ver `examples/` para un test E2E real contra un chat con IA (DuckDuckGo).

---

## Licencia

MIT © Germán Gordón
