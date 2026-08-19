/**
 * P13 nested repair thrash — assert single draw, no clear, low tool count.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const OUT_MD =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/p13-canvas-wide-agentoperator-post-draw-iteration/qa-report-nested-v3-playwright.md';
const URL = 'http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html';
const PROMPT = 'draw diagram of vpc peering between aws and gcp';
const TURN_TIMEOUT_MS = 180_000;

mkdirSync(dirname(OUT_MD), { recursive: true });

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
      return Boolean(root?.querySelector('textarea'));
    },
    { timeout: 30_000 });
}

async function submitPrompt(page, prompt) {
  await page.evaluate((p) => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const textarea = placement?.shadowRoot
      ?.querySelector('agentable-operator-surface')
      ?.shadowRoot?.querySelector('textarea');
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

async function readOperatorState(page) {
  return page.evaluate(() => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    const thread = surface?.threads?.find((entry) => entry.id === surface.activeThreadId);
    const messages = thread?.messages ?? [];
    const toolSequence = messages.filter((m) => m.kind === 'tool').map((message) => ({
        toolName: message.toolName,
        ok: message.ok === true,
        error: typeof message.error === 'string' ? message.error: undefined,
      }));
    return {
      generating: thread?.generating === true,
      toolSequence,
      toolCallCount: toolSequence.length,
      successfulDraws: toolSequence.filter((e) => e.toolName === 'draw_shapes' && e.ok).length,
      failedDraws: toolSequence.filter((e) => e.toolName === 'draw_shapes' && !e.ok).length,
      clearAttempts: toolSequence.filter((e) => e.toolName === 'clear_agent_drawings').length,
      assistantText: messages.filter((m) => m.kind === 'text' && m.role === 'assistant').map((m) => m.text ?? '').join('\n'),
    };
  });
}

async function waitForTurnComplete(page) {
  await page.waitForFunction(
     => {
      const placement = document.querySelector(
        'agentable-operator-surface-placement[placement-id="operator-main"]');
      const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
      const thread = surface?.threads?.find((entry) => entry.id === surface.activeThreadId);
      if (thread === undefined || thread.generating === true) return false;
      const toolNames = (thread.messages ?? []).filter((m) => m.kind === 'tool').map((m) => m.toolName);
      const hasDraw = toolNames.includes('draw_shapes');
      const hasAssistant = (thread.messages ?? []).some(
        (m) => m.kind === 'text' && m.role === 'assistant');
      return hasDraw && hasAssistant;
    },
    undefined,
    { timeout: TURN_TIMEOUT_MS });
}

function renderMarkdown(report) {
  const lines = [
    '# P13 nested repair thrash — Playwright QA (v3)',
    '',
    `- **Prompt:** ${report.prompt}`,
    `- **URL:** ${report.url}`,
    `- **Timestamp:** ${report.timestamp}`,
    `- **Overall pass:** ${report.overallPass}`,
    '',
    '## Assertions',
    '',
    '| Check | Expected | Actual | Pass |',
    '| --- | --- | --- | --- |',
  ];
  for (const [key, value] of Object.entries(report.assertions)) {
    lines.push(
      `| ${key} | ${value.expected} | ${value.actual} | ${value.pass ? 'yes': '**no**'} |`);
  }
  lines.push('', '## Tool sequence', '', '```json');
  lines.push(JSON.stringify(report.finalState?.toolSequence ?? [], null, 2));
  lines.push('```', '', '## Assistant text', '', report.finalState?.assistantText ?? '');
  if (report.error) {
    lines.push('', '## Error', '', String(report.error));
  }
  return lines.join('\n');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(TURN_TIMEOUT_MS);

const report = {
  prompt: PROMPT,
  url: URL,
  timestamp: new Date.toISOString(),
  assertions: {},
  finalState: null,
  overallPass: false,
  error: null,
};

try {
  await waitForGalleryReady(page);
  await setupAutoNewThread(page);
  await submitPrompt(page, PROMPT);
  try {
    await waitForTurnComplete(page);
  } catch (error) {
    report.error = String(error);
  }
  const finalState = await readOperatorState(page);
  report.finalState = finalState;

  report.assertions = {
    exactlyOneSuccessfulDraw: {
      expected: 1,
      actual: finalState.successfulDraws,
      pass: finalState.successfulDraws === 1,
    },
    zeroFailedDraws: {
      expected: 0,
      actual: finalState.failedDraws,
      pass: finalState.failedDraws === 0,
    },
    zeroClearAttempts: {
      expected: 0,
      actual: finalState.clearAttempts,
      pass: finalState.clearAttempts === 0,
    },
    toolCountAtMostSix: {
      expected: '≤ 6',
      actual: finalState.toolCallCount,
      pass: finalState.toolCallCount <= 6,
    },
  };

  report.overallPass = Object.values(report.assertions).every((entry) => entry.pass);
  writeFileSync(OUT_MD, renderMarkdown(report));
  console.log(JSON.stringify({ overallPass: report.overallPass, assertions: report.assertions }, null, 2));
  if (!report.overallPass) process.exitCode = 1;
} finally {
  await browser.close;
}
