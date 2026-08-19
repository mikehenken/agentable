import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html', {
  waitUntil: 'networkidle',
});
await page.waitForFunction(() => window.__operatorGalleryResult?.ok === true, { timeout: 45000 });

const result = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  await wb?.whenReady?.(15000);

   Warm canvas like example 12 auto-demo
  await wb?.runMeridianDemo?.('wireframe');
  const readWarm = await wb?.runScriptedTool?.('read_canvas', {});

  const withoutId = await wb?.runOperatorScriptedTool?.('draw_shapes', {
    shapes: [
      {
        kind: 'box',
        text: 'No explicit id',
        geometry: { kind: 'rect', x: 700, y: 120, w: 180, h: 100 },
        style: { fill: 'solid', color: 'blue', size: 'm' },
      },
    ],
  });
  const read1 = await wb?.runOperatorScriptedTool?.('read_canvas', {});

  const meridianDirect = await wb?.runScriptedTool?.('draw_shapes', {
    layout: 'flow',
    diagram: {
      nodes: [{ id: 'post-warm', label: 'Post warm', kind: 'box' }],
      edges: [],
    },
    placement: { kind: 'viewport' },
    style: { fill: 'solid', color: 'orange', size: 'm' },
  });
  const read2 = await wb?.runScriptedTool?.('read_canvas', {});

  return {
    warmCount: readWarm?.result?.shapes?.length ?? 0,
    withoutId,
    read1: read1?.result?.shapes?.length ?? 0,
    meridianDirect,
    read2: read2?.result?.shapes?.length ?? 0,
    domGeo: wb?.shadowRoot?.querySelectorAll('[data-shape-type="geo"]')?.length ?? 0,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
