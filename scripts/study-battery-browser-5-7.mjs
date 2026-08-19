/**
 * flagship chat-to-draw: verification battery steps 3 and 4.
 * Run from agentable-canvas root: node scripts/study-battery-browser-5-7.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const LOG_ROOT =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/p8-agents-draw-and-see/flagship-chat-to-draw/-7';
const SHOT_DIR = path.join(LOG_ROOT, 'screenshots');
const REPORT_PATH = path.join(LOG_ROOT, 'battery-browser-report.json');
const URL = 'http://127.0.0.1:5199/examples/08-agent-presents/index.html';

fs.mkdirSync(SHOT_DIR, { recursive: true });

/** @typedef {{ step: string; ok: boolean; detail?: Record<string, unknown>; error?: string }} BatteryStep *** @type {{ url: string; port: number; mode: string; steps: BatteryStep[]; consoleErrors: string[]; pass: boolean }} */
const report = {
  url: URL,
  port: 5199,
  mode: 'unknown',
  steps: [],
  consoleErrors: [],
  pass: false,
};

function pushStep(step, ok, detail = {}, error) {
  report.steps.push({ step, ok, detail,...(error ? { error }: {}) });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage;

page.on('console', (msg) => {
  if (msg.type === 'error') report.consoleErrors.push(msg.text);
});
page.on('pageerror', (err) => {
  report.consoleErrors.push(`pageerror: ${err.message}`);
});

async function clickStarterChip(label) {
  const card = page.getByTestId('starter-chip-card').filter({ hasText: label });
  const compact = page.getByTestId('starter-chip').filter({ hasText: label });
  if (await card.isVisible.catch(() => false)) {
    await card.click;
    return;
  }
  await compact.waitFor({ state: 'visible', timeout: 15_000 });
  await compact.click;
}

async function waitForGalleryReady {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(
     => window.__galleryReady?.example === '08-agent-presents' && window.__galleryReady?.ok === true,
    null,
    { timeout: 45_000 });
}

async function waitForChatInputEnabled(timeoutMs = 180_000) {
  const chatInput = page.getByPlaceholder(/Ask Nova anything/);
  await chatInput.waitFor({ state: 'visible', timeout: timeoutMs });
  const deadline = Date.now + timeoutMs;
  while (Date.now < deadline) {
    if (await chatInput.isEnabled) return chatInput;
    await page.waitForTimeout(500);
  }
  throw new Error(`chat input stayed disabled after ${timeoutMs}ms`);
}

async function hasTldrawCrashBoundary {
  const crashHeading = page.getByText('Something went wrong');
  const showDetails = page.getByRole('button', { name: 'Show details' });
  return (
    (await crashHeading.isVisible.catch(() => false)) ||
    (await showDetails.isVisible.catch(() => false))
  );
}

async function waitForToolCalls(prevCount, timeoutMs = 90_000) {
  await page.waitForFunction(
    (prev) => {
      const calls = window.__agentPresentsToolCalls ?? [];
      return calls.length > prev && calls.some((c) => c.name === 'draw_shapes' && c.ok);
    },
    prevCount,
    { timeout: timeoutMs });
}

async function countCanvasShapes {
  return page.evaluate(() => {
    const host = document.querySelector('agentable-whiteboard');
    const root = host?.shadowRoot;
    const container = root?.querySelector('.tl-container');
    if (!container) return { count: 0, missing: true };
    const shapes = container.querySelectorAll('[data-shape-type]');
    return { count: shapes.length, missing: false };
  });
}

async function toolbarOverlapCheck {
  return page.evaluate(() => {
    const host = document.querySelector('agentable-whiteboard');
    const root = host?.shadowRoot;
    const container = root?.querySelector('.tl-container');
    if (!container) return { ok: false, reason: 'no tl-container' };

    const containerRect = container.getBoundingClientRect;
    const chromeTop = containerRect.top + 56;
    const shapeEls = container.querySelectorAll('[data-shape-type]');
    const overlaps = [];
    for (const el of shapeEls) {
      const r = el.getBoundingClientRect;
      if (r.bottom > containerRect.top && r.top < chromeTop && r.width > 2 && r.height > 2) {
        overlaps.push({ type: el.getAttribute('data-shape-type'), top: r.top, bottom: r.bottom });
      }
    }
    return { ok: overlaps.length === 0, overlapCount: overlaps.length, overlaps: overlaps.slice(0, 5) };
  });
}

try {
  await waitForGalleryReady;
  pushStep('gallery-ready', true);

  await waitForChatInputEnabled(45_000);
  pushStep('chat-input-visible', true);

  const beforeAvionics = await page.evaluate(() => window.__agentPresentsToolCalls?.length ?? 0);
  await clickStarterChip('Avionics map');

  await page.waitForFunction(
     => {
      const body = document.body.innerText;
      return body.includes('Offline demo mode') || (window.__agentPresentsToolCalls?.length ?? 0) > 0;
    },
    null,
    { timeout: 90_000 });

  const offlineVisible = await page.getByText(/Offline demo mode/i).isVisible.catch(() => false);
  report.mode = offlineVisible ? 'offline': 'live';
  await waitForToolCalls(beforeAvionics, offlineVisible ? 30_000: 180_000);
  await waitForChatInputEnabled(report.mode === 'live' ? 180_000: 60_000);

  await page.screenshot({ path: path.join(SHOT_DIR, 'step3-pre-redo-avionics.png'), fullPage: false });
  pushStep('step3-prep-avionics-draw', true, { mode: report.mode });

  const beforeRedo = await page.evaluate(() => window.__agentPresentsToolCalls?.length ?? 0);
  const chatInput = await waitForChatInputEnabled(report.mode === 'live' ? 180_000: 60_000);
  await chatInput.fill('redo it and add text', { timeout: 180_000 });
  await chatInput.press('Enter');

  await page.waitForFunction(
    (prev) => {
      const body = document.body.innerText;
      const calls = window.__agentPresentsToolCalls ?? [];
      return (
        body.includes('Offline demo mode') ||
        calls.length > prev ||
        body.toLowerCase().includes('drew') ||
        body.toLowerCase().includes('sketch') ||
        body.toLowerCase().includes('updated')
      );
    },
    beforeRedo,
    { timeout: report.mode === 'live' ? 180_000: 45_000 });

  if (report.mode === 'offline') {
    await waitForToolCalls(beforeRedo, 30_000);
  } else {
    try {
      await waitForToolCalls(beforeRedo, 180_000);
    } catch {
       Crash check is the primary gate for step 3.
    }
    await waitForChatInputEnabled(180_000).catch(() => {});
  }

  const crashed = await hasTldrawCrashBoundary;
  await page.screenshot({ path: path.join(SHOT_DIR, 'step3-post-redo-add-text.png'), fullPage: false });
  pushStep('step3-redo-add-text-no-crash', !crashed, {
    mode: report.mode,
    tldrawCrash: crashed,
    toolCallsAfter: await page.evaluate(() => window.__agentPresentsToolCalls?.length ?? 0),
  }, crashed ? 'tldraw Something went wrong boundary visible': undefined);

  pushStep('step3-canvas-shapes-present', (await countCanvasShapes).count > 0, await countCanvasShapes);

  const resetBtn = page.getByRole('button', { name: /Reset canvas/i });
  await resetBtn.waitFor({ state: 'visible', timeout: 15_000 });
  const beforeResetShapes = await countCanvasShapes;
  await resetBtn.click;
  await page.waitForTimeout(1500);

  const afterResetShapes = await countCanvasShapes;
  await page.screenshot({ path: path.join(SHOT_DIR, 'step4-after-reset.png'), fullPage: false });
  pushStep('step4-reset-clears-content', afterResetShapes.count < beforeResetShapes.count, {
    before: beforeResetShapes.count,
    after: afterResetShapes.count,
  });

  const beforeLaunch = await page.evaluate(() => window.__agentPresentsToolCalls?.length ?? 0);
  await clickStarterChip('Launch sequence');

  await page.waitForFunction(
     => {
      const body = document.body.innerText;
      return body.includes('Offline demo mode') || (window.__agentPresentsToolCalls?.length ?? 0) > 0;
    },
    null,
    { timeout: report.mode === 'live' ? 120_000: 60_000 });

  await waitForToolCalls(beforeLaunch, report.mode === 'live' ? 180_000: 45_000);
  await waitForChatInputEnabled(report.mode === 'live' ? 180_000: 60_000).catch(() => {});
  await page.waitForTimeout(2000);

  const crashedStep4 = await hasTldrawCrashBoundary;
  const toolbarCheck = await toolbarOverlapCheck;
  await page.screenshot({ path: path.join(SHOT_DIR, 'step4-launch-sequence.png'), fullPage: false });

  pushStep('step4-launch-sequence-draw', !crashedStep4, {
    tldrawCrash: crashedStep4,
    shapesAfter: (await countCanvasShapes).count,
  });
  pushStep('step4-toolbar-clearance', toolbarCheck.ok, toolbarCheck);

  const criticalSteps = report.steps.filter((s) =>
    ['step3-redo-add-text-no-crash', 'step4-reset-clears-content', 'step4-launch-sequence-draw', 'step4-toolbar-clearance'].includes(s.step));
  report.pass =
    criticalSteps.every((s) => s.ok) &&
    report.consoleErrors.filter((e) => !e.includes('404') && !e.includes('config.local.json')).length === 0;
} catch (err) {
  pushStep('battery-fatal', false, {}, err instanceof Error ? err.message: String(err));
  await page.screenshot({ path: path.join(SHOT_DIR, 'battery-fatal.png'), fullPage: false }).catch(() => {});
  report.pass = false;
} finally {
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  await browser.close;
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0: 1);
