import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html?nochrome=1', {
  waitUntil: 'networkidle',
});
await page.waitForFunction(() => window.__operatorGalleryResult?.ok === true, { timeout: 45000 });
await page.waitForTimeout(1000);

const result = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  await wb?.whenReady?.(15000);

  const args = {
    shapes: [
      {
        id: 'same-args',
        kind: 'box',
        text: 'Same args test',
        geometry: { kind: 'rect', x: 180, y: 180, w: 220, h: 140 },
        style: { fill: 'solid', color: 'blue', size: 'm' },
      },
    ],
  };

  const scripted = await wb?.runScriptedTool?.('draw_shapes', args);
  const readScripted = await wb?.runScriptedTool?.('read_canvas', {});

  await wb?.runScriptedTool?.('clear_agent_drawings', {});

  const operator = await wb?.runOperatorScriptedTool?.('draw_shapes', args);
  const readOperator = await wb?.runOperatorScriptedTool?.('read_canvas', {});

  const meridian = await wb?.runMeridianDemo?.('wireframe');
  const readMeridian = await wb?.runScriptedTool?.('read_canvas', {});

  return {
    scripted,
    readScripted: readScripted?.result?.shapes?.length ?? 0,
    operator,
    readOperator: readOperator?.result?.shapes?.length ?? 0,
    meridianOk: meridian?.ok,
    meridianTotal: meridian?.summary?.totalShapes,
    readMeridian: readMeridian?.result?.shapes?.length ?? 0,
    domGeo: wb?.shadowRoot?.querySelectorAll('[data-shape-type="geo"]')?.length ?? 0,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
