import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html', {
  waitUntil: 'domcontentloaded',
});
await page.waitForFunction( => window.__operatorGalleryResult?.ok === true, { timeout: 45_000 });
await page.waitForTimeout(3000);

const result = await page.evaluate(async () => {
  const placement = document.querySelector(
    'agentable-operator-surface-placement[placement-id="operator-main"]');
  const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
  surface?.selectMode?.('draw');
  surface?.createThread?.;
  const textarea = surface?.shadowRoot?.querySelector('textarea');
  if (textarea instanceof HTMLTextAreaElement) {
    textarea.value = 'draw a cat';
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value')?.set;
    valueSetter?.call(textarea, 'draw a cat');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
  surface?.shadowRoot?.querySelector('[part="composer-submit"]')?.click;
  await new Promise((resolve) => setTimeout(resolve, 12_000));

  const wb = document.querySelector('agentable-whiteboard');
  const ready = await wb?.whenReady?.(5000);
  const thread =
    surface?.threads?.find((entry) => entry.id === surface.activeThreadId) ??
    surface?.threads?.[0];
  const tool = thread?.messages?.find((message) => message.kind === 'tool');
  const read = await wb?.runScriptedTool?.('read_canvas', {});

  return {
    ready,
    tool,
    msgCount: thread?.messages?.length ?? 0,
    readCount: read?.result?.shapes?.length ?? null,
    domGeo: wb?.shadowRoot?.querySelectorAll('[data-shape-type="geo"]').length ?? 0,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
