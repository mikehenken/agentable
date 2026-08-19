import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html?nochrome=1', {
  waitUntil: 'networkidle',
  timeout: 60000,
});
await page.waitForFunction( => window.__operatorGalleryResult?.ok === true, { timeout: 45000 });
await page.waitForTimeout(1500);

const result = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  await wb?.whenReady?.(15000);

  const readBefore = await wb?.runOperatorScriptedTool?.('read_canvas', { region: { kind: 'viewport' } });
  const region = readBefore?.result?.region;

  const drawArgs = {
    shapes: [
      {
        id: 'operator-probe',
        kind: 'box',
        text: 'Operator sketch',
        geometry: {
          kind: 'rect',
          x: (region?.x ?? 0) + 100,
          y: (region?.y ?? 0) + 100,
          w: 280,
          h: 160,
        },
        style: { fill: 'solid', color: 'blue', size: 'm' },
      },
    ],
  };

  const draw = await wb?.runOperatorScriptedTool?.('draw_shapes', drawArgs);
  const readAfter = await wb?.runOperatorScriptedTool?.('read_canvas', { region: { kind: 'viewport' } });

  const editorProbe = await (async () => {
    const { getEditor, inspectBoundEditorStore } = await import('/dist/embed/agentable-whiteboard.js').catch( => ({}));
    return { note: 'dynamic import may fail in gallery' };
  });

  const domProbe = document.querySelector('.tl-shape')?.getBoundingClientRect?.;

  return {
    regionBefore: region,
    readBeforeCount: readBefore?.result?.shapes?.length ?? 0,
    drawOk: draw?.ok,
    drawError: draw?.error,
    created: draw?.result?.createdShapeIds,
    store: draw?.result?._store,
    readAfterCount: readAfter?.result?.shapes?.length ?? 0,
    readAfterShapes: readAfter?.result?.shapes?.map((s) => ({ id: s.id, kind: s.kind, geo: s.geometry })),
    regionAfter: readAfter?.result?.region,
    domShapeCount: document.querySelectorAll('.tl-shape').length,
    domGeoCount: document.querySelectorAll('[data-shape-type="geo"]').length,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
