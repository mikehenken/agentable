import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html?nochrome=1', {
  waitUntil: 'networkidle',
});
await page.waitForFunction(() => window.__operatorGalleryResult?.ok === true, {
  timeout: 45_000,
});

const result = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  await wb?.whenReady?.(15_000);
  await wb.runOperatorScriptedTool('clear_agent_drawings', {});

  const variants = [
    {
      label: 'no-id',
      args: {
        shapes: [
          {
            kind: 'box',
            text: 'No id',
            geometry: { kind: 'rect', x: 200, y: 200, w: 220, h: 140 },
            style: { fill: 'solid', color: 'blue', size: 'm' },
          },
        ],
      },
    },
    {
      label: 'fresh-id',
      args: {
        shapes: [
          {
            id: `probe-${Date.now}`,
            kind: 'box',
            text: 'Fresh id',
            geometry: { kind: 'rect', x: 200, y: 200, w: 220, h: 140 },
            style: { fill: 'solid', color: 'blue', size: 'm' },
          },
        ],
      },
    },
    {
      label: 'operator-probe-id',
      args: {
        shapes: [
          {
            id: 'operator-probe',
            kind: 'box',
            text: 'Operator sketch',
            geometry: { kind: 'rect', x: 200, y: 200, w: 280, h: 160 },
            style: { fill: 'solid', color: 'blue', size: 'm' },
          },
        ],
      },
    },
  ];

  const out = [];
  for (const variant of variants) {
    await wb.runOperatorScriptedTool('clear_agent_drawings', {});
    const draw = await wb.runOperatorScriptedTool('draw_shapes', variant.args);
    const read = await wb.runOperatorScriptedTool('read_canvas', {});
    out.push({
      label: variant.label,
      drawOk: draw?.ok,
      store: draw?.result?._store,
      createdIds: draw?.result?.createdShapeIds,
      readCount: read?.result?.shapes?.length ?? -1,
      domGeo: wb.shadowRoot?.querySelectorAll('[data-shape-type="geo"]')?.length ?? 0,
    });
  }
  return out;
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
