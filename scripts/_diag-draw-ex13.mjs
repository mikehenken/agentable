import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction( => window.__galleryReady?.ok === true, { timeout: 45_000 });
await page.waitForTimeout(2000);

const diag = await page.evaluate(async () => {
  const host = document.querySelector('agentable-whiteboard');
  if (!(host instanceof HTMLElement) || typeof host.runOperatorScriptedTool !== 'function') {
    return { error: 'no host' };
  }
  await host.whenReady?.(15_000);

  const read0 = await host.runOperatorScriptedTool('read_canvas', {});
  const clear = await host.runOperatorScriptedTool('clear_agent_drawings', {});
  const read1 = await host.runOperatorScriptedTool('read_canvas', {});

  const region = read1.result?.region;
  const vp = region ?? { x: 0, y: 0, w: 960, h: 640 };
  const x = vp.x + Math.max(48, (vp.w - 280) 2);
  const y = vp.y + Math.max(48, (vp.h - 160) 2);

  const draw = await host.runOperatorScriptedTool('draw_shapes', {
    shapes: [
      {
        id: 'operator-probe',
        kind: 'box',
        text: 'Operator sketch',
        geometry: { kind: 'rect', x, y, w: 280, h: 160 },
        style: { fill: 'solid', color: 'blue', size: 'm' },
      },
    ],
  });

  const poll = [];
  for (let i = 0; i < 10; i += 1) {
    const readPoll = await host.runOperatorScriptedTool('read_canvas', {});
    const scriptedRead = await host.runScriptedTool('read_canvas', {
      region: { kind: 'rect', rect: { x: -50000, y: -50000, w: 100000, h: 100000 } },
    });
    poll.push({
      ms: i * 100,
      operatorRead: readPoll.result?.shapes?.length ?? null,
      scriptedRead: scriptedRead.result?.shapes?.length ?? null,
    });
    await new Promise((r) => setTimeout(r, 100));
  }

  const northstarDraw = await host.runScriptedTool('draw_shapes', {
    shapes: [
      {
        kind: 'box',
        text: 'Probe box',
        geometry: { kind: 'rect', x: 80, y: 80, w: 240, h: 120 },
        style: { fill: 'solid', color: 'blue', size: 'm' },
      },
    ],
  });
  const northstarRead = await host.runScriptedTool('read_canvas', {});

  window.dispatchEvent(
    new CustomEvent('agentable:fit-agent-drawing', { detail: { agentId: 'operator' } }));
  await new Promise((r) => setTimeout(r, 600));

  const read2 = await host.runOperatorScriptedTool('read_canvas', {});
  const readHuge = await host.runOperatorScriptedTool('read_canvas', {
    region: { kind: 'rect', rect: { x: -5000, y: -5000, w: 20000, h: 20000 } },
  });

  const domGeo = host.shadowRoot?.querySelectorAll('[data-shape-type="geo"]')?.length ?? 0;
  const tlShape = host.shadowRoot?.querySelectorAll('.tl-shape')?.length ?? 0;

   Probe editor binding via draw tool side effects
  const editorProbe = await host.runOperatorScriptedTool('read_canvas', {
    region: { kind: 'rect', rect: { x, y, w: 280, h: 160 } },
  });

  return {
    read0Count: read0.result?.shapes?.length ?? null,
    clearOk: clear.ok,
    read1Count: read1.result?.shapes?.length ?? null,
    region,
    placement: { x, y },
    draw,
    read2Count: read2.result?.shapes?.length ?? null,
    readHugeCount: readHuge.result?.shapes?.length ?? null,
    readExactRect: editorProbe.result?.shapes?.length ?? null,
    poll,
    northstarDraw,
    northstarReadCount: northstarRead.result?.shapes?.length ?? null,
    domGeo,
    tlShape,
  };
});

console.log(JSON.stringify(diag, null, 2));
await browser.close;
