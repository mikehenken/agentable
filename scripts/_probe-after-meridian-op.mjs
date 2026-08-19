import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html?nochrome=1', {
  waitUntil: 'networkidle',
});
await page.waitForFunction( => window.__operatorGalleryResult?.ok === true, {
  timeout: 45_000,
});

const result = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  await wb?.whenReady?.(15_000);

  const meridian = await wb.runMeridianDemo('wireframe');
  const readAfterMeridian = await wb.runOperatorScriptedTool('read_canvas', {});

  const operatorDraw = await wb.runOperatorScriptedTool('draw_shapes', {
    shapes: [
      {
        id: 'after-meridian',
        kind: 'box',
        text: 'Op',
        geometry: { kind: 'rect', x: 100, y: 100, w: 200, h: 120 },
        style: { fill: 'solid', color: 'blue', size: 'm' },
      },
    ],
  });
  const readAfterOp = await wb.runOperatorScriptedTool('read_canvas', {});

  return {
    meridianOk: meridian?.ok,
    meridianTotal: meridian?.summary?.totalShapes,
    readAfterMeridian: readAfterMeridian?.result?.shapes?.length,
    operatorDraw,
    readAfterOp: readAfterOp?.result?.shapes?.length,
    agentIds: readAfterOp?.result?.shapes?.map((s) => s.agentId),
    domGeo: wb.shadowRoot?.querySelectorAll('[data-shape-type="geo"]')?.length,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
