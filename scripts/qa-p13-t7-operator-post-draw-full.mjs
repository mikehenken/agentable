/**
 * operator-post-draw-iteration — full qa-expert browser proof (config v1.5.7).
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = 'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/p13-canvas-wide-agentoperator-post-draw-iteration/outputs/browser-proof';
const URL = 'http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html';
const PROMPT = 'draw diagram of vpc peering between aws and gcp';
const TURN_TIMEOUT_MS = 180_000;

mkdirSync(OUT_DIR, { recursive: true });

function sha256(filePath) {
  const buf = readFileSync(filePath);
  return createHash('sha256').update(buf).digest('hex').toUpperCase();
}

async function waitForGalleryReady(page) {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForFunction(() => window.__galleryReady?.ok === true, { timeout: 90_000 });
  await page.waitForFunction(() => window.__operatorGalleryResult?.whiteboardReady === true, { timeout: 90_000 });
}

async function setupAutoNewThread(page) {
  await page.evaluate(() => {
    const placement = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    surface?.selectMode?.('auto');
    surface?.createThread?.;
  });
  await page.waitForFunction(() => {
    const placement = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]');
    const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
    return Boolean(root?.querySelector('textarea'));
  }, { timeout: 30_000 });
}

async function submitPrompt(page, prompt) {
  await page.evaluate((p) => {
    const placement = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]');
    const textarea = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot?.querySelector('textarea');
    if (textarea instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(textarea, p);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, prompt);
  const clicked = await page.evaluate(() => {
    const placement = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]');
    const submit = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot?.querySelector('[part="composer-submit"]:not([disabled])');
    if (submit instanceof HTMLElement) { submit.click; return true; }
    return false;
  });
  if (!clicked) await page.keyboard.press('Enter');
}

async function readOperatorState(page) {
  return page.evaluate(() => {
    const placement = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    const shellRoot = surface?.shadowRoot;
    const thread = surface?.threads?.find((entry) => entry.id === surface.activeThreadId);
    const messages = thread?.messages ?? [];
    const toolSequence = messages.filter((m) => m.kind === 'tool').map((message) => ({
      toolName: message.toolName,
      ok: message.ok === true,
      error: typeof message.error === 'string' ? message.error: undefined,
      args: message.args ?? {},
    }));
    const firstSuccessfulDraw = toolSequence.find((entry) => entry.toolName === 'draw_shapes' && entry.ok);
    const firstDrawUsesDiagram = firstSuccessfulDraw !== undefined && (
      Object.prototype.hasOwnProperty.call(firstSuccessfulDraw.args, 'diagram') ||
      firstSuccessfulDraw.args._diagramPath === true ||
      firstSuccessfulDraw.args._rewrittenToDiagram === true ||
      (firstSuccessfulDraw.args.diagram && typeof firstSuccessfulDraw.args.diagram === 'object')
    );
    let maxConsecutiveDrawFailures = 0; let streak = 0;
    for (const entry of toolSequence) {
      if (entry.toolName === 'draw_shapes') {
        if (!entry.ok) { streak += 1; maxConsecutiveDrawFailures = Math.max(maxConsecutiveDrawFailures, streak); }
        else { streak = 0; }
      }
    }
    let drawFailuresBeforeSuccess = 0;
    for (const entry of toolSequence) {
      if (entry.toolName !== 'draw_shapes') continue;
      if (entry.ok) break;
      drawFailuresBeforeSuccess += 1;
    }
    const failedDrawErrors = toolSequence.filter((e) => e.toolName === 'draw_shapes' && !e.ok).map((e) => e.error ?? '(no error field)');
    const reasoningMessages = messages.filter((m) => m.kind === 'reasoning');
    return {
      mode: surface?.mode ?? null,
      generating: thread?.generating === true,
      hasStopButton: Boolean(shellRoot?.querySelector('[part="composer-stop"]')),
      toolSequence,
      firstDrawUsesDiagram,
      maxConsecutiveDrawFailures,
      drawFailuresBeforeSuccess,
      failedDrawErrors,
      hasReasoningVisible: reasoningMessages.some((m) => typeof m.text === 'string' && m.text.trim().length > 0),
      hasStreamingReasoning: reasoningMessages.some((m) => m.streaming === true),
      reasoningTextHead: reasoningMessages.map((m) => (typeof m.text === 'string' ? m.text.slice(0, 120): '')).join(' | '),
      assistantText: messages.filter((m) => m.kind === 'text' && m.role === 'assistant').map((m) => m.text ?? '').join('\n'),
    };
  });
}

async function waitForTurnComplete(page) {
  await page.waitForFunction(() => {
    const placement = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    const thread = surface?.threads?.find((entry) => entry.id === surface.activeThreadId);
    if (thread === undefined || thread.generating === true) return false;
    const toolNames = (thread.messages ?? []).filter((m) => m.kind === 'tool').map((m) => m.toolName);
    const hasDraw = toolNames.includes('draw_shapes');
    const hasAssistant = (thread.messages ?? []).some((m) => m.kind === 'text' && m.role === 'assistant');
    return hasDraw && hasAssistant;
  }, undefined, { timeout: TURN_TIMEOUT_MS });
}

const consoleEvents = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(TURN_TIMEOUT_MS);
page.on('console', (msg) => consoleEvents.push({ type: msg.type, text: msg.text, ts: new Date.toISOString() }));
page.on('pageerror', (err) => consoleEvents.push({ type: 'pageerror', text: err.message, ts: new Date.toISOString() }));

const report = { prompt: PROMPT, url: URL, source: 'playwright', timestamp: new Date.toISOString(), pngs: [], streamingObservations: [] };

try {
  await waitForGalleryReady(page);
  await page.screenshot({ path: join(OUT_DIR, '00-gallery-ready.png'), fullPage: false });
  await setupAutoNewThread(page);
  await page.screenshot({ path: join(OUT_DIR, '01-auto-new-thread.png'), fullPage: false });
  await submitPrompt(page, PROMPT);

  let sawStreamingReasoning = false;
  for (let i = 0; i < 40; i += 1) {
    await page.waitForTimeout(2_000);
    const snap = await readOperatorState(page);
    report.streamingObservations.push({ elapsedSec: (i + 1) * 2,...snap });
    if (snap.hasStreamingReasoning || snap.hasReasoningVisible) sawStreamingReasoning = true;
    if (i === 2 && snap.generating) await page.screenshot({ path: join(OUT_DIR, '02-reasoning-streaming-mid-turn.png'), fullPage: false });
    if (!snap.generating && snap.toolSequence.some((t) => t.toolName === 'draw_shapes' && t.ok)) break;
  }

  try { await waitForTurnComplete(page); } catch (error) { report.timeoutError = String(error); }

  const finalState = await readOperatorState(page);
  report.finalState = finalState;
  report.sawStreamingReasoning = sawStreamingReasoning;

  await page.screenshot({ path: join(OUT_DIR, '03-final-vpc-diagram-tool-cards.png'), fullPage: false });
  await page.screenshot({ path: join(OUT_DIR, '04-canvas-vpc-diagram-closeup.png'), fullPage: true });

  await setupAutoNewThread(page);
  await submitPrompt(page, PROMPT);
  await page.waitForTimeout(4_000);
  const stopStateBefore = await readOperatorState(page);
  const stopClicked = await page.evaluate(() => {
    const placement = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]');
    const stop = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot?.querySelector('[part="composer-stop"]');
    if (stop instanceof HTMLElement && !stop.hasAttribute('disabled')) { stop.click; return true; }
    return false;
  });
  await page.waitForTimeout(2_000);
  const stopStateAfter = await readOperatorState(page);
  report.stopButtonTest = { stopVisibleBefore: stopStateBefore.hasStopButton, stopClicked, generatingBefore: stopStateBefore.generating, generatingAfter: stopStateAfter.generating };
  await page.screenshot({ path: join(OUT_DIR, '05-stop-button-abort.png'), fullPage: false });

  const bareTldrawErrors = consoleEvents.filter((e) => e.type === 'pageerror' || (e.type === 'error' && /Uncaught TypeError|tldraw/i.test(e.text)));
  const voiceGreetingWarnings = consoleEvents.filter((e) => /warnVoiceGreetingConfig|greetingMode is "agent-first" but voiceGreeting is empty/i.test(e.text));

  report.consoleSummary = { totalEvents: consoleEvents.length, errorCount: consoleEvents.filter((e) => e.type === 'error').length, warnCount: consoleEvents.filter((e) => e.type === 'warning').length, pageerrorCount: consoleEvents.filter((e) => e.type === 'pageerror').length, bareTldrawErrors, voiceGreetingWarningCount: voiceGreetingWarnings.length };

  const pngFiles = readdirSync(OUT_DIR).filter((f) => f.endsWith('.png'));
  report.pngs = pngFiles.map((name) => { const p = join(OUT_DIR, name); const stat = statSync(p); return { name, bytes: stat.size, sha256: sha256(p) }; });

  const failuresBeforeSuccess = finalState.drawFailuresBeforeSuccess ?? 99;
  const genericErrorsOnly = (finalState.failedDrawErrors ?? []).every((e) => e === '(no error field)' || e === 'Draw shapes failed' || e.length === 0);

  report.passCriteria = {
    hasPngArtifacts: report.pngs.length >= 3,
    firstDrawUsesDiagram: finalState.firstDrawUsesDiagram === true,
    drawFailuresBeforeSuccessLe5: failuresBeforeSuccess <= 5,
    maxConsecutiveDrawFailuresLe3: (finalState.maxConsecutiveDrawFailures ?? 99) <= 3,
    hasReasoningVisible: finalState.hasReasoningVisible === true || sawStreamingReasoning,
    failedToolsShowRealErrors: !genericErrorsOnly || failuresBeforeSuccess === 0,
    noBareTldrawErrors: bareTldrawErrors.length === 0,
    stopButtonWorks: stopClicked && stopStateBefore.generating && !stopStateAfter.generating,
  };
  report.overallPass = Object.values(report.passCriteria).every(Boolean);

  writeFileSync(join(OUT_DIR, '..', 'browser-proof-full.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(OUT_DIR, '..', 'console-scan-iteration-post-draw.json'), JSON.stringify({ iteration: 'operator-post-draw', source: 'playwright', timestamp: report.timestamp, events: consoleEvents, summary: report.consoleSummary, voiceGreetingWarnings, bareTldrawErrors }, null, 2));

  console.log(JSON.stringify({ overallPass: report.overallPass, passCriteria: report.passCriteria, finalState: { firstDrawUsesDiagram: finalState.firstDrawUsesDiagram, drawFailuresBeforeSuccess: finalState.drawFailuresBeforeSuccess, maxConsecutiveDrawFailures: finalState.maxConsecutiveDrawFailures, failedDrawErrors: finalState.failedDrawErrors?.slice(0,3) }, pngs: report.pngs.map((p) => p.name) }, null, 2));
  if (!report.overallPass) process.exitCode = 1;
} finally {
  await browser.close;
}
