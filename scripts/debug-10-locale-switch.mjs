import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/10-locale-rtl/index.html?v=debug3', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});
await page.waitForTimeout(2500);

await page.locator('[data-locale="en"]').click;
await page.waitForTimeout(1500);
console.log('after en', JSON.stringify(await page.evaluate( => window.__galleryReady)));

await page.locator('[data-locale="ar"]').click;
await page.waitForTimeout(2000);
console.log(
  'after ar click',
  JSON.stringify(
    await page.evaluate( => ({
      panelLocale: document.getElementById('career-panel')?.getAttribute('locale'),
      docDir: document.documentElement.dir,
      panelDir:
        document.getElementById('career-panel')
          ?.shadowRoot?.querySelector('[dir]')
          ?.getAttribute('dir') ?? null,
      ready: window.__galleryReady,
    }))));

await page.evaluate( => {
  const panel = document.getElementById('career-panel');
  panel?.setAttribute('locale', 'ar');
  panel?.setAttribute('config-url', '/examples/shared/archipelago-locale-ar-config.json');
  document.documentElement.lang = 'ar';
  document.documentElement.dir = 'rtl';
});
await page.waitForTimeout(2000);
console.log('after manual ar', JSON.stringify(await page.evaluate( => window.__galleryReady)));

await browser.close;
