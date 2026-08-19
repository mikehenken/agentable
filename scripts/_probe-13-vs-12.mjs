import { chromium } from 'playwright';

async function probe(url, label) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  const result = await page.evaluate(async (pageLabel) => {
    const wb = document.querySelector('agentable-whiteboard');
    if (!(wb instanceof HTMLElement) || typeof wb.whenReady !== 'function') {
      return { pageLabel, error: 'no whiteboard' };
    }
    await wb.whenReady(15000);

    const read0 = await wb.runScriptedTool('read_canvas', {});
    const draw = await wb.runScriptedTool('draw_shapes', {
      shapes: [
        {
          id: 'probe-box',
          kind: 'box',
          text: 'Probe',
          geometry: { kind: 'rect', x: 120, y: 120, w: 220, h: 140 },
          style: { fill: 'solid', color: 'blue', size: 'm' },
        },
      ],
    });
    const read1 = await wb.runScriptedTool('read_canvas', {});
    const domGeo = wb.shadowRoot?.querySelectorAll('[data-shape-type="geo"]')?.length ?? 0;
    const store = draw.result?._store ?? null;

    return {
      pageLabel,
      read0: read0.result?.shapes?.length ?? null,
      drawOk: draw.ok,
      createdIds: draw.result?.createdShapeIds ?? [],
      store,
      read1: read1.result?.shapes?.length ?? null,
      domGeo,
      resizableChrome: document.querySelector('.gallery-resizable-mounted') !== null,
      suppressChat: wb.hasAttribute('suppress-canvas-chat'),
    };
  }, label);

  await browser.close;
  return result;
}

const r12 = await probe(
  'http://127.0.0.1:5199/examples/12-open-agent-canvas/index.html',
  '12');
const r13 = await probe(
  'http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html',
  '13');

console.log(JSON.stringify({ r12, r13 }, null, 2));
