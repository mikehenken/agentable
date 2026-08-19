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
  await wb.runOperatorScriptedTool('clear_agent_drawings', {});

  const draw = await wb.runOperatorScriptedTool('draw_shapes', {
    shapes: [
      {
        id: 'deep-probe',
        kind: 'box',
        text: 'Deep',
        geometry: { kind: 'rect', x: 200, y: 200, w: 220, h: 140 },
        style: { fill: 'solid', color: 'blue', size: 'm' },
      },
    ],
  });

  const readViewport = await wb.runOperatorScriptedTool('read_canvas', {});
  const readHuge = await wb.runOperatorScriptedTool('read_canvas', {
    region: { kind: 'rect', rect: { x: -5000, y: -5000, w: 10000, h: 10000 } },
  });

  return {
    draw,
    readViewport: readViewport?.result?.shapes?.length ?? -1,
    readHuge: readHuge?.result?.shapes?.length ?? -1,
    readHugeIds: readHuge?.result?.shapes?.map((s) => s.id) ?? [],
    domGeo: wb.shadowRoot?.querySelectorAll('[data-shape-type="geo"]')?.length ?? 0,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
