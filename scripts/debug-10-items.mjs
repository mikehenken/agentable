import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/10-locale-rtl/index.html?v=debug-items', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});
for (const ms of [2000, 5000, 10000, 15000]) {
  await page.waitForTimeout(ms);
  const snap = await page.evaluate((elapsed) => {
    const panel = document.querySelector('agentable-panel');
    const vl = panel?.shadowRoot?.querySelector('agentable-virtual-list');
    return {
      elapsed,
      text: (panel?.shadowRoot?.textContent ?? '').slice(0, 200),
      itemsLen: vl?.items?.length ?? null,
      error: panel?.shadowRoot?.querySelector('[data-testid="agentable-panel-error"]')?.textContent ?? null,
    };
  }, ms);
  console.log(JSON.stringify(snap));
}
await browser.close;
