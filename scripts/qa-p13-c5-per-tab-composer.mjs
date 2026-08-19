/**
 * P13 C5 — per-tab composer unlock (Example 13).
 * Proves inactive thread B composer textarea stays enabled while thread A generates.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const URL = 'http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html';
const OUT_DIR =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/p13-canvas-wide-agentoperator-post-draw-iteration/outputs/c5-per-tab-composer';
const SLOW_PROMPT = 'Explain cloud architecture in detail with many paragraphs and examples';

mkdirSync(OUT_DIR, { recursive: true });

async function waitForGalleryReady(page) {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForFunction(() => window.__galleryReady?.ok === true, { timeout: 90_000 });
  await page.waitForFunction(() => window.__operatorGalleryResult?.whiteboardReady === true, {
    timeout: 90_000,
  });
}

async function setupAutoNewThread(page) {
  await page.evaluate(() => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    surface?.selectMode?.('auto');
    surface?.createThread?.;
  });
  await page.waitForFunction(
     => {
      const placement = document.querySelector(
        'agentable-operator-surface-placement[placement-id="operator-main"]');
      const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
      return Boolean(
        root?.querySelector('[data-testid="operator-composer-textarea"]') ??
          root?.querySelector('textarea'));
    },
    { timeout: 30_000 });
}

async function submitPrompt(page, prompt) {
  await page.evaluate((p) => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const shellRoot = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
    const textarea =
      shellRoot?.querySelector('[data-testid="operator-composer-textarea"]') ??
      shellRoot?.querySelector('textarea');
    if (textarea instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(textarea, p);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, prompt);
  const clicked = await page.evaluate(() => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const submit = placement?.shadowRoot
      ?.querySelector('agentable-operator-surface')
      ?.shadowRoot?.querySelector('[part="composer-submit"]:not([disabled])');
    if (submit instanceof HTMLElement) {
      submit.click;
      return true;
    }
    return false;
  });
  if (!clicked) await page.keyboard.press('Enter');
}

async function readComposerState(page) {
  return page.evaluate(() => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    const shellRoot = surface?.shadowRoot;
    const composerTextarea =
      shellRoot?.querySelector('[data-testid="operator-composer-textarea"]') ??
      shellRoot?.querySelector('textarea');
    const threadsGenerating = (surface?.threads ?? []).map((entry) => ({
      id: entry.id,
      generating: entry.generating === true,
    }));
    return {
      activeThreadId: surface?.activeThreadId ?? null,
      composerTextareaDisabled: composerTextarea?.hasAttribute('disabled') === true,
      submitButtonDisabled:
        shellRoot?.querySelector('[part="composer-submit"]')?.hasAttribute('disabled') === true,
      threadsGenerating,
      threadCount: surface?.threads?.length ?? 0,
    };
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const report = {
  criterion: 'C5_perTabComposerUnlock',
  url: URL,
  timestamp: new Date.toISOString(),
  pass: false,
};

try {
  await waitForGalleryReady(page);
  await setupAutoNewThread(page);

  const threadAId = await page.evaluate(() => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    return surface?.activeThreadId ?? null;
  });

  await submitPrompt(page, SLOW_PROMPT);
  await page.waitForTimeout(2_000);

  await page.evaluate(() => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    surface?.createThread?.;
  });
  await page.waitForTimeout(500);

  const state = await readComposerState(page);
  const threadAGenerating =
    state.threadsGenerating.find((entry) => entry.id === threadAId)?.generating === true;
  const activeThreadGenerating =
    state.threadsGenerating.find((entry) => entry.id === state.activeThreadId)?.generating === true;

  report.threadAId = threadAId;
  report.activeThreadId = state.activeThreadId;
  report.threadAGenerating = threadAGenerating;
  report.activeThreadGenerating = activeThreadGenerating;
  report.composerTextareaDisabled = state.composerTextareaDisabled;
  report.submitButtonDisabled = state.submitButtonDisabled;
  report.threadsGenerating = state.threadsGenerating;
  report.pass =
    threadAGenerating &&
    !activeThreadGenerating &&
    state.composerTextareaDisabled === false;

  await page.screenshot({ path: join(OUT_DIR, 'c5-per-tab-composer-unlocked.png'), fullPage: false });
  writeFileSync(join(OUT_DIR, 'c5-per-tab-composer-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exitCode = 1;
} finally {
  await browser.close;
}
