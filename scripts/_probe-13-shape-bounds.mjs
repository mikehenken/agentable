import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html?nochrome=1', {
  waitUntil: 'networkidle',
  timeout: 60000,
});
await page.waitForFunction( => window.__operatorGalleryResult?.ok === true, { timeout: 45000 });
await page.waitForTimeout(2000);

const result = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  await wb?.whenReady?.(15000);
  await wb?.runOperatorScriptedTool?.('clear_agent_drawings', {});

  const draw = await wb?.runOperatorScriptedTool?.('draw_shapes', {
    shapes: [
      {
        id: 'operator-probe',
        kind: 'box',
        text: 'Operator sketch',
        geometry: { kind: 'rect', x: 100, y: 100, w: 280, h: 160 },
        style: { fill: 'solid', color: 'blue', size: 'm' },
      },
    ],
  });

  const editorInfo = await page.evaluate( => null);

   Access tldraw via canvas container internals
  const canvasEl = document.querySelector('.tl-canvas');
  const wbRect = wb?.getBoundingClientRect?.;

  const readViewport = await wb?.runOperatorScriptedTool?.('read_canvas', { region: { kind: 'viewport' } });
  const readAll = await wb?.runOperatorScriptedTool?.('read_canvas', {
    region: { kind: 'rect', rect: { x: -5000, y: -5000, w: 10000, h: 10000 } },
  });

  return {
    drawOk: draw?.ok,
    store: draw?.result?._store,
    created: draw?.result?.createdShapeIds,
    viewportRegion: readViewport?.result?.region,
    viewportShapeCount: readViewport?.result?.shapes?.length ?? 0,
    allRegionShapeCount: readAll?.result?.shapes?.length ?? 0,
    allShapes: readAll?.result?.shapes?.map((s) => ({ id: s.id, kind: s.kind, geo: s.geometry, agentId: s.agentId })),
    domShapeCount: document.querySelectorAll('.tl-shape').length,
    canvasPresent: !!canvasEl,
    wbSize: wbRect ? { w: wbRect.width, h: wbRect.height }: null,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
