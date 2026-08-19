import { chromium } from 'playwright';

async function probe(url, label) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);

  const result = await page.evaluate(async () => {
    const wb = document.querySelector('agentable-whiteboard');
    await wb?.whenReady?.(15000);
    await wb?.runScriptedTool?.('clear_agent_drawings', {}).catch(() => undefined);

    const draw = await wb?.runScriptedTool?.('draw_shapes', {
      shapes: [
        {
          id: 'probe-box',
          kind: 'box',
          text: 'Probe',
          geometry: { kind: 'rect', x: 200, y: 200, w: 240, h: 140 },
          style: { fill: 'solid', color: 'blue', size: 'm' },
        },
      ],
    });

    const readVp = await wb?.runScriptedTool?.('read_canvas', { region: { kind: 'viewport' } });
    const readHuge = await wb?.runScriptedTool?.('read_canvas', {
      region: { kind: 'rect', rect: { x: -10000, y: -10000, w: 20000, h: 20000 } },
    });

    return {
      drawOk: draw?.ok,
      drawError: draw?.error,
      store: draw?.result?._store,
      created: draw?.result?.createdShapeIds,
      viewport: readVp?.result?.region,
      vpCount: readVp?.result?.shapes?.length ?? 0,
      hugeCount: readHuge?.result?.shapes?.length ?? 0,
      hugeShapes: readHuge?.result?.shapes?.slice(0, 3),
      domShapes: document.querySelectorAll('.tl-shape').length,
    };
  });

  await browser.close;
  return { label, url,...result };
}

const urls = [
  ['08', 'http://127.0.0.1:5199/examples/08-agent-presents/index.html'],
  ['12', 'http://127.0.0.1:5199/examples/12-open-agent-canvas/index.html'],
  ['13', 'http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html?nochrome=1'],
];

for (const [label, url] of urls) {
  try {
    const r = await probe(url, label);
    console.log(JSON.stringify(r, null, 2));
  } catch (err) {
    console.log(JSON.stringify({ label, url, error: String(err) }));
  }
}
