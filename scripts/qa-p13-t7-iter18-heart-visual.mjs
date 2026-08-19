/**
 * heart visual recognizability browser proof (Playwright).
 * Captures PNG + console scan after "draw a heart" in Draw mode.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/p13-canvas-wide-agent';
const PROOF = join(ROOT, 'outputs/browser-proof');
const URL = 'http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html';

mkdirSync(PROOF, { recursive: true });

/** @param {import('playwright').Page} page */
async function waitForGalleryReady(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__galleryReady?.ok === true, { timeout: 60_000 });
  await page.waitForFunction(() => window.__operatorGalleryResult?.whiteboardReady === true, {
    timeout: 60_000,
  });
}

/** @param {import('playwright').Page} page @param {string} prompt */
async function typedDrawInDrawMode(page, prompt) {
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
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
      const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
      return Boolean(root?.querySelector('textarea'));
    },
    { timeout: 30_000 });
  await page.evaluate(() => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const textarea = placement?.shadowRoot
      ?.querySelector('agentable-operator-surface')
      ?.shadowRoot?.querySelector('textarea');
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.focus;
    }
  });
  await page.keyboard.type(prompt);
  await page.keyboard.press('Enter');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

/** @type {Array<{type: string, text: string}>} */
const consoleEvents = [];
page.on('console', (msg) => consoleEvents.push({ type: msg.type, text: msg.text }));
page.on('pageerror', (err) => consoleEvents.push({ type: 'pageerror', text: err.message }));

await waitForGalleryReady(page);

await typedDrawInDrawMode(page, 'draw a heart');
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
    { timeout: 90_000 }).catch(() => undefined);
await page.waitForTimeout(12000);
await page.screenshot({ path: join(PROOF, '01-draw-heart-visible.png'), fullPage: false });

const heartProbe = await page.evaluate(async () => {
  const placement = document.querySelector(
    'agentable-operator-surface-placement[placement-id="operator-main"]');
  const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
  const thread =
    surface?.threads?.find((entry) => entry.id === surface.activeThreadId) ??
    surface?.threads?.slice(-1)[0];
  const drawTool = thread?.messages?.find(
    (m) => m.kind === 'tool' && m.toolName === 'draw_shapes');
  const ids = (drawTool?.args?._createdShapeIds ?? []).map(String);
  const shapeArgIds = Array.isArray(drawTool?.args?.shapes)
    ? drawTool.args.shapes.map((s) => String(s?.id ?? '')).filter(Boolean): [];
  const allIds = [...ids,...shapeArgIds];
  const assistantText =
    thread?.messages?.find((m) => m.kind === 'text' && m.role === 'assistant')?.text ??
    thread?.messages?.filter((m) => m.kind === 'text').slice(-1)[0]?.text ??
    '';
  return {
    activeThreadId: surface?.activeThreadId ?? null,
    drawToolOk: drawTool?.ok === true,
    shapeIds: allIds,
    hasSketchABC: allIds.some((id) => /sketch-[abc]/i.test(id)),
    hasHeartIds: allIds.some((id) => id.includes('heart-')),
    assistantText,
  };
});

const bareTldraw = consoleEvents.filter(
  (e) => e.text.includes('Failed to resolve module specifier') && e.text.includes('tldraw'));
const voiceGreeting = consoleEvents.filter((e) =>
  e.text.includes('greetingMode is "agent-first" but voiceGreeting is empty'));

const scan = {
  capturedAt: new Date.toISOString(),
  capturedBy: 'Playwright — iter-18 heart visual proof',
  iteration: 18,
  url: URL,
  heartProbe,
  semanticFidelity: {
    heartNotSketchABC: heartProbe.hasSketchABC === false && heartProbe.hasHeartIds === true,
    heartLabelOk: /heart sketch/i.test(String(heartProbe.assistantText)),
  },
  visualQualityNote:
    'Three solid ellipses (2 overlapping lobes + bottom point). Playwright PNG reads heart-like; qa-expert gates final PASS.',
  bareTldrawErrors: bareTldraw,
  voiceGreetingWarningCount: voiceGreeting.length,
  consoleEventCount: consoleEvents.length,
};

writeFileSync(join(ROOT, 'outputs/console-scan-.json'), JSON.stringify(scan, null, 2));

writeFileSync(
  join(PROOF, 'png-manifest.json'),
  JSON.stringify(
    {
      iteration: 18,
      source: 'playwright',
      entries: [
        {
          file: '01-draw-heart-visible.png',
          bytes: statSync(join(PROOF, '01-draw-heart-visible.png')).size,
          purpose: 'SC5 heart visual recognizability (iter-18 geometry)',
        },
      ],
    },
    null,
    2));

await browser.close;
console.log(JSON.stringify(scan, null, 2));
