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
  const read0 = await wb.runScriptedTool('read_canvas', {});
  const vp = read0.result?.region;
  const cx = (vp?.x ?? 0) + (vp?.w ?? 960) 2;
  const cy = (vp?.y ?? 0) + (vp?.h ?? 640) 2;

  await wb.runOperatorScriptedTool('draw_shapes', {
    shapes: [
      {
        id: 'warm-cat-head',
        kind: 'ellipse',
        geometry: { kind: 'rect', x: cx - 70, y: cy - 120, w: 140, h: 120 },
        style: { fill: 'solid', color: 'orange', size: 'm' },
      },
      {
        id: 'warm-cat-body',
        kind: 'ellipse',
        geometry: { kind: 'rect', x: cx - 90, y: cy + 8, w: 180, h: 140 },
        style: { fill: 'solid', color: 'orange', size: 'm' },
      },
      {
        id: 'warm-cat-tail',
        kind: 'freehand',
        geometry: {
          kind: 'points',
          points: [
            { x: cx + 90, y: cy + 70 },
            { x: cx + 150, y: cy + 40 },
            { x: cx + 190, y: cy + 90 },
          ],
        },
        style: { color: 'orange', size: 'm' },
      },
    ],
  });

  const samples = [];
  for (let i = 0; i < 10; i++) {
    window.dispatchEvent(
      new CustomEvent('agentable:fit-agent-drawing', { detail: { agentId: 'operator' } }));
    await new Promise((r) => setTimeout(r, 400));
    const read = await wb.runScriptedTool('read_canvas', {});
    samples.push({ i, count: read.result?.shapes?.length ?? 0 });
  }
  return { vp, cx, cy, samples, dom: wb.shadowRoot?.querySelectorAll('[data-shape-type]').length ?? 0 };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
