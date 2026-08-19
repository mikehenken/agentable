import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html', {
  waitUntil: 'networkidle',
});
await page.waitForFunction(() => window.__operatorGalleryResult?.ok === true, { timeout: 45000 });
await page.waitForTimeout(3000);

const result = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  const ready = await wb?.whenReady?.(10000);
  const offlineDraw = await wb?.runOperatorScriptedTool?.('draw_shapes', {
    shapes: [
      {
        id: 'cat-head',
        kind: 'ellipse',
        text: 'head',
        geometry: { kind: 'ellipse', x: 400, y: 200, w: 120, h: 100 },
        style: { fill: 'solid', color: 'blue', size: 'm' },
      },
      {
        id: 'cat-body',
        kind: 'box',
        text: 'body',
        geometry: { kind: 'rect', x: 380, y: 300, w: 160, h: 140 },
        style: { fill: 'solid', color: 'blue', size: 'm' },
      },
    ],
  });
  const read = await wb?.runScriptedTool?.('read_canvas', {});
  return {
    ready,
    offlineDraw,
    readCount: read?.result?.shapes?.length ?? 0,
    domGeo: wb?.shadowRoot?.querySelectorAll('[data-shape-type="geo"]')?.length ?? 0,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
