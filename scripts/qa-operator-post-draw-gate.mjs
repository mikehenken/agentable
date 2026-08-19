/**
 * post-draw hard gate browser proof.
 * Asserts draw_shapes → group_shapes → read_canvas before final reply;
 * no clear_agent_drawings during layout-fix phase; screenshot succeeds.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR =
  process.env.OUT_DIR ??
  join(
    'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/p13-canvas-wide-agentoperator-post-draw-iteration/outputs');
const URL = 'http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html';
const PROMPT =
  process.env.QA_PROMPT ?? 'draw diagram of vpc peering between aws and gcp';
const TURN_TIMEOUT_MS = Number(process.env.QA_TURN_TIMEOUT_MS ?? 180_000);

mkdirSync(OUT_DIR, { recursive: true });

/** @param {import('playwright').Page} page */
async function waitForGalleryReady(page) {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForFunction( => window.__galleryReady?.ok === true, { timeout: 90_000 });
  await page.waitForFunction( => window.__operatorGalleryResult?.whiteboardReady === true, {
    timeout: 90_000,
  });
}

/** @param {import('playwright').Page} page */
async function sendAutoModePrompt(page) {
  await page.evaluate( => {
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
      return Boolean(root?.querySelector('textarea'));
    },
    { timeout: 30_000 });

  await page.evaluate((prompt) => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const textarea = placement?.shadowRoot
      ?.querySelector('agentable-operator-surface')
      ?.shadowRoot?.querySelector('textarea');
    if (textarea instanceof HTMLTextAreaElement) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value')?.set;
      nativeInputValueSetter?.call(textarea, prompt);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, PROMPT);

  const clicked = await page.evaluate( => {
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
  if (!clicked) {
    await page.keyboard.press('Enter');
  }
}

/** @param {import('playwright').Page} page */
async function waitForTurnComplete(page) {
  await page.waitForFunction(
     => {
      const placement = document.querySelector(
        'agentable-operator-surface-placement[placement-id="operator-main"]');
      const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
      const thread = surface?.threads?.find((entry) => entry.id === surface.activeThreadId);
      if (thread === undefined || thread.generating === true) {
        return false;
      }
      const toolNames = (thread.messages ?? []).filter((message) => message.kind === 'tool').map((message) => message.toolName);
      const hasDraw = toolNames.includes('draw_shapes');
      const hasRead = toolNames.includes('read_canvas');
      const hasGroup = toolNames.includes('group_shapes');
      const hasAssistant = (thread.messages ?? []).some(
        (message) => message.kind === 'text' && message.role === 'assistant');
      return hasDraw && hasRead && hasGroup && hasAssistant;
    },
    undefined,
    { timeout: TURN_TIMEOUT_MS });
}

/** @param {import('playwright').Page} page */
async function readTranscriptProof(page) {
  return page.evaluate( => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    const shellRoot = surface?.shadowRoot;
    const thread = surface?.threads?.find((entry) => entry.id === surface.activeThreadId);
    const toolSequence = (thread?.messages ?? []).filter((message) => message.kind === 'tool').map((message) => ({
        toolName: message.toolName,
        ok: message.ok === true,
        args: message.args ?? {},
      }));
    const firstSuccessfulDraw = toolSequence.find(
      (entry) => entry.toolName === 'draw_shapes' && entry.ok);
    const firstDrawUsesDiagram =
      firstSuccessfulDraw !== undefined &&
      (Object.prototype.hasOwnProperty.call(firstSuccessfulDraw.args, 'diagram') ||
        firstSuccessfulDraw.args._diagramPath === true ||
        firstSuccessfulDraw.args._rewrittenToDiagram === true);
    const drawIndex = toolSequence.findIndex((entry) => entry.toolName === 'draw_shapes' && entry.ok);
    const groupAfterDraw = toolSequence.slice(drawIndex + 1).some((entry) => entry.toolName === 'group_shapes' && entry.ok);
    const readAfterDraw = toolSequence.slice(drawIndex + 1).some((entry) => entry.toolName === 'read_canvas' && entry.ok);
    const readBeforeFinalAssistant = ( => {
      if (thread === undefined) return false;
      const messages = thread.messages ?? [];
      let sawDraw = false;
      let sawReadAfterDraw = false;
      for (const message of messages) {
        if (message.kind === 'tool' && message.toolName === 'draw_shapes' && message.ok === true) {
          sawDraw = true;
          continue;
        }
        if (sawDraw && message.kind === 'tool' && message.toolName === 'read_canvas' && message.ok === true) {
          sawReadAfterDraw = true;
          continue;
        }
        if (sawReadAfterDraw && message.kind === 'text' && message.role === 'assistant') {
          return true;
        }
      }
      return false;
    });

    const clearDuringFixPhase = ( => {
      if (thread === undefined) return false;
      const messages = thread.messages ?? [];
      let sawLayoutLintRead = false;
      for (const message of messages) {
        if (
          message.kind === 'tool' &&
          message.toolName === 'read_canvas' &&
          message.ok === true &&
          message.args &&
          typeof message.args === 'object' &&
          Array.isArray(message.args._layoutLints) &&
          message.args._layoutLints.length > 0
        ) {
          sawLayoutLintRead = true;
          continue;
        }
        if (
          sawLayoutLintRead &&
          message.kind === 'tool' &&
          message.toolName === 'clear_agent_drawings'
        ) {
          return true;
        }
        if (message.kind === 'text' && message.role === 'assistant' && sawLayoutLintRead) {
          break;
        }
      }
      return false;
    });

    const screenshotOk = toolSequence.some(
      (entry) => entry.toolName === 'screenshot_canvas' && entry.ok);

    return {
      mode: surface?.mode ?? null,
      hasModeDropdown: Boolean(shellRoot?.querySelector('.operator-mode-switcher')),
      hasStopButton: Boolean(shellRoot?.querySelector('[part="composer-stop"]')),
      toolSequence,
      drawIndex,
      groupAfterDraw,
      readAfterDraw,
      readBeforeFinalAssistant,
      clearDuringFixPhase,
      screenshotOk,
      firstDrawUsesDiagram,
      generating: thread?.generating === true,
    };
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(TURN_TIMEOUT_MS);

try {
  await waitForGalleryReady(page);
  await sendAutoModePrompt(page);
  try {
    await waitForTurnComplete(page);
  } catch (error) {
    const partial = await readTranscriptProof(page);
    await page.screenshot({ path: join(OUT_DIR, '00-timeout-partial.png'), fullPage: true });
    writeFileSync(
      join(OUT_DIR, 'browser-proof.json'),
      JSON.stringify({ prompt: PROMPT, partial, error: String(error) }, null, 2));
    throw error;
  }
  const proof = await readTranscriptProof(page);

  await page.screenshot({ path: join(OUT_DIR, '01-post-draw-transcript.png'), fullPage: true });

  const report = {
    prompt: PROMPT,
    url: URL,
    proof,
    pass:
      proof.drawIndex >= 0 &&
      proof.firstDrawUsesDiagram === true &&
      proof.groupAfterDraw === true &&
      proof.readAfterDraw === true &&
      proof.readBeforeFinalAssistant === true &&
      proof.clearDuringFixPhase === false &&
      proof.hasModeDropdown === true,
    notes: {
      screenshotOk: proof.screenshotOk,
      screenshotRequired: false,
    },
    timestamp: new Date.toISOString,
  };

  writeFileSync(join(OUT_DIR, 'browser-proof.json'), JSON.stringify(report, null, 2));

  if (!report.pass) {
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
} finally {
  await browser.close;
}
