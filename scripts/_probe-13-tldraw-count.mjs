import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html', {
  waitUntil: 'networkidle',
});
await page.waitForFunction(() => window.__operatorGalleryResult?.ok === true, { timeout: 45000 });
await page.waitForTimeout(1500);

const result = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  await wb?.whenReady?.(15000);

  const tldrawRoots = document.querySelectorAll('.tl-container').length;
  const viewports = document.querySelectorAll('[data-testid="whiteboard-tldraw-viewport"]').length;
  const shells = document.querySelectorAll('[data-testid="whiteboard-shell"]').length;

  const draw = await wb?.runScriptedTool?.('draw_shapes', {
    shapes: [
      {
        id: 'debug-box',
        kind: 'box',
        geometry: { kind: 'rect', x: 100, y: 100, w: 200, h: 120 },
        style: { fill: 'solid', color: 'blue', size: 'm' },
      },
    ],
  });

  await new Promise((r) => setTimeout(r, 500));

  const after = {
    tldrawRoots: document.querySelectorAll('.tl-container').length,
    viewports: document.querySelectorAll('[data-testid="whiteboard-tldraw-viewport"]').length,
    domGeo: wb?.shadowRoot?.querySelectorAll('[data-shape-type="geo"]')?.length ?? 0,
    read: (await wb?.runScriptedTool?.('read_canvas', {}))?.result?.shapes?.length ?? 0,
  };

  return { tldrawRoots, viewports, shells, draw, after };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
