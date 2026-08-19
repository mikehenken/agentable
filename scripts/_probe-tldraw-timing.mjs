import { chromium } from 'playwright';

async function sample(url, label) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

  const samples = [];
  for (const delay of [0, 500, 1500, 3000, 5000, 8000]) {
    if (delay > 0) await page.waitForTimeout(delay - (samples.length ? samples[samples.length - 1].delay: 0));
    const snap = await page.evaluate(async (d) => {
      const wb = document.querySelector('agentable-whiteboard');
      const ready = typeof wb?.whenReady === 'function' ? await wb.whenReady(1000): false;
      const read = ready ? await wb?.runScriptedTool?.('read_canvas', {}): null;
      return {
        delay: d,
        ready,
        tldrawRoots: document.querySelectorAll('.tl-container').length,
        viewports: document.querySelectorAll('[data-testid="whiteboard-tldraw-viewport"]').length,
        shells: document.querySelectorAll('[data-testid="whiteboard-shell"]').length,
        readCount: read?.result?.shapes?.length ?? null,
        galleryOk: window.__galleryReady?.ok ?? window.__operatorGalleryResult?.ok ?? null,
      };
    }, delay);
    samples.push(snap);
  }

  await browser.close;
  return { label, samples };
}

const r12 = await sample('http://127.0.0.1:5199/examples/12-open-agent-canvas/index.html', '12');
const r13 = await sample('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html?nochrome=1', '13-nochrome');

console.log(JSON.stringify({ r12, r13 }, null, 2));
