import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html', {
  waitUntil: 'networkidle',
});
await page.waitForFunction( => window.__operatorGalleryResult?.ok === true, { timeout: 45000 });
await page.waitForTimeout(2000);

const result = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  await wb?.whenReady?.(15000);
  const meridian = await wb?.runMeridianDemo?.('wireframe');
  await new Promise((r) => setTimeout(r, 2000));
  const read = await wb?.runScriptedTool?.('read_canvas', {});
  const sr = wb?.shadowRoot;
  return {
    meridianOk: meridian?.ok,
    readCount: read?.result?.shapes?.length ?? 0,
    domGeo: sr?.querySelectorAll('[data-shape-type="geo"]').length ?? 0,
    domAll: sr?.querySelectorAll('[data-shape-type]').length ?? 0,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
