import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html';

async function main {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__galleryReady?.ok === true, { timeout: 45000 });
  await page.waitForFunction(() => window.__operatorGalleryResult?.ok === true, { timeout: 45000 });
  await page.waitForTimeout(1500);

  const diag = await page.evaluate(async () => {
    const host = document.querySelector('agentable-whiteboard');
    if (!(host instanceof HTMLElement) || typeof host.runScriptedTool !== 'function') {
      return { error: 'no host' };
    }
    await host.whenReady?.(10000);
    const read0 = await host.runScriptedTool('read_canvas', {});
    const region = read0.result?.region ?? null;
    const draw = await host.runScriptedTool('draw_shapes', {
      shapes: [
        {
          id: 'probe-center',
          kind: 'box',
          geometry: { kind: 'rect', x: (region?.x ?? 0) + (region?.w ?? 960) 2 - 50, y: (region?.y ?? 0) + (region?.h ?? 640) 2 - 50, w: 100, h: 100 },
          style: { fill: 'solid', color: 'orange', size: 'm' },
        },
      ],
    });
    window.dispatchEvent(new CustomEvent('agentable:fit-agent-drawing', { detail: { agentId: 'operator' } }));
    await new Promise((r) => setTimeout(r, 800));
    const read1 = await host.runScriptedTool('read_canvas', {});
    const read1vp = await host.runScriptedTool('read_canvas', { region: { kind: 'viewport' } });
    const pageCount = host.shadowRoot?.querySelectorAll('[data-shape-type]').length ?? 0;
    return {
      region,
      drawOk: draw.ok,
      created: draw.result?.createdShapeIds,
      read0Count: read0.result?.shapes?.length ?? 0,
      read1Count: read1.result?.shapes?.length ?? 0,
      read1vpCount: read1vp.result?.shapes?.length ?? 0,
      domShapeCount: pageCount,
      store: draw.result?._store,
    };
  });
  console.log(JSON.stringify(diag, null, 2));
  await browser.close;
}

main.catch(console.error);
