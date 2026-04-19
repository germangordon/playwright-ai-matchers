import { test, expect, type Page } from '@playwright/test';
import 'playwright-ai-matchers';

test.setTimeout(120000);

const POPUP_BUTTON_TEXTS = [
  'Agree and Continue',
  'I Agree',
  'Agree',
  'Accept All',
  'Accept all',
  'Accept',
  'Acepto',
  'Aceptar',
  'Aceptar todo',
  'Continue',
  'Continuar',
  'Got it',
  'Entendido',
  'OK',
  'Ok',
  'Allow all',
  'Allow',
  'Permitir',
  'Close',
  'Cerrar',
  'Dismiss',
  'No thanks',
  'No, gracias',
];

async function dismissPopups(page: Page): Promise<number> {
  let dismissed = 0;
  for (const label of POPUP_BUTTON_TEXTS) {
    const candidates = [
      page.getByRole('button', { name: label, exact: true }),
      page.getByRole('link', { name: label, exact: true }),
      page.getByText(label, { exact: true }),
    ];
    for (const locator of candidates) {
      const count = await locator.count().catch(() => 0);
      for (let i = 0; i < count; i++) {
        const el = locator.nth(i);
        const visible = await el.isVisible().catch(() => false);
        if (!visible) continue;
        const ok = await el
          .click({ timeout: 2000, force: true })
          .then(() => true)
          .catch(() => false);
        if (ok) {
          dismissed++;
          console.log(`Pop-up cerrado con "${label}"`);
          await page.waitForTimeout(300);
        }
      }
    }
  }
  return dismissed;
}

test('Validación de Alucinaciones y Tono en IA', async ({ page }) => {
  await page.goto('https://duckduckgo.com/?q=DuckDuckGo+AI+Chat&ia=chat');

  await dismissPopups(page);

  const chatInput = page.locator('textarea, [contenteditable="true"]').first();
  await chatInput.waitFor({ state: 'visible', timeout: 60000 });

  await dismissPopups(page);

  await chatInput.fill("Explícame qué es el protocolo MCP de Anthropic.");
  await page.keyboard.press('Enter');

  console.log('Esperando respuesta de la IA...');

  const prompt = "Explícame qué es el protocolo MCP de Anthropic.";

  const getResponseCandidate = () =>
    page.evaluate((userPrompt) => {
      const NOISE = [
        'Searching the web',
        'Hide Reasoning',
        'Show Reasoning',
        'Agree and Continue',
        'Sources',
      ];
      const nodes = Array.from(
        document.querySelectorAll(
          '[class*="message" i], [data-testid*="message" i], [role="article"], article, li, .reply, .msg, main p, main div'
        )
      );
      const candidates = nodes
        .map((el) => (el as HTMLElement).innerText?.trim() ?? '')
        .filter((t) => {
          if (t.length < 200) return false;
          if (t.includes(userPrompt)) return false;
          if (NOISE.some((n) => t.startsWith(n) || t === n)) return false;
          const urlLines = (t.match(/^[a-z0-9.-]+\.(com|org|io|net|dev)$/gim) ?? []).length;
          const totalLines = t.split('\n').filter((l) => l.trim()).length;
          if (totalLines > 0 && urlLines / totalLines > 0.4) return false;
          return true;
        })
        .sort((a, b) => b.length - a.length);
      return candidates[0] ?? '';
    }, prompt);

  await expect
    .poll(async () => (await getResponseCandidate()).length, { timeout: 120000, intervals: [1000] })
    .toBeGreaterThan(200);

  let lastText = '';
  let stableFor = 0;
  const start = Date.now();
  while (Date.now() - start < 120000) {
    const current = await getResponseCandidate();
    if (current === lastText && current.length > 200) {
      stableFor += 1000;
      if (stableFor >= 5000) break;
    } else {
      stableFor = 0;
      lastText = current;
    }
    await page.waitForTimeout(1000);
  }
  const responseText = lastText;
  console.log('¡Respuesta encontrada! Validando con la librería...');
  console.log('Longitud respuesta:', responseText.length);
  console.log('Primeros 300 caracteres:', responseText.slice(0, 300));

  await expect(responseText).toSatisfy(
    "La IA debe haber explicado el protocolo MCP como un sistema de comunicación entre modelos o agentes."
  );
});