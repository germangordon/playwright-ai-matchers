# Guía de uso — playwright-ai-matchers

Tutorial paso a paso para testear outputs de IA con `expect()` de Playwright.

Esta guía asume que ya conocés Playwright. Si venís del README y querés profundizar, estás en el lugar correcto.

---

## 1. El problema que resolvemos

Los matchers tradicionales validan **caracteres**, no **significado**:

```ts
// Frágil: se rompe si el LLM cambia una coma
await expect(response).toContain('Tu pedido fue enviado el martes');
```

Con outputs de LLM, eso falla en producción todo el tiempo. El modelo dice *"Despachamos tu pedido el martes"* y el test cae. La intención es la misma; el string no.

`playwright-ai-matchers` agrega matchers que **validan el significado**:

```ts
await expect(response).toSatisfy(
  'confirma que el pedido fue despachado y da una fecha',
);
```

Por debajo, un LLM evaluador (Claude por default) lee la respuesta, decide pass/fail, y — cuando falla — te devuelve **la razón en lenguaje natural**.

---

## 2. Instalación

```bash
npm install --save-dev playwright-ai-matchers
```

Elegí **un** proveedor e instalalo como peer:

```bash
# Anthropic Claude (default, recomendado por caching + thinking adaptativo)
npm install --save-dev @anthropic-ai/sdk

# OpenAI
npm install --save-dev openai

# Google Gemini
npm install --save-dev @google/generative-ai
```

Requiere `@playwright/test >= 1.40`.

---

## 3. Configuración

Exportá la API key del proveedor elegido:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# o OPENAI_API_KEY, o GOOGLE_API_KEY
```

En el spec, un solo import registra todos los matchers:

```ts
import { test, expect } from '@playwright/test';
import 'playwright-ai-matchers';
```

El import es **side-effect**: sin él los matchers no existen.

---

## 4. Los 6 matchers — cuándo usar cada uno

| Matcher | Qué valida | Cuándo usarlo |
|---|---|---|
| `toSatisfy(criterio)` | Criterio arbitrario en lenguaje natural | Caso genérico, default para casi todo |
| `toMeanSomethingAbout(tema)` | La respuesta trata sobre un tema | Validar ruteo: "¿el bot entendió que era una consulta de pricing?" |
| `toHallucinate(contexto)` | La respuesta inventa datos fuera del contexto | RAG, agentes, cualquier flujo donde fidelidad importa (usalo con `.not`) |
| `toBeHelpful()` | La respuesta es sustantiva, no vacía | Detectar refusals, errores, respuestas cortas inútiles |
| `toIAHaveIntent(intento)` | La respuesta ejecuta una intención comunicativa | Agentes: ¿realmente está agendando? ¿escalando? ¿disculpándose? |
| `toIAHaveSentiment(tono)` | La respuesta transmite un tono emocional | Chatbots de soporte, validar tono de marca |

### `toSatisfy` — el más flexible

```ts
await expect(response).toSatisfy(
  'explica la estructura de un JWT y cómo se transmite',
);
```

Regla: escribí el criterio **literal y específico**. "Explica bien" no sirve — "explica las tres partes del JWT y menciona el header Authorization" sí.

### `toMeanSomethingAbout` — para ruteo

```ts
await expect(response).toMeanSomethingAbout('pricing');
await expect(response).not.toMeanSomethingAbout('billing');
```

Útil cuando testeás un clasificador de intents o un router de chatbot.

### `toHallucinate` — el matcher más vendedor

```ts
const groundTruth = 'El plan Pro cuesta $20/mes. No hay plan Enterprise público.';

// Asegurar fidelidad: lo normal
await expect(respuesta).not.toHallucinate(groundTruth);

// O validar que detectás una alucinación inyectada
await expect(respuestaInventada).toHallucinate(groundTruth);
```

Casi siempre lo usás con `.not`: afirmás que la respuesta **no** inventa nada fuera del `groundTruth`.

### `toBeHelpful` — detectar respuestas vacías

```ts
await expect(response).toBeHelpful();
```

Falla contra *"Sorry, I can't help with that"* o *"Great question!"* sin sustancia. No falla contra refusals **con alternativa** (*"No puedo procesarlo, pero podés ir a Settings → Billing"*).

### `toIAHaveIntent` — para agentes

```ts
await expect(response).toIAHaveIntent('agendar una reunión con el usuario');
```

Intent = qué está **haciendo** la respuesta (agendando, escalando, disculpándose), no de qué tema habla.

### `toIAHaveSentiment` — para tono

```ts
await expect(response).toIAHaveSentiment('empático');
await expect(response).toIAHaveSentiment('reassuring');
await expect(response).not.toIAHaveSentiment('agresivo');
```

Las etiquetas pueden ser cualquier string descriptivo: "empático", "profesional y serio", "apologético y urgente".

---

## 5. Effort levels — ajustá costo vs confiabilidad

```ts
await expect(response).toSatisfy('criterio complejo', { effort: 'high' });
```

| Effort | Cuándo usarlo |
|---|---|
| `low` | Casos evidentes, alto volumen, CI rápido |
| `medium` (default) | La mayoría de los casos |
| `high` | Criterios ambiguos, casos borderline |
| `xhigh` | Reviews críticas, compliance, evaluaciones legales |

Más effort = más tokens de razonamiento del LLM = mejores veredictos en casos ambiguos, a mayor costo y latencia.

---

## 6. Proveedores — cuándo elegir cuál

| | Claude (default) | OpenAI | Gemini |
|---|:---:|:---:|:---:|
| Prompt caching | ✅ nativo | ⚠️ auto | ❌ |
| Thinking adaptativo | ✅ | ✅ | ✅ |
| Costo en suites grandes | $ | $$ | $ |
| Setup | API key + SDK | API key + SDK | API key + SDK |

**Default: Claude Opus 4.7.** Prompt caching hace que después de las primeras assertions el rubric (~10k tokens) se cachee y las siguientes sean baratas.

Para cambiar el default global:

```ts
import { setDefaultProvider, OpenAIProvider } from 'playwright-ai-matchers';

