import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html', {
  waitUntil: 'networkidle',
});
await page.waitForFunction(() => window.__operatorGalleryResult?.ok === true, { timeout: 45_000 });
await page.waitForTimeout(2000);

const result = await page.evaluate(async () => {
  const whiteboard = document.querySelector('agentable-whiteboard');
  await whiteboard?.whenReady?.(15_000);

  const draw = await whiteboard?.runScriptedTool?.('draw_shapes', {
    shapes: [
      {
        kind: 'box',
        geometry: { kind: 'rect', x: 400, y: 300, w: 280, h: 160 },
        style: { fill: 'solid', color: 'blue', size: 'm' },
      },
    ],
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  const root = whiteboard?.shadowRoot;
  const container = root?.querySelector('.tl-container');
  const geoDom = container?.querySelectorAll('[data-shape-type="geo"]') ?? [];
  const allShapes = container?.querySelectorAll('[data-shape-type]') ?? [];

  const read = await whiteboard?.runScriptedTool?.('read_canvas', {});

  return {
    draw,
    readShapeCount: read?.result?.shapes?.length ?? null,
    domGeoCount: geoDom.length,
    domAllCount: allShapes.length,
    geoBounds: [...geoDom].slice(0, 3).map((el) => {
      const rect = el.getBoundingClientRect;
      return { w: rect.width, h: rect.height, x: rect.x, y: rect.y };
    }),
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
