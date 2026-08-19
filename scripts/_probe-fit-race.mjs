import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html', {
  waitUntil: 'networkidle',
});
await page.waitForFunction(() => window.__operatorGalleryResult?.ok === true, {
  timeout: 45_000,
});

const result = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  await wb?.whenReady?.(15_000);

  const read0 = await wb.runOperatorScriptedTool('read_canvas', {});
  const region = read0?.result?.region ?? { x: 0, y: 0, w: 960, h: 640 };

  const drawArgs = {
    shapes: [
      {
        id: 'fit-race-probe',
        kind: 'box',
        text: 'Probe',
        geometry: {
          kind: 'rect',
          x: region.x + 200,
          y: region.y + 200,
          w: 220,
          h: 140,
        },
        style: { fill: 'solid', color: 'blue', size: 'm' },
      },
    ],
  };

  const draw = await wb.runOperatorScriptedTool('draw_shapes', drawArgs);
  const readBeforeFit = await wb.runOperatorScriptedTool('read_canvas', {});

  window.dispatchEvent(
    new CustomEvent('agentable:fit-agent-drawing', { detail: { agentId: 'operator' } }));
  await new Promise((resolve) => setTimeout(resolve, 400));

  const readAfterFit = await wb.runOperatorScriptedTool('read_canvas', {});

  return {
    region,
    drawOk: draw?.ok,
    store: draw?.result?._store,
    readBefore: readBeforeFit?.result?.shapes?.length ?? -1,
    readAfter: readAfterFit?.result?.shapes?.length ?? -1,
    domGeo: wb.shadowRoot?.querySelectorAll('[data-shape-type="geo"]')?.length ?? 0,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
