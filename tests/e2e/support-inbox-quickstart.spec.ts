import { test, expect } from '@playwright/test';
import {
  attachConsoleGuard,
  filterConsoleErrors,
} from './helpers/galleryHelpers';

declare global {
  interface Window {
    __supportInboxQuickstart?: string;
    __supportInboxReady?: { example: string; ok: boolean };
  }
}

test.describe(' support inbox quickstart', () => {
  test('loads inbox panel from published-pack config-url with zero console errors', async ({ page }) => {
    const consoleErrors = attachConsoleGuard(page);

    await page.goto('/examples/support-inbox-quickstart/index.html');

    await page.waitForFunction(() => window.__supportInboxReady?.example === 'support-inbox-quickstart' && window.__supportInboxReady.ok,
      undefined,
      { timeout: 30_000 });

    await expect(page.locator('agentable-panel')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Northwind support inbox' })).toBeVisible();

    const ready = await page.evaluate(() => window.__supportInboxReady);
    expect(ready?.ok).toBe(true);

    expect(filterConsoleErrors(consoleErrors)).toEqual([]);
  });
});
