import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html?nochrome=1', {
  waitUntil: 'networkidle',
  timeout: 60000,
});
await page.waitForFunction(() => window.__operatorGalleryResult?.ok === true, { timeout: 45000 });
await page.waitForTimeout(1500);

const result = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  await wb?.whenReady?.(15000);

  const attempts = [];

  const simple = await wb?.runScriptedTool?.('draw_shapes', {
    shapes: [
      {
        id: 'simple-box',
        kind: 'box',
        text: 'Simple',
        geometry: { kind: 'rect', x: 80, y: 80, w: 200, h: 120 },
        style: { fill: 'solid', color: 'blue', size: 'm' },
      },
    ],
  });
  let read = await wb?.runScriptedTool?.('read_canvas', {});
  attempts.push({
    name: 'simple-shapes',
    ok: simple?.ok,
    created: simple?.result?.createdShapeIds,
    store: simple?.result?._store,
    readCount: read?.result?.shapes?.length ?? 0,
  });

  await wb?.runScriptedTool?.('clear_agent_drawings', {});

  const diagram = await wb?.runScriptedTool?.('draw_shapes', {
    layout: 'flow',
    diagram: {
      nodes: [{ id: 'n1', label: 'Node', kind: 'box' }],
      edges: [],
    },
    placement: { kind: 'viewport' },
    style: { fill: 'solid', color: 'blue', size: 'm' },
  });
  read = await wb?.runScriptedTool?.('read_canvas', {});
  attempts.push({
    name: 'diagram-flow',
    ok: diagram?.ok,
    created: diagram?.result?.createdShapeIds,
    store: diagram?.result?._store,
    readCount: read?.result?.shapes?.length ?? 0,
  });

  const op = await wb?.runOperatorScriptedTool?.('draw_shapes', {
    shapes: [
      {
        id: 'operator-box',
        kind: 'box',
        text: 'Operator',
        geometry: { kind: 'rect', x: 300, y: 300, w: 200, h: 120 },
        style: { fill: 'solid', color: 'blue', size: 'm' },
      },
    ],
  });
  read = await wb?.runOperatorScriptedTool?.('read_canvas', {});
  attempts.push({
    name: 'operator-shapes',
    ok: op?.ok,
    created: op?.result?.createdShapeIds,
    store: op?.result?._store,
    readCount: read?.result?.shapes?.length ?? 0,
    agentId: op?.result?.agentId,
  });

  return attempts;
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
