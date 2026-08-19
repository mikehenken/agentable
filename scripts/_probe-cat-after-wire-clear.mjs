import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html', {
  waitUntil: 'networkidle',
});
await page.waitForFunction(() => window.__operatorGalleryResult?.ok === true, { timeout: 45000 });
await page.waitForTimeout(2000);

const result = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  await wb?.whenReady?.(15000);

  await wb.runMeridianDemo('wireframe');
  await new Promise((r) => setTimeout(r, 1500));
  const readWire = await wb.runScriptedTool('read_canvas', {});

  const vp = readWire.result?.region;
  const cx = (vp?.x ?? 0) + (vp?.w ?? 960) 2;
  const cy = (vp?.y ?? 0) + (vp?.h ?? 640) 2;

  await wb.runOperatorScriptedTool('clear_agent_drawings', {});
  await new Promise((r) => setTimeout(r, 500));

  await wb.runOperatorScriptedTool('draw_shapes', {
    shapes: [
      {
        id: 'cat-head',
        kind: 'ellipse',
        geometry: { kind: 'rect', x: cx - 70, y: cy - 120, w: 140, h: 120 },
        style: { fill: 'solid', color: 'orange', size: 'm' },
      },
      {
        id: 'cat-ear-left',
        kind: 'ellipse',
        geometry: { kind: 'rect', x: cx - 78, y: cy - 168, w: 44, h: 52 },
        style: { fill: 'solid', color: 'orange', size: 'm' },
      },
      {
        id: 'cat-body',
        kind: 'ellipse',
        geometry: { kind: 'rect', x: cx - 90, y: cy + 8, w: 180, h: 140 },
        style: { fill: 'solid', color: 'orange', size: 'm' },
      },
    ],
  });

  window.dispatchEvent(
    new CustomEvent('agentable:fit-agent-drawing', { detail: { agentId: 'operator' } }));
  await new Promise((r) => setTimeout(r, 1200));

  const readAfter = await wb.runScriptedTool('read_canvas', {});
  return {
    readWire: readWire.result?.shapes?.length ?? 0,
    readAfter: readAfter.result?.shapes?.length ?? 0,
    orange: readAfter.result?.shapes?.filter((s) => s.props?.color === 'orange').length ?? 0,
    dom: wb.shadowRoot?.querySelectorAll('[data-shape-type]').length ?? 0,
    vp,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
