import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html?nochrome=1', {
  waitUntil: 'domcontentloaded',
});
await page.waitForFunction( => window.__operatorGalleryResult?.ok === true, {
  timeout: 45_000,
});

const result = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  await wb?.whenReady?.(15_000);

  const diagramDraw = await wb.runScriptedTool('draw_shapes', {
    layout: 'flow',
    diagram: {
      nodes: [{ id: 'a', label: 'A' }],
      edges: [],
    },
    placement: { x: 120, y: 120 },
    style: { fill: 'semi', color: 'blue', size: 'm' },
  });

  const readDiagram = await wb.runScriptedTool('read_canvas', {});
  const domGeo = wb.shadowRoot?.querySelectorAll('[data-shape-type="geo"]')?.length ?? 0;

  await wb.runScriptedTool('clear_agent_drawings', {});

  const boxDraw = await wb.runScriptedTool('draw_shapes', {
    shapes: [
      {
        kind: 'box',
        text: 'Box',
        geometry: { kind: 'rect', x: 200, y: 200, w: 220, h: 140 },
        style: { fill: 'solid', color: 'blue', size: 'm' },
      },
    ],
  });
  const readBox = await wb.runScriptedTool('read_canvas', {});

  return {
    diagramDraw,
    readDiagram: readDiagram?.result?.shapes?.length ?? -1,
    domGeoAfterDiagram: domGeo,
    boxDraw,
    readBox: readBox?.result?.shapes?.length ?? -1,
    domGeoAfterBox: wb.shadowRoot?.querySelectorAll('[data-shape-type="geo"]')?.length ?? 0,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
