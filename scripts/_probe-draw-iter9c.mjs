import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html', {
  waitUntil: 'domcontentloaded',
});
await page.waitForFunction(() => window.__operatorGalleryResult?.ok === true, { timeout: 45_000 });
await page.waitForTimeout(2000);

const result = await page.evaluate(async () => {
  const host = document.querySelector('agentable-whiteboard');
  await host?.whenReady?.(15000);

  const attempts = [];

  const explicit = await host?.runScriptedTool?.('draw_shapes', {
    shapes: [{ kind: 'box', geometry: { kind: 'rect', x: 100, y: 100, w: 200, h: 120 }, style: { fill: 'solid', color: 'blue', size: 'm' } }],
  });
  let read = await host?.runScriptedTool?.('read_canvas', {});
  attempts.push({ name: 'explicit', explicit, readCount: read?.result?.shapes?.length ?? 0 });

  await host?.runScriptedTool?.('clear_agent_drawings', {});

  const diagram = await host?.runScriptedTool?.('draw_shapes', {
    layout: 'flow',
    diagram: {
      nodes: [{ id: 'n1', label: 'Probe', kind: 'box' }],
      edges: [],
    },
    placement: { kind: 'viewport' },
    style: { fill: 'solid', color: 'blue', size: 'm' },
  });
  read = await host?.runScriptedTool?.('read_canvas', {});
  attempts.push({ name: 'diagram', diagram, readCount: read?.result?.shapes?.length ?? 0 });

  await new Promise((r) => setTimeout(r, 500));
  window.dispatchEvent(new CustomEvent('agentable:fit-agent-drawing', { detail: { agentId: 'northstar-designer' } }));
  await new Promise((r) => setTimeout(r, 800));
  read = await host?.runScriptedTool?.('read_canvas', {});
  attempts.push({ name: 'after-fit', readCount: read?.result?.shapes?.length ?? 0, region: read?.result?.region });

  return attempts;
});

console.log(JSON.stringify(result, null, 2));
await page.screenshot({ path: 'scripts/_probe-draw-iter9-screen.png', fullPage: false });
await browser.close;
