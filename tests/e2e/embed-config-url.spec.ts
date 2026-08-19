import { test, expect } from '@playwright/test';

test.describe('built embed bundle — config-url + reload', () => {
  test('loads config-url without console errors and reload succeeds', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type === 'error') {
        consoleErrors.push(message.text);
      }
    });
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    await page.goto('/harness/index.html');
    await page.waitForFunction(() => customElements.get('agentable-canvas') !== undefined);

    await page.waitForFunction(async () => {
      const el = document.getElementById('canvas');
      return el instanceof HTMLElement && typeof el.reload === 'function';
    });

    await page.evaluate(async () => {
      await window.__embedHarness.reload();
    });

    const reloadOk = await page.evaluate(() => window.__lastConfigReload?.ok === true);
    expect(reloadOk).toBe(true);

    const configUrl = await page.evaluate(() => {
      const el = document.getElementById('canvas');
      return el?.getAttribute('config-url');
    });
    expect(configUrl).toBe('/fixtures/embed-config-static.json');

    const filteredErrors = consoleErrors.filter(
      (line) =>
        !line.includes('not a valid hex') &&
        !line.includes('Gemini') &&
        !line.includes('VITE_GEMINI'));
    expect(filteredErrors, `console errors: ${filteredErrors.join('\n')}`).toEqual([]);
  });
});
