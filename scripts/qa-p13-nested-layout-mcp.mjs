/**
 * P13 nested layout fix — qa-expert verification (supplementary when cursor-ide-browser blocked).
 * Outputs to browser-proof-mcp/ with nested-specific criteria metrics.
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/p13-canvas-wide-agentoperator-post-draw-iteration/outputs/browser-proof-mcp';
const URL = 'http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html';
const PROMPT = 'draw diagram of vpc peering between aws and gcp';
const TURN_TIMEOUT_MS = 180_000;

mkdirSync(OUT_DIR, { recursive: true });

function sha256(filePath) {
  const buf = readFileSync(filePath);
  return createHash('sha256').update(buf).digest('hex').toUpperCase;
}

async function waitForGalleryReady(page) {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForFunction( => window.__galleryReady?.ok === true, { timeout: 90_000 });
  await page.waitForFunction( => window.__operatorGalleryResult?.whiteboardReady === true, {
    timeout: 90_000,
  });
}

async function setupAutoNewThread(page) {
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
  if (!clicked) await page.keyboard.press('Enter');
}

async function readOperatorState(page) {
  return page.evaluate( => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
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
    const firstSuccessfulDraw = toolSequence.find(
      (entry) => entry.toolName === 'draw_shapes' && entry.ok);
    const firstDrawLayout =
      firstSuccessfulDraw !== undefined && typeof firstSuccessfulDraw.args.layout === 'string'
        ? firstSuccessfulDraw.args.layout: null;
    const firstDrawCreatedShapeIds = Array.isArray(firstSuccessfulDraw?.args?._createdShapeIds)
      ? firstSuccessfulDraw.args._createdShapeIds.filter((id) => typeof id === 'string'): [];
    const firstDrawNodeCount = Array.isArray(firstSuccessfulDraw?.args?.diagram?.nodes)
      ? firstSuccessfulDraw.args.diagram.nodes.length: 0;
    const firstDrawEdgeCount = Array.isArray(firstSuccessfulDraw?.args?.diagram?.edges)
      ? firstSuccessfulDraw.args.diagram.edges.length: 0;
    const arrangeCalls = toolSequence.filter((e) => e.toolName === 'arrange');
    const postDrawArrangeFlow = arrangeCalls.some(
      (e) => e.args?.layout === 'flow' || e.args?.layout === 'timeline');
    const reasoningMessages = messages.filter((m) => m.kind === 'reasoning');
    const composerTextarea =
      shellRoot?.querySelector('[data-testid="operator-composer-textarea"]') ??
      shellRoot?.querySelector('textarea');
    const composerTextareaDisabled = composerTextarea?.hasAttribute('disabled') === true;
    const submitButtonDisabled =
      shellRoot?.querySelector('[part="composer-submit"]')?.hasAttribute('disabled') === true;
    const threadsGenerating = (surface?.threads ?? []).map((entry) => ({
      id: entry.id,
      generating: entry.generating === true,
    }));
    return {
      mode: surface?.mode ?? null,
      generating: thread?.generating === true,
      hasStopButton: Boolean(shellRoot?.querySelector('[part="composer-stop"]')),
      toolSequence,
      toolCallCount: toolSequence.length,
      firstDrawLayout,
      firstDrawCreatedShapeIds,
      firstDrawCreatedCount: firstDrawCreatedShapeIds.length,
      firstDrawNodeCount,
      firstDrawEdgeCount,
      postDrawArrangeFlow,
      arrangeCalls: arrangeCalls.map((e) => ({ layout: e.args?.layout, ok: e.ok })),
      hasReasoningVisible: reasoningMessages.some(
        (m) => typeof m.text === 'string' && m.text.trim.length > 0),
      reasoningTextHead: reasoningMessages.map((m) => (typeof m.text === 'string' ? m.text.slice(0, 200): '')).join(' | '),
      assistantText: messages.filter((m) => m.kind === 'text' && m.role === 'assistant').map((m) => m.text ?? '').join('\n'),
      composerTextareaDisabled,
      submitButtonDisabled,
      threadsGenerating,
      threadCount: surface?.threads?.length ?? 0,
      activeThreadId: surface?.activeThreadId ?? null,
    };
  });
}

async function readCanvasShapePositions(page) {
  return page.evaluate(async () => {
    const host = document.querySelector('agentable-whiteboard-host');
    const editor = host?.__editor ?? window.__tldrawEditor;
    if (!editor?.getCurrentPageShapes) {
      return { ok: false, error: 'no editor', shapes: [] };
    }
    const allShapes = editor.getCurrentPageShapes;
    const arrowCount = allShapes.filter((s) => s.type === 'arrow').length;
    const totalShapeCount = allShapes.length;
    const shapes = allShapes.filter((s) => {
      const id = String(s.id ?? '');
      return id.includes('aws') || id.includes('gcp') || id.includes('vpn') || id.includes('vpc');
    });
    const positions = shapes.map((s) => ({
      id: String(s.id),
      x: s.x ?? 0,
      y: s.y ?? 0,
      parentId: s.parentId ? String(s.parentId): null,
      type: s.type,
    }));
    const ys = positions.map((p) => p.y);
    const uniqueY = [...new Set(ys.map((y) => Math.round(y 20) * 20))];
    const allSameY = uniqueY.length <= 1 && positions.length >= 3;
    const xs = positions.map((p) => p.x).sort((a, b) => a - b);
    const spreadX = xs.length >= 2 ? xs[xs.length - 1] - xs[0]: 0;
    return {
      ok: true,
      count: positions.length,
      totalShapeCount,
      arrowCount,
      positions,
      uniqueYCount: uniqueY.length,
      allSameY,
      spreadX,
      horizontalChainLikely: allSameY && spreadX > 200,
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

const consoleEvents = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(TURN_TIMEOUT_MS);
page.on('console', (msg) =>
  consoleEvents.push({ type: msg.type, text: msg.text, ts: new Date.toISOString }));
page.on('pageerror', (err) =>
  consoleEvents.push({ type: 'pageerror', text: err.message, ts: new Date.toISOString }));

const report = {
  prompt: PROMPT,
  url: URL,
  source: 'playwright-supplementary-mcp-blocked',
  reportVersion: 'nested-v2',
  cursorIdeBrowserBlocked: true,
  timestamp: new Date.toISOString,
  nestedCriteria: {},
  pngs: [],
};

try {
  await waitForGalleryReady(page);
  await page.screenshot({ path: join(OUT_DIR, '00-gallery-ready.png'), fullPage: false });

  await setupAutoNewThread(page);
  await submitPrompt(page, PROMPT);

  let midCaptured = false;
  for (let i = 0; i < 45; i += 1) {
    await page.waitForTimeout(2_000);
    const snap = await readOperatorState(page);
    if (!midCaptured && snap.generating && (snap.hasReasoningVisible || snap.toolSequence.length > 0)) {
      await page.screenshot({ path: join(OUT_DIR, '01-vpc-mid-reasoning.png'), fullPage: false });
      midCaptured = true;
    }
    if (!snap.generating && snap.toolSequence.some((t) => t.toolName === 'draw_shapes' && t.ok)) break;
  }

  try {
    await waitForTurnComplete(page);
  } catch (error) {
    report.timeoutError = String(error);
  }

  const finalState = await readOperatorState(page);
  const canvasLayout = await readCanvasShapePositions(page);
  report.finalState = finalState;
  report.canvasLayout = canvasLayout;

  await page.screenshot({ path: join(OUT_DIR, '02-vpc-final-diagram.png'), fullPage: false });

   Stop abort test
  await setupAutoNewThread(page);
  await submitPrompt(page, 'draw a detailed multi-region vpc architecture with many subnets');
  await page.waitForTimeout(5_000);
  const stopBefore = await readOperatorState(page);
  const stopClicked = await page.evaluate( => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const stop = placement?.shadowRoot
      ?.querySelector('agentable-operator-surface')
      ?.shadowRoot?.querySelector('[part="composer-stop"]');
    if (stop instanceof HTMLElement && !stop.hasAttribute('disabled')) {
      stop.click;
      return true;
    }
    return false;
  });
  await page.waitForTimeout(2_000);
  const stopAfter = await readOperatorState(page);
  report.stopTest = {
    stopVisibleBefore: stopBefore.hasStopButton,
    stopClicked,
    generatingBefore: stopBefore.generating,
    generatingAfter: stopAfter.generating,
    aborted: stopClicked && stopBefore.generating && !stopAfter.generating,
  };
  await page.screenshot({ path: join(OUT_DIR, '03-stop-abort.png'), fullPage: false });

   Per-tab busy: start gen on thread A, switch to thread B
  await setupAutoNewThread(page);
  const threadAId = await page.evaluate( => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    return surface?.activeThreadId ?? null;
  });
  await submitPrompt(page, PROMPT);
  await page.waitForTimeout(3_000);
  await page.evaluate( => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    surface?.createThread?.;
  });
  await page.waitForTimeout(500);
  const perTabState = await readOperatorState(page);
  const threadAGenerating =
    perTabState.threadsGenerating?.find((entry) => entry.id === threadAId)?.generating === true;
  const activeThreadGenerating =
    perTabState.threadsGenerating?.find((entry) => entry.id === perTabState.activeThreadId)
      ?.generating === true;
  const composerUnlockedOnInactiveTab =
    threadAGenerating &&
    !activeThreadGenerating &&
    !perTabState.composerTextareaDisabled;
  report.perTabBusy = {
    threadAId,
    activeThreadId: perTabState.activeThreadId,
    threadAGenerating,
    activeThreadGenerating,
    threadBComposerTextareaDisabled: perTabState.composerTextareaDisabled,
    threadBSubmitDisabled: perTabState.submitButtonDisabled,
    composerUnlockedOnInactiveTab,
  };
  await page.screenshot({ path: join(OUT_DIR, '04-per-tab-busy.png'), fullPage: false });

  const firstDrawCreatedCount = finalState.firstDrawCreatedCount ?? 0;
  const firstDrawNodeCount = finalState.firstDrawNodeCount ?? 0;
  const arrowCount = canvasLayout.arrowCount ?? 0;

  report.nestedCriteria = {
    c0_firstDrawCreatesAllNodes: {
      pass: firstDrawCreatedCount >= 9 && firstDrawCreatedCount >= firstDrawNodeCount - 1,
      firstDrawCreatedCount,
      firstDrawNodeCount,
      firstDrawEdgeCount: finalState.firstDrawEdgeCount ?? 0,
      firstDrawCreatedShapeIds: finalState.firstDrawCreatedShapeIds ?? [],
      expectedMin: 9,
    },
    c0b_arrowsVisibleOnCanvas: {
      pass: arrowCount >= (finalState.firstDrawEdgeCount ?? 1),
      arrowCount,
      firstDrawEdgeCount: finalState.firstDrawEdgeCount ?? 0,
      totalShapeCount: canvasLayout.totalShapeCount ?? 0,
    },
    c1_nestedColumnsNotHorizontalChain: {
      pass:
        finalState.firstDrawLayout === 'nested' &&
        !canvasLayout.horizontalChainLikely &&
        canvasLayout.uniqueYCount >= 2,
      firstDrawLayout: finalState.firstDrawLayout,
      horizontalChainLikely: canvasLayout.horizontalChainLikely,
      uniqueYCount: canvasLayout.uniqueYCount,
      shapeCount: canvasLayout.count,
    },
    c2_noPostDrawArrangeFlow: {
      pass: !finalState.postDrawArrangeFlow,
      postDrawArrangeFlow: finalState.postDrawArrangeFlow,
      arrangeCalls: finalState.arrangeCalls,
    },
    c3_toolCallsLe10: {
      pass: finalState.toolCallCount <= 10,
      toolCallCount: finalState.toolCallCount,
    },
    c4_reasoningBodyText: {
      pass: finalState.hasReasoningVisible,
      reasoningTextHead: finalState.reasoningTextHead,
    },
    c5_perTabBusy: {
      pass:
        report.perTabBusy.composerUnlockedOnInactiveTab === true &&
        report.perTabBusy.threadAGenerating === true &&
        report.perTabBusy.threadBComposerTextareaDisabled === false,...report.perTabBusy,
    },
    c6_stopAborts: {
      pass: report.stopTest.aborted,...report.stopTest,
    },
  };

  const pngFiles = readdirSync(OUT_DIR).filter((f) => f.endsWith('.png'));
  report.pngs = pngFiles.map((name) => {
    const p = join(OUT_DIR, name);
    const stat = statSync(p);
    return { name, bytes: stat.size, sha256: sha256(p) };
  });

  const passCount = Object.values(report.nestedCriteria).filter((c) => c.pass).length;
  const criteriaTotal = Object.keys(report.nestedCriteria).length;
  report.overallScore = passCount criteriaTotal;
  report.overallPass = passCount === criteriaTotal;

  writeFileSync(join(OUT_DIR, 'nested-layout-report.json'), JSON.stringify(report, null, 2));
  writeFileSync(
    join(OUT_DIR, '..', 'console-scan-iteration-nested-mcp.json'),
    JSON.stringify(
      {
        iteration: 'operator-post-draw-nested',
        source: 'playwright-supplementary',
        cursorIdeBrowserBlocked: true,
        timestamp: report.timestamp,
        events: consoleEvents,
      },
      null,
      2));

  console.log(
    JSON.stringify(
      {
        overallPass: report.overallPass,
        overallScore: report.overallScore,
        nestedCriteria: report.nestedCriteria,
        pngs: report.pngs.map((p) => p.name),
      },
      null,
      2));
  if (!report.overallPass) process.exitCode = 1;
} finally {
  await browser.close;
}
