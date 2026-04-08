import { test, expect } from '@playwright/test';
import 'playwright-ai-matchers';

test('matchers work with real text', async () => {
  const goodResponse = "The Pro plan costs $49/month and includes unlimited users.";
  const badResponse = "Hi! How can I help you today?";

  await expect(goodResponse).toMeanSomethingAbout('pricing');
  await expect(goodResponse).toSatisfy('mentions a specific price');
  await expect(goodResponse).not.toHallucinate('The Pro plan costs $49/month and includes unlimited users.');
  await expect(goodResponse).toBeHelpful();
  await expect(badResponse).not.toMeanSomethingAbout('pricing');
});
