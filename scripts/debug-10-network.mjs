import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
const failed = [];
page.on('response', (res) => {
  if (res.status >= 400) failed.push(`${res.status} ${res.url}`);
});
await page.goto('http://127.0.0.1:5199/examples/10-locale-rtl/index.html?v=debug-net', {
  waitUntil: 'networkidle',
  timeout: 90000,
});
await page.waitForTimeout(8000);
console.log('failed', failed);
console.log(
  'jobs',
  await page.evaluate(() => {
    const text = document.querySelector('agentable-panel')?.shadowRoot?.textContent ?? '';
    return { hasJobs: text.includes('Guest Experience Lead'), len: text.length };
  }));
await browser.close;
