import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html?nochrome=1', {
  waitUntil: 'domcontentloaded',
});
await page.waitForFunction( => window.__operatorGalleryResult?.ok === true, { timeout: 45000 });

const result = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  await wb?.whenReady?.(15000);

  const meridianFlowArgs = {
    layout: 'flow',
    diagram: {
      nodes: [
        { id: 'nav-bar', label: 'Navigation', kind: 'box' },
        { id: 'hero', label: 'Hero headline', kind: 'box' },
        { id: 'feature-grid', label: 'Feature grid', kind: 'box' },
        { id: 'signup-cta', label: 'Sign up CTA', kind: 'box' },
      ],
      edges: [
        { from: 'nav-bar', to: 'hero', label: 'scroll' },
        { from: 'hero', to: 'feature-grid' },
        { from: 'feature-grid', to: 'signup-cta' },
      ],
    },
    placement: { kind: 'rect', x: 360, y: 48, w: 280, h: 520 },
    style: { fill: 'semi', color: 'violet', size: 'm' },
  };

  const scripted = await wb?.runScriptedTool?.('draw_shapes', meridianFlowArgs);
  const readScripted = await wb?.runScriptedTool?.('read_canvas', {});

  const meridian = await wb?.runMeridianDemo?.('wireframe');
  const readMer = await wb?.runScriptedTool?.('read_canvas', {});

  return {
    scripted,
    readScripted: readScripted?.result?.shapes?.length ?? 0,
    meridianTotal: meridian?.summary?.totalShapes,
    readMer: readMer?.result?.shapes?.length ?? 0,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
