import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/p8-agent-draw-demo/index.html', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});
await page.waitForTimeout(8000);

const result = await page.evaluate(async () => {
  const host = document.querySelector('agentable-whiteboard');
  if (!host) return { error: 'no host' };
  await host.whenReady?.(20000);
  const draw = await host.runScriptedTool?.('draw_shapes', {
    shapes: [{ kind: 'box', geometry: { kind: 'rect', x: 200, y: 200, w: 220, h: 140 }, style: { fill: 'solid', color: 'blue', size: 'm' } }],
  });
  const read = await host.runScriptedTool?.('read_canvas', {});
  return { draw, readCount: read?.result?.shapes?.length ?? 0, store: draw?.result?._store };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
