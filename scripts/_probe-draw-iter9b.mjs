import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html', {
  waitUntil: 'networkidle',
});
await page.waitForFunction(() => window.__operatorGalleryResult?.ok === true, { timeout: 45_000 });
await page.waitForTimeout(2000);

const result = await page.evaluate(async () => {
  const whiteboard = document.querySelector('agentable-whiteboard');
  await whiteboard?.whenReady?.(15_000);

  const draw = await whiteboard?.runScriptedTool?.('draw_shapes', {
    shapes: [
      {
        kind: 'box',
        geometry: { kind: 'rect', x: 400, y: 300, w: 280, h: 160 },
        style: { fill: 'solid', color: 'blue', size: 'm' },
      },
    ],
  });

  const shapeId = draw?.result?.createdShapeIds?.[0];
  await new Promise((resolve) => setTimeout(resolve, 800));

  const wb = document.querySelector('agentable-whiteboard');
  const root = wb?.shadowRoot;
  const viewport = root?.querySelector('[data-testid="whiteboard-tldraw-viewport"]');
  const tlContainer = root?.querySelector('.tl-container');
  const canvas = tlContainer?.querySelector('canvas');
  const allDivs = tlContainer?.querySelectorAll('[data-shape-type]') ?? [];

  return {
    draw,
    dom: {
      hasViewport: Boolean(viewport),
      hasTlContainer: Boolean(tlContainer),
      hasCanvas: Boolean(canvas),
      shapeNodes: allDivs.length,
      shapeId,
      viewportRect: viewport?.getBoundingClientRect,
    },
    windowKeys: Object.keys(window).filter((k) => k.includes('editor') || k.includes('tldraw')),
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
