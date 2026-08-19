import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/08-agent-presents/index.html', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__galleryReady?.ok === true, { timeout: 45000 });
await page.waitForTimeout(2000);

const result = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  await wb?.whenReady?.(15000);
  const read0 = await wb?.runScriptedTool?.('read_canvas', {});
  const draw = await wb?.runScriptedTool?.('draw_shapes', {
    shapes: [
      {
        id: 'p8-probe',
        kind: 'box',
        geometry: { kind: 'rect', x: 100, y: 100, w: 200, h: 120 },
        style: { fill: 'solid', color: 'blue', size: 'm' },
      },
    ],
  });
  const read1 = await wb?.runScriptedTool?.('read_canvas', {});
  return {
    read0: read0?.result?.shapes?.length ?? 0,
    draw,
    read1: read1?.result?.shapes?.length ?? 0,
    domGeo: wb?.shadowRoot?.querySelectorAll('[data-shape-type="geo"]')?.length ?? 0,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
