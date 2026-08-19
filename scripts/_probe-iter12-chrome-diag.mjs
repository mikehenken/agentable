import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html', {
  waitUntil: 'domcontentloaded',
});
await page.waitForFunction( => window.__operatorGalleryResult?.ok === true, { timeout: 45_000 });
await page.waitForTimeout(4000);

const diag = await page.evaluate( => {
  const placement = document.querySelector(
    'agentable-operator-surface-placement[placement-id="operator-main"]');
  const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
  const textarea = surface?.shadowRoot?.querySelector('textarea');
  return {
    resizable: document.querySelector('.gallery-resizable-mounted') !== null,
    placementInRailInner: document.querySelector('.operator-rail-inner agentable-operator-surface-placement') !== null,
    hasSurface: surface instanceof HTMLElement,
    hasTextarea: textarea instanceof HTMLTextAreaElement,
    threadCount: surface?.threads?.length ?? 0,
    wbReadyAttr: document.querySelector('agentable-whiteboard')?.whenReady !== undefined,
  };
});
console.log(JSON.stringify(diag, null, 2));
await browser.close;
