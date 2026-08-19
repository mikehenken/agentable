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

  await wb?.runMeridianDemo?.('document');
  await new Promise((r) => setTimeout(r, 1500));

  const readBefore = await wb.runScriptedTool('read_canvas', {});
  const draw = await wb.runScriptedTool('draw_shapes', {
    shapes: [
      {
        id: 'after-doc',
        kind: 'box',
        geometry: { kind: 'rect', x: 400, y: 400, w: 120, h: 80 },
        style: { fill: 'solid', color: 'orange', size: 'm' },
      },
    ],
  });
  await new Promise((r) => setTimeout(r, 1000));
  const readAfter = await wb.runScriptedTool('read_canvas', {});
  const sr = wb.shadowRoot;

  return {
    readBefore: readBefore.result?.shapes?.length ?? 0,
    drawOk: draw.ok,
    store: draw.result?._store,
    readAfter: readAfter.result?.shapes?.length ?? 0,
    domGeo: sr?.querySelectorAll('[data-shape-type="geo"]').length ?? 0,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
