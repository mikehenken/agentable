import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
const logs = [];
page.on('console', (msg) => logs.push(msg.text));

await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html', {
  waitUntil: 'networkidle',
});
await page.waitForFunction(() => window.__operatorGalleryResult?.ok === true, { timeout: 45_000 });
await page.waitForTimeout(1500);

const result = await page.evaluate(async () => {
  const dock = document.querySelector(
    'agentable-operator-surface-placement[placement-id="operator-main"]');
  const float = document.getElementById('operator-floating');
  const dockSurface = dock?.shadowRoot?.querySelector('agentable-operator-surface');
  const floatSurface = float?.shadowRoot?.querySelector('agentable-operator-surface');

  dockSurface?.selectMode?.('draw');
  await new Promise((r) => setTimeout(r, 300));

  const textarea = dock?.shadowRoot
    ?.querySelector('agentable-operator-surface')
    ?.shadowRoot?.querySelector('textarea');
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return { error: 'no textarea' };
  }
  textarea.value = 'Draw a blue rectangle on the canvas';
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  const submit = dock?.shadowRoot
    ?.querySelector('agentable-operator-surface')
    ?.shadowRoot?.querySelector('[part="composer-submit"]');
  submit?.click;
  await new Promise((r) => setTimeout(r, 3000));

  const thread = dockSurface?.threads?.[0];
  const toolMsg = thread?.messages?.find((m) => m.kind === 'tool' && m.toolName === 'draw_shapes');
  const assistant = thread?.messages?.filter((m) => m.kind === 'text' && m.role === 'assistant').pop;

  const wb = document.querySelector('agentable-whiteboard');
  const read = await wb?.runScriptedTool?.('read_canvas', {});

  return {
    dockMode: dockSurface?.mode,
    floatMode: floatSurface?.mode,
    toolMsg,
    assistantText: assistant?.text,
    readCount: read?.result?.shapes?.length ?? null,
  };
});

console.log(JSON.stringify({ result, logs: logs.slice(-20) }, null, 2));
await browser.close;
