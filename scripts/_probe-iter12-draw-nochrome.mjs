import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html?nochrome=1', {
  waitUntil: 'domcontentloaded',
});
await page.waitForFunction( => window.__operatorGalleryResult?.ok === true, { timeout: 45_000 });

await page.evaluate( => {
  const placement = document.querySelector(
    'agentable-operator-surface-placement[placement-id="operator-main"]');
  const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
  surface?.selectMode?.('draw');
  surface?.createThread?.;
  const textarea = placement?.shadowRoot
    ?.querySelector('agentable-operator-surface')
    ?.shadowRoot?.querySelector('textarea');
  textarea?.focus;
});
await page.keyboard.type('draw a cat');
await page.keyboard.press('Enter');
await page.waitForTimeout(90_000);

const result = await page.evaluate(async () => {
  const placement = document.querySelector(
    'agentable-operator-surface-placement[placement-id="operator-main"]');
  const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
  const thread = surface?.threads?.find((entry) => entry.id === surface.activeThreadId);
  const tool = thread?.messages?.find((message) => message.kind === 'tool');
  const wb = document.querySelector('agentable-whiteboard');
  const read = await wb?.runScriptedTool?.('read_canvas', {});
  return {
    msgCount: thread?.messages?.length ?? 0,
    messages: thread?.messages,
    tool,
    readCount: read?.result?.shapes?.length ?? null,
  };
});
console.log(JSON.stringify(result, null, 2));
await browser.close;
