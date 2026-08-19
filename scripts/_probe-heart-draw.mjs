import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction( => window.__galleryReady?.ok === true, { timeout: 60000 });
await page.waitForFunction( => window.__operatorGalleryResult?.whiteboardReady === true, { timeout: 60000 });
await page.waitForTimeout(1500);
await page.evaluate( => {
  const p = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]');
  const s = p?.shadowRoot?.querySelector('agentable-operator-surface');
  s?.selectMode?.('draw');
  s?.createThread?.;
});
await page.waitForFunction(
   => {
    const p = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]');
    const root = p?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
    return Boolean(root?.querySelector('textarea'));
  },
  { timeout: 30000 });
await page.evaluate( => {
  const p = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]');
  const textarea = p?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot?.querySelector('textarea');
  if (textarea instanceof HTMLTextAreaElement) textarea.focus;
});
await page.keyboard.type('draw a heart');
await page.keyboard.press('Enter');
await page.waitForTimeout(12000);
const dump = await page.evaluate( => {
  const p = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]');
  const s = p?.shadowRoot?.querySelector('agentable-operator-surface');
  const threads = s?.threads ?? [];
  return {
    threadCount: threads.length,
    activeThreadId: s?.activeThreadId,
    threads: threads.map((t) => ({
      id: t.id,
      msgCount: t.messages?.length ?? 0,
      messages: (t.messages ?? []).map((m) => ({
        kind: m.kind,
        toolName: m.toolName,
        ok: m.ok,
        text: typeof m.text === 'string' ? m.text.slice(0, 200): undefined,
        createdIds: m.args?._createdShapeIds,
        shapesInArgs: Array.isArray(m.args?.shapes) ? m.args.shapes.map((x) => x?.id): undefined,
      })),
    })),
  };
});
console.log(JSON.stringify(dump, null, 2));
await browser.close;
