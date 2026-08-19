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

  const draw = await wb.runOperatorScriptedTool('draw_shapes', {
    shapes: [
      {
        kind: 'box',
        text: 'Fit test',
        geometry: { kind: 'rect', x: 200, y: 200, w: 220, h: 140 },
        style: { fill: 'solid', color: 'blue', size: 'm' },
      },
    ],
  });

  const beforeFit = {
    read: (await wb.runOperatorScriptedTool('read_canvas', {}))?.result?.shapes?.length ?? -1,
    domGeo: wb.shadowRoot?.querySelectorAll('[data-shape-type="geo"]')?.length ?? 0,
  };

  window.dispatchEvent(
    new CustomEvent('agentable:fit-agent-drawing', { detail: { agentId: 'operator' } }));
  await new Promise((r) => setTimeout(r, 500));

  const afterFit = {
    read: (await wb.runOperatorScriptedTool('read_canvas', {}))?.result?.shapes?.length ?? -1,
    domGeo: wb.shadowRoot?.querySelectorAll('[data-shape-type="geo"]')?.length ?? 0,
  };

  return { draw, beforeFit, afterFit };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
