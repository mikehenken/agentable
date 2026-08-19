import { test } from '@playwright/test';

test.use({ viewport: { width: 1900, height: 900 } });

test('adhoc: reveal tldraw crash details after drawing the new fixture', async ({ page }) => {
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message, e.stack));
  page.on('console', (m) => {
    if (m.type === 'error') console.log('CONSOLE ERROR:', m.text);
  });

  await page.goto('/examples/08-agent-presents/index.html');
  await page.getByPlaceholder(/Ask Nova anything/).waitFor({ state: 'visible', timeout: 45_000 });

  await page.getByTestId('starter-chip-card').filter({ hasText: 'Launch sequence' }).click;

  await page.waitForTimeout(3000);

   // Zoom to fit so the whole drawing is visible, then screenshot.
  await page.keyboard.press('Shift+1').catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({
    path: 'C:/Users/mikeh/AppData/Local/Temp/claude/C--Users-mikeh-Projects-unused-landi-landi-store-extension/cf94a0a5-af66-4976-9510-a5a8473978ef/scratchpad/apogee-drawing-check.png',
    fullPage: false,
  });

  const showDetails = page.getByRole('button', { name: 'Show details' });
  if (await showDetails.isVisible().catch(() => false)) {
    await showDetails.click();
    const text = await page.locator('body').innerText;
    console.log('CRASH_PAGE_TEXT_START');
    console.log(text);
    console.log('CRASH_PAGE_TEXT_END');
  } else {
    console.log('No crash boundary visible.');
  }
});
