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

  const wire = await wb.runMeridianDemo('wireframe');
  await new Promise((r) => setTimeout(r, 1500));
  const readAfterWire = await wb.runScriptedTool('read_canvas', {});

  const draw = await wb.runOperatorScriptedTool('draw_shapes', {
    shapes: [
      {
        id: 'cat-head',
        kind: 'ellipse',
        geometry: { kind: 'rect', x: 400, y: 200, w: 140, h: 120 },
        style: { fill: 'solid', color: 'orange', size: 'm' },
      },
    ],
  });
  await new Promise((r) => setTimeout(r, 500));
  const readAfterCat = await wb.runScriptedTool('read_canvas', {});

  return {
    wireOk: wire?.ok,
    readAfterWire: readAfterWire.result?.shapes?.length ?? 0,
    drawOk: draw.ok,
    readAfterCat: readAfterCat.result?.shapes?.length ?? 0,
    pageShapes: draw.result?._store?.pageShapeCount,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
