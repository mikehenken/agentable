/**
 * browser proof — full chrome whenReady + typed draw cat.
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
    { timeout: 60_000 });
  await page.waitForFunction( => window.__operatorGalleryResult?.whiteboardReady === true, {
    timeout: 60_000,
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
  await page.waitForTimeout(1500);
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

const preChromeProbe = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  const whenReady = await wb?.whenReady?.(20_000);
  const read = await wb?.runScriptedTool?.('read_canvas', {});
  return {
    resizableChrome: document.querySelector('.gallery-resizable-mounted') !== null,
    whenReady: Boolean(whenReady),
    readOk: read?.ok === true,
    shapeCount: read?.result?.shapes?.length ?? null,
    domGeo: wb?.shadowRoot?.querySelectorAll('[data-shape-type="geo"]').length ?? 0,
  };
});

await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  if (!wb) return;
  await wb.whenReady?.(15_000);
  await wb.runScriptedTool?.('read_canvas', {});
  await wb.whenReady?.(15_000);
  await wb.runScriptedTool?.('read_canvas', {});
});
const configFetchesDuringProbe = configFetchUrls.length - configFetchBeforeProbe;

await page.screenshot({ path: join(PROOF_DIR, '01-initial-load-full-chrome.png'), fullPage: false });

await sendDrawProbe(page);

await page.waitForFunction(
     => {
      const placement = document.querySelector(
        'agentable-operator-surface-placement[placement-id="operator-main"]');
      const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
      const threads = surface?.threads;
      if (!Array.isArray(threads)) return false;
      for (const thread of threads) {
        for (const message of thread.messages ?? []) {
          if (message.kind === 'tool' && message.toolName === 'draw_shapes') return true;
        }
      }
      return false;
    },
    { timeout: 90_000 }).catch( => undefined);

await page.waitForTimeout(1500);
await page.screenshot({ path: join(PROOF_DIR, '02-after-draw-cat-tool.png'), fullPage: false });

const postDrawProbe = await page.evaluate(async () => {
  const placement = document.querySelector(
    'agentable-operator-surface-placement[placement-id="operator-main"]');
  const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
  const thread =
    surface?.threads?.find((entry) => entry.id === surface.activeThreadId) ??
    surface?.threads?.[0];
  const drawTool = thread?.messages?.find(
    (message) => message.kind === 'tool' && message.toolName === 'draw_shapes');
  const wb = document.querySelector('agentable-whiteboard');
  const whenReady = await wb?.whenReady?.(10_000);
  const read = await wb?.runScriptedTool?.('read_canvas', {});
  const domGeo = wb?.shadowRoot?.querySelectorAll('[data-shape-type="geo"]').length ?? 0;
  return {
    whenReady: Boolean(whenReady),
    drawTool: drawTool
      ? { ok: drawTool.ok === true, argKeys: Object.keys(drawTool.args ?? {}) }: null,
    readOk: read?.ok === true,
    shapeCount: read?.result?.shapes?.length ?? null,
    domGeo,
    msgCount: thread?.messages?.length ?? 0,
  };
});

await page.screenshot({ path: join(PROOF_DIR, '03-canvas-shapes-visible.png'), fullPage: false });

const voiceGreetingWarnings = consoleEvents.filter((e) =>
  e.text.includes('greetingMode is "agent-first" but voiceGreeting is empty'));
const bareTldrawErrors = consoleEvents.filter(
  (e) =>
    e.text.includes('Failed to resolve module specifier') &&
    e.text.includes('tldraw'));

const scan = {
  capturedAt: new Date.toISOString,
  url: URL,
  preChromeProbe,
  postDrawProbe,
  consoleEventCount: consoleEvents.length,
  bareTldrawErrors,
  voiceGreetingWarningCount: voiceGreetingWarnings.length,
  configFetchesDuringProbe,
  bootstrapStable: configFetchesDuringProbe === 0,
  passCriteria: {
    fullChromeWhenReady: preChromeProbe.whenReady === true,
    readCanvasBeforeDraw: preChromeProbe.readOk === true,
    drawToolPresent: postDrawProbe.drawTool !== null,
    drawToolOk: postDrawProbe.drawTool?.ok === true,
    shapesIncreased:
      (postDrawProbe.shapeCount ?? 0) > 0 && postDrawProbe.domGeo > 0,
    whenReadyAfterDraw: postDrawProbe.whenReady === true,
    noBareTldraw: bareTldrawErrors.length === 0,
    bootstrapStable: configFetchesDuringProbe === 0,
  },
};

writeFileSync(join(ARTIFACT_ROOT, 'console-scan-.json'), JSON.stringify(scan, null, 2));

await browser.close;
console.log(JSON.stringify(scan, null, 2));
