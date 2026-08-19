import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html', {
  waitUntil: 'networkidle',
});
await page.waitForFunction( => window.__galleryReady?.ok === true, { timeout: 60_000 });
await page.waitForTimeout(1000);

const result = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  await wb?.whenReady?.(15_000);
  await wb?.runOperatorScriptedTool?.('clear_agent_drawings', {});

  const readBefore = await wb?.runOperatorScriptedTool?.('read_canvas', {});
  const draw = await wb?.runOperatorScriptedTool?.('draw_shapes', {
    shapes: [
      {
        id: 'cat-head',
        kind: 'ellipse',
        geometry: { kind: 'rect', x: 400, y: 200, w: 140, h: 120 },
        style: { fill: 'solid', color: 'orange', size: 'm' },
      },
    ],
  });
  const readAfter = await wb?.runOperatorScriptedTool?.('read_canvas', {});

  return {
    before: readBefore?.result?.shapes?.length ?? null,
    draw,
    after: readAfter?.result?.shapes?.length ?? null,
    domGeo: wb?.shadowRoot?.querySelectorAll('[data-shape-type="geo"]').length ?? 0,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
