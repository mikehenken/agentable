import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html', {
  waitUntil: 'networkidle',
});
await page.waitForFunction( => window.__galleryReady?.ok === true, { timeout: 60_000 });

const diag = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  const ready = await wb?.whenReady?.(20_000);
  const read = await wb?.runScriptedTool?.('read_canvas', {});
  const placement = document.querySelector(
    'agentable-operator-surface-placement[placement-id="operator-main"]');
  const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
  return {
    ready,
    readOk: read?.ok,
    shapeCount: read?.result?.shapes?.length,
    resizable: document.querySelector('.gallery-resizable-mounted') !== null,
    hasSurface: surface instanceof HTMLElement,
    threadCount: surface?.threads?.length ?? 0,
    hasTextarea: Boolean(surface?.shadowRoot?.querySelector('textarea')),
    galleryResult: window.__operatorGalleryResult,
  };
});

console.log(JSON.stringify(diag, null, 2));
await browser.close;
