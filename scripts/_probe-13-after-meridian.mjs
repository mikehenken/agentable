import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html?nochrome=1', {
  waitUntil: 'networkidle',
});
await page.waitForFunction(() => window.__operatorGalleryResult?.ok === true, { timeout: 45000 });

const result = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  const timeline = [];

  async function snap(label) {
    await wb?.whenReady?.(15000);
    const read = await wb?.runScriptedTool?.('read_canvas', {});
    timeline.push({
      label,
      readCount: read?.result?.shapes?.length ?? 0,
      domGeo: wb?.shadowRoot?.querySelectorAll('[data-shape-type="geo"]')?.length ?? 0,
    });
  }

  await snap('after-ready');

  const mer = await wb?.runMeridianDemo?.('wireframe');
  timeline.push({ label: 'meridian-result', ok: mer?.ok, total: mer?.summary?.totalShapes });
  await snap('after-meridian');

  const draw = await wb?.runOperatorScriptedTool?.('draw_shapes', {
    shapes: [
      {
        id: 'after-meridian',
        kind: 'box',
        geometry: { kind: 'rect', x: 500, y: 500, w: 180, h: 100 },
        style: { fill: 'solid', color: 'blue', size: 'm' },
      },
    ],
  });
  timeline.push({
    label: 'operator-draw-result',
    ok: draw?.ok,
    created: draw?.result?.createdShapeIds,
    store: draw?.result?._store,
  });
  await snap('after-operator-draw');

  return timeline;
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
