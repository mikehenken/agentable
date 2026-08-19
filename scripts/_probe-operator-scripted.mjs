import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html', {
  waitUntil: 'networkidle',
});
await page.waitForFunction(() => window.__operatorGalleryResult?.ok === true, { timeout: 45000 });
await page.waitForTimeout(2000);

const catShapes = [
  { id: 'cat-head', kind: 'ellipse', geometry: { kind: 'rect', x: 400, y: 200, w: 140, h: 120 }, style: { fill: 'solid', color: 'orange', size: 'm' } },
  { id: 'cat-body', kind: 'ellipse', geometry: { kind: 'rect', x: 380, y: 330, w: 180, h: 140 }, style: { fill: 'solid', color: 'orange', size: 'm' } },
  { id: 'cat-tail', kind: 'freehand', geometry: { kind: 'points', points: [{ x: 560, y: 400 }, { x: 620, y: 370 }, { x: 660, y: 420 }] }, style: { color: 'orange', size: 'm' } },
];

const result = await page.evaluate(async (shapes) => {
  const wb = document.querySelector('agentable-whiteboard');
  await wb?.whenReady?.(15000);

  const scripted = await wb.runScriptedTool('draw_shapes', { shapes });
  const operator = await wb.runOperatorScriptedTool?.('draw_shapes', {
    shapes: shapes.map((s) => ({...s, id: `op-${s.id}` })),
  });

  window.dispatchEvent(new CustomEvent('agentable:fit-agent-drawing', { detail: { agentId: 'operator' } }));
  await new Promise((r) => setTimeout(r, 1000));

  const read = await wb.runScriptedTool('read_canvas', {});
  const sr = wb.shadowRoot;

  return {
    scripted: { ok: scripted.ok, store: scripted.result?._store, ids: scripted.result?.createdShapeIds },
    operator: { ok: operator?.ok, store: operator?.result?._store, ids: operator?.result?.createdShapeIds },
    readCount: read.result?.shapes?.length ?? 0,
    domAll: sr?.querySelectorAll('[data-shape-type]').length ?? 0,
  };
}, catShapes);

console.log(JSON.stringify(result, null, 2));
await browser.close;
