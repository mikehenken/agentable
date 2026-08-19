import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
page.on('console', (msg) => {
  if (msg.type === 'error') console.log('ERR', msg.text);
});
await page.goto('http://127.0.0.1:5199/examples/10-locale-rtl/index.html?v=debug-jobs', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});
await page.waitForTimeout(5000);
const snapshot = await page.evaluate(() => {
  const panel = document.querySelector('agentable-panel');
  const text = panel?.shadowRoot?.textContent ?? '';
  return {
    ready: window.__galleryReady,
    textLen: text.length,
    hasJobs: text.includes('Guest Experience Lead'),
    snippet: text.slice(0, 400),
    testIds: Array.from(panel?.shadowRoot?.querySelectorAll('[data-testid]') ?? []).map((el) =>
      el.getAttribute('data-testid')),
  };
});
console.log(JSON.stringify(snapshot, null, 2));
await browser.close;
