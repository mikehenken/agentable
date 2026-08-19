import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html?nochrome=1', {
  waitUntil: 'domcontentloaded',
});
await page.waitForFunction( => window.__operatorGalleryResult?.ok === true, {
  timeout: 45_000,
});

const result = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  await wb?.whenReady?.(15_000);

  const meridianOnly = await wb.runMeridianDemo('wireframe');
  const readMeridian = await wb.runScriptedTool('read_canvas', {});

  return {
    meridianOnly,
    readMeridian: readMeridian?.result?.shapes?.length ?? -1,
    domGeo: wb.shadowRoot?.querySelectorAll('[data-shape-type="geo"]')?.length ?? 0,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
