import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html', {
  waitUntil: 'networkidle',
});
await page.waitForFunction( => window.__galleryReady?.ok === true, { timeout: 45_000 });
await page.waitForTimeout(3000);
const textarea = await page.evaluate( =>
  Boolean(
    document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]')
      ?.shadowRoot?.querySelector('agentable-operator-surface')
      ?.shadowRoot?.querySelector('textarea')));
console.log('textarea:', textarea);
await browser.close;
