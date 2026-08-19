import { chromium } from 'playwright';

const URL = process.env.DEBUG_URL ?? 'http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html';

const browser = await chromium.launch;
const page = await browser.newPage;
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForTimeout(5000);

const result = await page.evaluate(async () => {
  const host = document.querySelector('agentable-whiteboard');
  if (!(host instanceof HTMLElement) || typeof host.whenReady !== 'function') {
    return { error: 'no host' };
  }
  await host.whenReady(15_000);

  const drawArgs = {
    shapes: [
      {
        kind: 'box',
        geometry: { kind: 'rect', x: 120, y: 120, w: 200, h: 120 },
        style: { color: 'blue', fill: 'semi', size: 'm' },
      },
    ],
  };

  const draw = await host.runOperatorScriptedTool('draw_shapes', drawArgs);
  const readImmediate = await host.runOperatorScriptedTool('read_canvas', {});

  return {
    draw,
    readImmediateCount: readImmediate.result?.shapes?.length ?? null,
    readImmediateShapes: readImmediate.result?.shapes ?? null,
    store: draw.result?._store ?? null,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
