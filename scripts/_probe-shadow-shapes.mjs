import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html', {
  waitUntil: 'networkidle',
});
await page.waitForFunction(() => window.__operatorGalleryResult?.ok === true, { timeout: 45000 });
await page.waitForTimeout(3000);

const result = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  await wb?.whenReady?.(15000);
  const sr = wb?.shadowRoot;
  const samples = [];

  const draw = await wb?.runScriptedTool?.('draw_shapes', {
    shapes: [
      {
        id: 'x1',
        kind: 'box',
        geometry: { kind: 'rect', x: 200, y: 200, w: 120, h: 80 },
        style: { fill: 'solid', color: 'orange', size: 'm' },
      },
    ],
  });

  for (const waitMs of [0, 500, 1500, 3000]) {
    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
    const read = await wb?.runScriptedTool?.('read_canvas', {});
    samples.push({
      waitMs,
      domGeo: sr?.querySelectorAll('[data-shape-type="geo"]').length ?? 0,
      domAll: sr?.querySelectorAll('[data-shape-type]').length ?? 0,
      readCount: read?.result?.shapes?.length ?? 0,
      hasShell: Boolean(sr?.querySelector('[data-testid="whiteboard-shell"]')),
      hasViewport: Boolean(sr?.querySelector('[data-testid="whiteboard-tldraw-viewport"]')),
      hasTlContainer: Boolean(sr?.querySelector('.tl-container')),
    });
  }

  return {
    drawOk: draw?.ok,
    store: draw?.result?._store,
    created: draw?.result?.createdShapeIds,
    samples,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
