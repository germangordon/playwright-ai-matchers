import { test, expect, type Page } from '@playwright/test';
import 'playwright-ai-matchers';
import { setMiddleware, type EvaluationMiddleware } from '../../dist';

test.setTimeout(180000);

const POPUP_BUTTON_TEXTS = [
  'Agree and Continue', 'I Agree', 'Agree', 'Accept All', 'Accept all',
  'Accept', 'Acepto', 'Aceptar', 'Aceptar todo', 'Continue', 'Continuar',
  'Got it', 'Entendido', 'OK', 'Ok', 'Allow all', 'Allow', 'Permitir',
  'Close', 'Cerrar', 'Dismiss', 'No thanks', 'No, gracias',
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
        const ok = await el.click({ timeout: 2000, force: true }).then(() => true).catch(() => false);
        if (ok) { dismissed++; await page.waitForTimeout(300); }
      }
    }
  }
  return dismissed;
}

async function getAIResponse(page: Page, prompt: string): Promise<string> {
  const chatInput = page.locator('textarea, [contenteditable="true"]').first();
  await chatInput.waitFor({ state: 'visible', timeout: 60000 });
  await dismissPopups(page);
  await chatInput.fill(prompt);
  await page.keyboard.press('Enter');

  const getResponseCandidate = () =>
    page.evaluate((userPrompt) => {
      const NOISE = ['Searching the web', 'Hide Reasoning', 'Show Reasoning', 'Agree and Continue', 'Sources'];
      const nodes = Array.from(document.querySelectorAll('[class*="message" i], [data-testid*="message" i], [role="article"], article, li, .reply, .msg, main p, main div'));
      const candidates = nodes
        .map((el) => (el as HTMLElement).innerText?.trim() ?? '')
        .filter((t) => {
          if (t.length < 200) return false;
          if (t.includes(userPrompt)) return false;
          if (NOISE.some((n) => t.startsWith(n) || t === n)) return false;
          const urlLines = (t.match(/^[a-z0-9.-]+\.(com|org|io|net|dev)$/gim) ?? []).length;
          const totalLines = t.split('\n').filter((l: string) => l.trim()).length;
          if (totalLines > 0 && urlLines / totalLines > 0.4) return false;
          return true;
        })
        .sort((a, b) => b.length - a.length);
      return candidates[0] ?? '';
    }, prompt);

  await expect.poll(async () => (await getResponseCandidate()).length, { timeout: 120000, intervals: [1000] }).toBeGreaterThan(200);

  let lastText = '';
  let stableFor = 0;
  const start = Date.now();
  while (Date.now() - start < 120000) {
    const current = await getResponseCandidate();
    if (current === lastText && current.length > 200) {
      stableFor += 1000;
      if (stableFor >= 5000) break;
    } else { stableFor = 0; lastText = current; }
    await page.waitForTimeout(1000);
  }
  return lastText;
}

test.describe('Playwright AI Matchers — Full Demo', () => {
  test('toSatisfy — Semantic validation on AI responses', async ({ page }) => {
    await page.goto('https://duckduckgo.com/?q=DuckDuckGo+AI+Chat&ia=chat');
    await dismissPopups(page);

    const response = await getAIResponse(page, 'What are the 4 pillars of object-oriented programming?');

    await expect(response).toSatisfy('mentions encapsulation, inheritance, polymorphism, and abstraction');
  });

  test('toMeanSomethingAbout — Topic relevance check', async ({ page }) => {
    await page.goto('https://duckduckgo.com/?q=DuckDuckGo+AI+Chat&ia=chat');
    await dismissPopups(page);

    const response = await getAIResponse(page, 'How does TypeScript improve developer experience?');

    await expect(response).toMeanSomethingAbout('type safety and developer productivity');
  });

  test('toHallucinate — Detect fabricated facts', async ({ page }) => {
    await page.goto('https://duckduckgo.com/?q=DuckDuckGo+AI+Chat&ia=chat');
    await dismissPopups(page);

    const response = await getAIResponse(page, 'Tell me about Node.js');

    const context = 'Node.js is a JavaScript runtime built on Chrome V8 engine. It was created by Ryan Dahl in 2009.';
    await expect(response).not.toHallucinate(context);
  });

  test('toBeHelpful — Quality gate for AI responses', async ({ page }) => {
    await page.goto('https://duckduckgo.com/?q=DuckDuckGo+AI+Chat&ia=chat');
    await dismissPopups(page);

    const response = await getAIResponse(page, 'How do I center a div in CSS?');

    await expect(response).toBeHelpful();
  });

  test('toHaveIntent — Communicative intent validation', async ({ page }) => {
    await page.goto('https://duckduckgo.com/?q=DuckDuckGo+AI+Chat&ia=chat');
    await dismissPopups(page);

    const response = await getAIResponse(page, 'I am frustrated that my code keeps breaking. What should I do?');

    await expect(response).toHaveIntent('empathizing and offering troubleshooting steps');
  });

  test('toHaveSentiment — Emotional tone detection', async ({ page }) => {
    await page.goto('https://duckduckgo.com/?q=DuckDuckGo+AI+Chat&ia=chat');
    await dismissPopups(page);

    const response = await getAIResponse(page, 'Congratulations! You just got promoted to senior engineer!');

    await expect(response).toHaveSentiment('enthusiastic and celebratory');
  });

  test('Middleware — Transform inputs before evaluation', async ({ page }) => {
    const middleware: EvaluationMiddleware = {
      beforeEvaluate: async (text, criteria, type) => {
        console.log(`Middleware intercepting: type=${type}`);
        return { text: text.slice(0, 500), criteria };
      },
      afterEvaluate: async (result) => {
        console.log(`Middleware post-processing: pass=${result.pass}, model=${result.model}`);
        return result;
      },
    };
    setMiddleware(middleware);

    await page.goto('https://duckduckgo.com/?q=DuckDuckGo+AI+Chat&ia=chat');
    await dismissPopups(page);

    const response = await getAIResponse(page, 'Explain async/await in JavaScript in 3 sentences.');

    await expect(response).toSatisfy('explains async/await clearly');

    setMiddleware(null);
  });
});
