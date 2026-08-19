/**
 * Quick diagnostic for iter-11 draw path timeout.
 */
import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html';

async function main {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction( => window.__galleryReady?.ok === true, { timeout: 45000 });
  await page.waitForFunction( => window.__operatorGalleryResult?.ok === true, { timeout: 45000 });
  await page.waitForTimeout(2000);

  const before = await page.evaluate(async () => {
    const placement = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    return {
      hasSurface: Boolean(surface),
      mode: surface?.mode,
      threadCount: surface?.threads?.length ?? 0,
      sendMessage: typeof surface?.sendMessage,
      selectMode: typeof surface?.selectMode,
    };
  });
  console.log('before', before);

  await page.evaluate( => {
    const placement = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    surface?.createThread?.;
    surface?.selectMode?.('draw');
    surface?.sendMessage?.('draw a cat');
  });

  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000);
    const snap = await page.evaluate( => {
      const placement = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]');
      const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
      const thread = surface?.threads?.[0];
      const messages = thread?.messages ?? [];
      return {
        i,
        mode: surface?.mode,
        messageCount: messages.length,
        kinds: messages.map((m) => ({ kind: m.kind, tool: m.toolName, ok: m.ok, text: m.text?.slice?.(0, 80) })),
      };
    });
    console.log(JSON.stringify(snap));
    if (snap.kinds.some((k) => k.tool === 'draw_shapes')) break;
  }

  await browser.close;
}

main.catch(console.error);
