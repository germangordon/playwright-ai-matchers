import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 300_000,
  expect: { timeout: 120_000 },
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    video: {
      mode: 'on',
      size: { width: 1280, height: 720 },
    },
    trace: 'off',
    screenshot: 'off',
  },
  reporter: 'list',
});
