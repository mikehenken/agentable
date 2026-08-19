/**
 * browser proof — bootstrap stability, console scan, draw cat.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ARTIFACT_ROOT =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/p13-canvas-wide-agent';
const PROOF_DIR = join(ARTIFACT_ROOT, 'outputs/browser-proof');
const URL = 'http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html';
const DRAW_PROBE = 'draw a cat';

mkdirSync(PROOF_DIR, { recursive: true });

/** @param {import('playwright').Page} page */
async function waitForGalleryReady(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(
     => {
      const ready = window.__galleryReady;
      return ready?.example === '13-canvas-wide-agent' && ready.ok === true;
    },
    { timeout: 45_000 });
  await page.waitForFunction( => window.__operatorGalleryResult?.ok === true, {
    timeout: 45_000,
  });
}

/** @param {import('playwright').Page} page */
async function waitForComposer(page) {
  await page.waitForFunction(
     => {
      const placement = document.querySelector(
        'agentable-operator-surface-placement[placement-id="operator-main"]');
      const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
      return Boolean(root?.querySelector('textarea'));
    },
    { timeout: 30_000 });
}

/** @param {import('playwright').Page} page */
async function sendDrawProbe(page) {
  await page.waitForTimeout(2000);
  await page.evaluate( => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    surface?.selectMode?.('draw');
    surface?.createThread?.;
  });
  await waitForComposer(page);
  await page.evaluate( => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const textarea = placement?.shadowRoot
      ?.querySelector('agentable-operator-surface')
      ?.shadowRoot?.querySelector('textarea');
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.focus;
    }
  });
  await page.keyboard.type(DRAW_PROBE);
  await page.keyboard.press('Enter');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

/** @type {Array<{type: string, text: string}>} */
const consoleEvents = [];
/** @type {string[]} */
const configFetchUrls = [];
page.on('request', (req) => {
  const url = req.url;
  if (url.includes('meridian-labs-open-config.json')) {
    configFetchUrls.push(url);
  }
});
page.on('console', (msg) => {
  consoleEvents.push({ type: msg.type, text: msg.text });
});
page.on('pageerror', (err) => {
  consoleEvents.push({ type: 'pageerror', text: err.message });
});

await waitForGalleryReady(page);
const configFetchBeforeProbe = configFetchUrls.length;

 Bootstrap stability: repeated whenReady/read_canvas must not refetch config
await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  if (!wb) return;
  await wb.whenReady?.(15_000);
  await wb.runScriptedTool?.('read_canvas', {});
  await wb.whenReady?.(15_000);
  await wb.runScriptedTool?.('read_canvas', {});
});
const configFetchesDuringProbe = configFetchUrls.length - configFetchBeforeProbe;

await page.screenshot({ path: join(PROOF_DIR, '01-initial-load.png'), fullPage: false });

await sendDrawProbe(page);

 Mid-response: optional — capture during tool/reasoning if it appears quickly
await page.waitForFunction(
     => {
      const placement = document.querySelector(
        'agentable-operator-surface-placement[placement-id="operator-main"]');
      const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
      const threads = surface?.threads;
      if (!Array.isArray(threads)) return false;
      for (const thread of threads) {
        for (const message of thread.messages ?? []) {
          if (message.kind === 'reasoning' || message.kind === 'tool') return true;
        }
      }
      return false;
    },
    { timeout: 45_000 }).catch( => undefined);

await page.waitForTimeout(800);
await page.screenshot({ path: join(PROOF_DIR, '02-mid-streaming.png'), fullPage: false });

await page.waitForFunction(
     => {
      const placement = document.querySelector(
        'agentable-operator-surface-placement[placement-id="operator-main"]');
      const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
      const thinking = surface?.shadowRoot?.textContent?.includes('Thinking');
      if (thinking) return false;
      const threads = surface?.threads;
      if (!Array.isArray(threads)) return false;
      for (const thread of threads) {
        if ((thread.messages?.length ?? 0) > 1) return true;
      }
      return false;
    },
    { timeout: 120_000 }).catch( => undefined);

await page.waitForTimeout(1200);
await page.screenshot({ path: join(PROOF_DIR, '03-after-draw-cat.png'), fullPage: false });

const drawPayload = await page.evaluate( => {
  const placement = document.querySelector(
    'agentable-operator-surface-placement[placement-id="operator-main"]');
  const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
  const threads = surface?.threads;
  if (!Array.isArray(threads)) return null;
  for (const thread of threads) {
    for (let i = thread.messages.length - 1; i >= 0; i -= 1) {
      const message = thread.messages[i];
      if (message?.kind === 'tool' && message.toolName === 'draw_shapes') {
        return {
          ok: message.ok === true,
          args: message.args ?? {},
        };
      }
    }
  }
  return null;
});

const voiceGreetingWarnings = consoleEvents.filter((e) =>
  e.text.includes('greetingMode is "agent-first" but voiceGreeting is empty'));
const bareTldrawErrors = consoleEvents.filter(
  (e) =>
    e.text.includes('Failed to resolve module specifier') &&
    e.text.includes('tldraw'));

const scan = {
  capturedAt: new Date.toISOString,
  url: URL,
  consoleEventCount: consoleEvents.length,
  bareTldrawErrors,
  voiceGreetingWarnings,
  voiceGreetingWarningCount: voiceGreetingWarnings.length,
  drawPayload,
  reloadConfigDuringChat: consoleEvents.filter((e) =>
    e.text.includes('Failed to load embed config')),
  configUrlFetchCount: configFetchUrls.length,
  configFetchBeforeProbe,
  configFetchesDuringProbe,
  bootstrapStable: configFetchesDuringProbe === 0,
  passCriteria: {
    noBareTldraw: bareTldrawErrors.length === 0,
    noVoiceGreetingSpam: voiceGreetingWarnings.length <= 1,
    drawToolPresent: drawPayload !== null,
    drawToolOk: drawPayload?.ok === true,
    bootstrapStable: configFetchesDuringProbe === 0,
  },
};

writeFileSync(join(ARTIFACT_ROOT, 'console-scan-.json'), JSON.stringify(scan, null, 2));
writeFileSync(
  join(ARTIFACT_ROOT, 'console-scan--full.json'),
  JSON.stringify({ scan, consoleEvents }, null, 2));

await browser.close;
console.log(JSON.stringify(scan.passCriteria, null, 2));
