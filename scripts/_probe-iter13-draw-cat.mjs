import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html', {
  waitUntil: 'networkidle',
});
await page.waitForFunction( => window.__galleryReady?.ok === true, { timeout: 60_000 });
await page.waitForTimeout(1500);

await page.evaluate( => {
  const placement = document.querySelector(
    'agentable-operator-surface-placement[placement-id="operator-main"]');
  const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
  surface?.selectMode?.('draw');
  surface?.createThread?.;
});

await page.waitForFunction(
   => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    return Boolean(
      placement?.shadowRoot
        ?.querySelector('agentable-operator-surface')
        ?.shadowRoot?.querySelector('textarea'));
  },
  { timeout: 30_000 });

await page.evaluate( => {
  const textarea = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]')
    ?.shadowRoot?.querySelector('agentable-operator-surface')
    ?.shadowRoot?.querySelector('textarea');
  if (textarea instanceof HTMLTextAreaElement) {
    textarea.focus;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value')?.set;
    setter?.call(textarea, 'draw a cat');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
});

await page.evaluate( => {
  document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]')
    ?.shadowRoot?.querySelector('agentable-operator-surface')
    ?.shadowRoot?.querySelector('[part="composer-submit"]')
    ?.click;
});

await page.waitForTimeout(8000);

const result = await page.evaluate(async () => {
  const placement = document.querySelector(
    'agentable-operator-surface-placement[placement-id="operator-main"]');
  const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
  const thread =
    surface?.threads?.find((entry) => entry.id === surface.activeThreadId) ??
    surface?.threads?.[0];
  const wb = document.querySelector('agentable-whiteboard');
  const read = await wb?.runScriptedTool?.('read_canvas', {});
  return {
    messages: thread?.messages?.map((m) => ({
      kind: m.kind,
      toolName: m.kind === 'tool' ? m.toolName: undefined,
      ok: m.kind === 'tool' ? m.ok: undefined,
      text: m.kind === 'text' ? m.text?.slice(0, 120): undefined,
    })),
    shapeCount: read?.result?.shapes?.length ?? null,
    domGeo: wb?.shadowRoot?.querySelectorAll('[data-shape-type="geo"]').length ?? 0,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
