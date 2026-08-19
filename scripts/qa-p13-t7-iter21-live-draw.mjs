/**
 * live draw proof (Playwright).
 * Asserts arbitrary draw prompts never hit _unsupportedSubject or refusal text.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/p13-canvas-wide-agent';
const PROOF = join(ROOT, 'outputs');
const URL = 'http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html';

const PROMPTS = [
  { key: 'guy-gun', text: 'draw guy with gun', file: '01-draw-guy-with-gun.png' },
  { key: 'sand-castle', text: 'draw a sand castle', file: '02-draw-sand-castle.png' },
  { key: 'dog-cat', text: 'draw a dog eating a cat', file: '03-draw-dog-eating-cat.png' },
  { key: 'heart-demo', text: 'draw a heart', file: '04-draw-heart-demo.png' },
];

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
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    surface?.selectMode?.('draw');
    surface?.createThread?.;
  });
  const activeThreadId = await page.waitForFunction(
     => {
      const placement = document.querySelector(
        'agentable-operator-surface-placement[placement-id="operator-main"]');
      const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
      const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
      const threadId = typeof surface?.activeThreadId === 'string' ? surface.activeThreadId: null;
      if (!threadId || !root?.querySelector('textarea')) return null;
      return threadId;
    },
    { timeout: 30_000 });
  const threadId = await activeThreadId.jsonValue;
  if (typeof threadId !== 'string' || threadId.length === 0) {
    throw new Error('operator draw thread did not become ready');
  }

  await page.evaluate(() => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const textarea = placement?.shadowRoot
      ?.querySelector('agentable-operator-surface')
      ?.shadowRoot?.querySelector('textarea');
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.focus;
      textarea.value = '';
    }
  });
  await page.keyboard.type(prompt);
  await page.keyboard.press('Enter');
  return threadId;
}

/** @param {import('playwright').Page} page @param {string} activeThreadId */
async function waitForDrawToolMessage(page, activeThreadId) {
  await page.waitForFunction(
      (threadId) => {
        const placement = document.querySelector(
          'agentable-operator-surface-placement[placement-id="operator-main"]');
        const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
        const thread = surface?.threads?.find((entry) => entry.id === threadId);
        if (thread === undefined) return false;
        return (thread.messages ?? []).some(
          (message) => message.kind === 'tool' && message.toolName === 'draw_shapes');
      },
      activeThreadId,
      { timeout: 120_000 }).catch(() => undefined);

   Wait for post-verify to settle on this thread only.
  await page.waitForFunction(
      (threadId) => {
        const placement = document.querySelector(
          'agentable-operator-surface-placement[placement-id="operator-main"]');
        const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
        const thread = surface?.threads?.find((entry) => entry.id === threadId);
        if (thread === undefined) return false;
        const drawTool = thread.messages?.find(
          (m) => m.kind === 'tool' && m.toolName === 'draw_shapes');
        if (drawTool === undefined) return false;
        const assistantTexts = (thread.messages ?? []).filter((m) => m.kind === 'text' && m.role === 'assistant').map((m) => String(m.text ?? '').trim()).filter((text) => text.length > 0);
        const createdIds = Array.isArray(drawTool.args?._createdShapeIds)
          ? drawTool.args._createdShapeIds: [];
        return (
          drawTool.ok === true ||
          createdIds.length > 0 ||
          typeof drawTool.args?._verifyFailure === 'string' ||
          assistantTexts.length > 0
        );
      },
      activeThreadId,
      { timeout: 90_000 }).catch(() => undefined);

  await page.waitForTimeout(2000);
}

/** @param {import('playwright').Page} page @param {string} activeThreadId */
async function probeActiveThreadDraw(page, activeThreadId) {
  return page.evaluate((threadId) => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    const thread = surface?.threads?.find((entry) => entry.id === threadId);
    const drawTool = thread?.messages?.find(
      (m) => m.kind === 'tool' && m.toolName === 'draw_shapes');
    const assistantTexts = (thread?.messages ?? []).filter((m) => m.kind === 'text' && m.role === 'assistant').map((m) => String(m.text ?? ''));
    const createdShapeIds = Array.isArray(drawTool?.args?._createdShapeIds)
      ? drawTool.args._createdShapeIds.filter((id) => typeof id === 'string'): [];
    return {
      drawToolOk: drawTool?.ok === true,
      toolArgs: drawTool?.args ?? null,
      unsupportedSubject: drawTool?.args?._unsupportedSubject ?? null,
      createdShapeIds,
      verifyFailure: drawTool?.args?._verifyFailure ?? null,
      assistantTexts,
      hasRefusalText: assistantTexts.some((text) =>
        /can't draw a recognizable/i.test(text)),
    };
  }, activeThreadId);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

/** @type {Array<{type: string, text: string}>} */
const consoleEvents = [];
page.on('console', (msg) => consoleEvents.push({ type: msg.type, text: msg.text }));
page.on('pageerror', (err) => consoleEvents.push({ type: 'pageerror', text: err.message }));

await waitForGalleryReady(page);

/** @type {Record<string, unknown>} */
const probes = {};

for (const entry of PROMPTS) {
  const activeThreadId = await typedDrawInDrawMode(page, entry.text);
  await waitForDrawToolMessage(page, activeThreadId);
  await page.screenshot({ path: join(PROOF, entry.file), fullPage: false });
  probes[entry.key] = {
    prompt: entry.text,
    activeThreadId,...(await probeActiveThreadDraw(page, activeThreadId)),
  };
}

const bareTldraw = consoleEvents.filter(
  (e) => e.text.includes('Failed to resolve module specifier') && e.text.includes('tldraw'));

const scan = {
  capturedAt: new Date.toISOString(),
  capturedBy: 'Playwright — iter-21 live draw proof',
  iteration: 21,
  url: URL,
  probes,
  governance: {
    noUnsupportedSubject: Object.values(probes).every((probe) => {
      const p = /** @type {{ unsupportedSubject?: unknown }} */ (probe);
      return p.unsupportedSubject === null || p.unsupportedSubject === undefined;
    }),
    noRefusalText: Object.values(probes).every((probe) => {
      const p = /** @type {{ hasRefusalText?: boolean }} */ (probe);
      return p.hasRefusalText !== true;
    }),
    bareTldrawErrors: bareTldraw,
    consoleEventCount: consoleEvents.length,
  },
  note: 'QA script executed — do not claim PASS without owner review',
};

writeFileSync(join(PROOF, 'console-scan-.json'), JSON.stringify(scan, null, 2));

writeFileSync(
  join(PROOF, 'png-manifest.json'),
  JSON.stringify(
    {
      iteration: 21,
      source: 'playwright',
      entries: PROMPTS.map((entry) => ({
        file: entry.file,
        bytes: statSync(join(PROOF, entry.file)).size,
        prompt: entry.text,
      })),
    },
    null,
    2));

await browser.close;
console.log(JSON.stringify(scan, null, 2));
