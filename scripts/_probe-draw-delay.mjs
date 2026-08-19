import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html?nochrome=1', {
  waitUntil: 'domcontentloaded',
});
await page.waitForFunction( => window.__operatorGalleryResult?.ok === true, {
  timeout: 45_000,
});

for (const delay of [0, 2000, 5000, 8000]) {
  const page2 = await browser.newPage;
  await page2.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html?nochrome=1', {
    waitUntil: 'domcontentloaded',
  });
  await page2.waitForFunction( => window.__operatorGalleryResult?.ok === true, {
    timeout: 45_000,
  });
  if (delay > 0) await page2.waitForTimeout(delay);

  const result = await page2.evaluate(async () => {
    const wb = document.querySelector('agentable-whiteboard');
    await wb?.whenReady?.(15_000);
    await wb.runOperatorScriptedTool('clear_agent_drawings', {});
    const draw = await wb.runOperatorScriptedTool('draw_shapes', {
      shapes: [
        {
          kind: 'box',
          text: 'Delay test',
          geometry: { kind: 'rect', x: 200, y: 200, w: 220, h: 140 },
          style: { fill: 'solid', color: 'blue', size: 'm' },
        },
      ],
    });
    const read = await wb.runOperatorScriptedTool('read_canvas', {});
    return {
      drawOk: draw?.ok,
      store: draw?.result?._store,
      read: read?.result?.shapes?.length ?? -1,
      domGeo: wb.shadowRoot?.querySelectorAll('[data-shape-type="geo"]')?.length ?? 0,
    };
  });
  console.log(`delay=${delay}`, JSON.stringify(result));
  await page2.close;
}

await browser.close;
