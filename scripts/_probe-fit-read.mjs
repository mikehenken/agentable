import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html', {
  waitUntil: 'networkidle',
});
await page.waitForFunction( => window.__operatorGalleryResult?.ok === true, { timeout: 45000 });
await page.waitForTimeout(3000);

const result = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  await wb?.whenReady?.(15000);

  const read0 = await wb.runScriptedTool('read_canvas', {});
  const vp = read0.result?.region;

  const draw = await wb.runScriptedTool('draw_shapes', {
    shapes: [
      {
        id: 'fit-test',
        kind: 'box',
        geometry: {
          kind: 'rect',
          x: (vp?.x ?? 0) + 100,
          y: (vp?.y ?? 0) + 100,
          w: 160,
          h: 120,
        },
        style: { fill: 'solid', color: 'orange', size: 'l' },
      },
    ],
  });

  const afterDrawNoFit = await wb.runScriptedTool('read_canvas', {});

  window.dispatchEvent(
    new CustomEvent('agentable:fit-agent-drawing', { detail: { agentId: 'meridian-designer' } }));
  await new Promise((r) => setTimeout(r, 1200));

  const afterFit = await wb.runScriptedTool('read_canvas', {});
  const sr = wb.shadowRoot;

  return {
    vp,
    draw,
    afterDrawNoFit: afterDrawNoFit.result?.shapes?.length ?? 0,
    afterFit: afterFit.result?.shapes?.length ?? 0,
    afterFitShapes: afterFit.result?.shapes?.map((s) => ({ id: s.id, kind: s.kind })) ?? [],
    domGeo: sr?.querySelectorAll('[data-shape-type="geo"]').length ?? 0,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
