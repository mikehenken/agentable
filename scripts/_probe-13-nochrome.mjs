import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;

for (const suffix of ['', '?nochrome=1']) {
  const url = `http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html${suffix}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.__operatorGalleryResult?.ok === true, { timeout: 45000 });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(async (label) => {
    const wb = document.querySelector('agentable-whiteboard');
    await wb?.whenReady?.(15000);
    const meridian = await wb?.runMeridianDemo?.('wireframe');
    const readMer = await wb?.runScriptedTool?.('read_canvas', {});
    const draw = await wb?.runScriptedTool?.('draw_shapes', {
      shapes: [
        {
          id: 'probe-box',
          kind: 'box',
          geometry: { kind: 'rect', x: 120, y: 120, w: 220, h: 140 },
          style: { fill: 'solid', color: 'blue', size: 'm' },
        },
      ],
    });
    const readDraw = await wb?.runScriptedTool?.('read_canvas', {});
    const domGeo = wb?.shadowRoot?.querySelectorAll('[data-shape-type="geo"]')?.length ?? 0;
    return {
      label,
      meridianOk: meridian?.ok,
      meridianShapes: meridian?.summary?.totalShapes,
      readMer: readMer?.result?.shapes?.length ?? 0,
      draw,
      readDraw: readDraw?.result?.shapes?.length ?? 0,
      domGeo,
      resizableChrome: document.querySelector('.gallery-resizable-mounted') !== null,
    };
  }, suffix || 'default');

  console.log(JSON.stringify(result, null, 2));
}

await browser.close;