setDefaultProvider(new OpenAIProvider({ model: 'gpt-4o' }));
```

Para un matcher puntual:

```ts
await expect(response).toSatisfy('criterio', {
  provider: new OpenAIProvider({ model: 'gpt-4o' }),
});
```

---

## 7. Patrones comunes

### Live web — scrapear y validar

```ts
test('la landing habla de lo que dice que habla', async ({ page }) => {
  await page.goto('https://mi-sitio.com');
  await page.waitForLoadState('networkidle').catch(() => {});
  const hero = await page.locator('main').innerText();

  await expect(hero).toSatisfy('menciona el producto y sus beneficios clave');
  await expect(hero).toIAHaveIntent('atraer al visitante a un trial o demo');
});
```

### Respuesta de API — JSON → string

```ts
test('el endpoint de /support responde con empatía', async ({ request }) => {
  const r = await request.post('/support', { data: { issue: 'pedido atrasado' } });
  const { message } = await r.json();

  await expect(message).toIAHaveSentiment('empático');
  await expect(message).toBeHelpful();
});
```

### Chatbot con contexto — validar fidelidad

```ts
test('el bot no inventa data fuera del catálogo', async () => {
  const catalogo = readFileSync('./fixtures/catalogo.md', 'utf-8');
  const respuesta = await chatbot.ask('¿cuánto cuesta el plan Pro?');

  await expect(respuesta).not.toHallucinate(catalogo);
  await expect(respuesta).toMeanSomethingAbout('pricing');
});
```

### El money shot — capturar la razón cuando falla

Cuando un test falla, Playwright muestra algo así:

```
Error: Expected response to convey "agresivo" sentiment, but it didn't.
Model:     claude-opus-4-7 (effort: medium)
Reason:    Tone is apologetic and empathetic — the opposite of aggressive register.
Received:  "Lamento mucho la demora..."
```

Ese `Reason` es oro para triage: te dice exactamente **por qué** falló, sin que tengas que re-ejecutar ni escarbar logs.

---

## 8. CI (GitHub Actions)

```yaml
- name: Run Playwright tests
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx playwright test
```

**Tips para CI:**

- Bajá `workers` a `1` o `2` si te pegás con rate limits
- Usá `effort: 'low'` en PRs de baja señal y `medium` en main
- El caching de Claude funciona **dentro de una corrida** — no entre corridas, así que no optimices por ahí

---

## 9. Costo y latencia — sé realista

Cada assertion es **una llamada al LLM**:

- **Latencia:** ~1-3s con `medium`, 3-8s con `high`
- **Costo:** con Claude Opus 4.7 + caching, ~$0.01-0.03 por assertion en suites repetidas
- **Volumen:** 500 assertions en CI diario = ~$5-15/mes, dependiendo del effort

No uses estos matchers para validar cosas que un matcher tradicional ya valida bien. `toContain('error')` sigue siendo la herramienta correcta para chequear un string exacto.

---

## 10. Cuándo NO usar estos matchers

- **Strings exactos conocidos:** usá `toContain`, `toMatch`, `toEqual`. Son gratis e instantáneos.
- **Listas de elementos del DOM:** usá los locators de Playwright.
- **Schemas de JSON:** usá Zod, Ajv, o los matchers nativos de `expect.objectContaining`.
- **Performance/latencia:** no. Estos matchers miden significado, no tiempo.
- **Tests unitarios puros:** si podés testear sin LLM evaluador, hacelo. Reservá los AI matchers para cuando el output **es** LLM-generado.

---

## 11. Troubleshooting

| Error | Causa | Solución |
|---|---|---|
| `no provider API key detected` | Falta env var | `export ANTHROPIC_API_KEY=...` |
| `Claude did not call submit_evaluation` | Rate limit o truncación | Reintentá o bajá `effort` |
| `Property 'toSatisfy' not found` | Falta el import side-effect | Agregá `import 'playwright-ai-matchers'` al spec |
| El matcher recibe un `Locator` | Pasaste un locator en vez de string | Extraé texto con `await locator.innerText()` primero |

---

## 12. Ejemplos en este repo

- `test/demo.spec.ts` — los 4 matchers principales contra strings fijos
- `test/video-demo.spec.ts` — tour completo con un money shot al final (3 pasan, 1 falla a propósito)
- `test/linkedin-demo.spec.ts` — demo live contra `anthropic.com`
- `examples/ai-validation.spec.ts` — test E2E real contra DuckDuckGo Chat

Corré el demo completo:

```bash
set -a; source .env; set +a   # si usás un .env
npx playwright test test/video-demo.spec.ts --reporter=list
```
