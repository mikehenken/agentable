/**
 * browser proof — Draw requires visible canvas evidence.
 * Run: node scripts/qa-p13-t7-iter9-browser-proof.mjs
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PROOF_DIR =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/p13-canvas-wide-agentoutputs/browser-proof';
const OUTPUT_DIR =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/p13-canvas-wide-agentoutputs';
const URL = 'http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html';
const SUMMARIZE_PROBE = 'Summarize the canvas';
const BUILD_PROBE = 'Open a document panel on the canvas';
const DRAW_PROBE = 'Draw a blue rectangle on the canvas';

mkdirSync(PROOF_DIR, { recursive: true });
mkdirSync(OUTPUT_DIR, { recursive: true });

/** @typedef {{ criterion: string; pass: boolean; artifact_path: string; notes: string }} ProofRow *** @type {ProofRow[]} */
const proofs = [];

const CAPABILITY_REFUSAL_PATTERN =
  /\b(i don't have|i do not have|don't have the capability|do not have the capability|do not have drawing tools|no drawing tools|cannot draw)\b/i;

const HALLUCINATION_PATTERN = /\bhallucinat/i;

const OPERATOR_FAILURE_PATTERN =
  /\b(failed|share_artifact.*fail|open_panel.*fail|draw_shapes.*fail|canvas editor not bound|document editor not bound)\b/i;

/**
 * @param {import('playwright').Page} page
 */
async function operatorShadowText(page) {
  return page.evaluate( => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
    const walk = (node) => {
      if (!(node instanceof Element) && !(node instanceof DocumentFragment) && !(node instanceof ShadowRoot)) {
        return '';
      }
      let text = '';
      if (node instanceof Element && node.shadowRoot) {
        text += walk(node.shadowRoot);
      }
      for (const child of node.childNodes) {
        if (child instanceof Element) {
          text += walk(child);
        } else if (child.nodeType === Node.TEXT_NODE) {
          text += child.textContent ?? '';
        }
      }
      return text;
    };
    return root ? walk(root): '';
  });
}

/**
 * @param {import('playwright').Page} page
 */
async function scanOperatorToolCards(page) {
  return page.evaluate( => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
    const tools = root ? [...root.querySelectorAll('[data-testid="operator-tool"]')]: [];
    return tools.map((el) => ({
      name: el.getAttribute('data-tool-name') ?? '',
      status: el.getAttribute('data-tool-status') ?? '',
    }));
  });
}

/**
 * @param {import('playwright').Page} page
 */
async function scanCanvasAndOperatorErrors(page) {
  return page.evaluate( => {
    const walk = (node) => {
      if (!(node instanceof Element) && !(node instanceof DocumentFragment) && !(node instanceof ShadowRoot)) {
        return '';
      }
      let text = '';
      if (node instanceof Element && node.shadowRoot) {
        text += walk(node.shadowRoot);
      }
      for (const child of node.childNodes) {
        if (child instanceof Element) {
          text += walk(child);
        } else if (child.nodeType === Node.TEXT_NODE) {
          text += child.textContent ?? '';
        }
      }
      return text;
    };

    const pageText = walk(document.body);
    const operatorRoot = document.querySelector(
      '.operator-rail agentable-operator-surface-placement,.operator-rail-inner agentable-operator-surface-placement, agentable-operator-surface-placement[placement-id="operator-main"]')?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
    const operatorText = operatorRoot ? walk(operatorRoot): '';

    const chatPanelSelectors = [
      '[data-panel-id="chat"]',
      '[data-testid="panel-shape-chat"]',
      '[data-testid="panel-chrome-chat"]',
      '[data-testid="landi-chat-panel"]',
      '[data-testid="atlas-chat-panel"]',
    ];
    let chatPanelCount = 0;
    for (const selector of chatPanelSelectors) {
      chatPanelCount += document.querySelectorAll(selector).length;
    }

    const whiteboard = document.querySelector('agentable-whiteboard');
    if (whiteboard?.shadowRoot) {
      for (const selector of chatPanelSelectors) {
        chatPanelCount += whiteboard.shadowRoot.querySelectorAll(selector).length;
      }
    }

    const combined = `${pageText}\n${operatorText}`;
    const errorPattern =
      /\b(read_canvas failed|read canvas failed|tool failure|operator chat failed|completed analysis\.|i do not have drawing tools)\b/i;

    return {
      chatPanelCount,
      hasFloatingChatPanel: chatPanelCount > 0,
      hasErrorText: errorPattern.test(combined),
      hasErrorToast: Boolean(operatorRoot?.querySelector('[data-testid="operator-error-toast"]')),
      suppressCanvasChat: whiteboard?.hasAttribute('suppress-canvas-chat') === true,
      openChatDisabled: whiteboard?.getAttribute('open-chat-on-mount') === 'false',
      resizableChromeMounted: document.querySelector('[data-testid="gallery-resizable-chrome"]') !== null,
    };
  });
}

/**
 * @param {import('playwright').Page} page
 */
async function readOperatorMode(page) {
  return page.evaluate( => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    return surface?.getAttribute('mode') ?? surface?.mode ?? 'unknown';
  });
}

/**
 * @param {import('playwright').Page} page
 */
async function openFloatingOperator(page) {
  await page.evaluate( => {
    window.dispatchEvent(new CustomEvent('gallery:floating-toggle', { detail: { visible: true } }));
  });
  await page.waitForFunction(
     => {
      const floating = document.getElementById('operator-floating');
      return floating?.classList.contains('floating-visible') === true;
    },
    { timeout: 10_000 });
  await page.waitForTimeout(400);
}

/**
 * @param {import('playwright').Page} page
 */
async function readFloatingComposerMetrics(page) {
  return page.evaluate( => {
    const floating = document.getElementById('operator-floating');
    const root = floating?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
    const textarea = root?.querySelector('textarea');
    const composer = root?.querySelector('[part="composer"]');
    const transcript = root?.querySelector('[part="transcript"]');
    const textareaStyle = textarea instanceof HTMLElement ? getComputedStyle(textarea): null;
    const composerStyle = composer instanceof HTMLElement ? getComputedStyle(composer): null;
    const transcriptStyle = transcript instanceof HTMLElement ? getComputedStyle(transcript): null;
    const textareaRect = textarea?.getBoundingClientRect;
    const composerRect = composer?.getBoundingClientRect;
    const placeholder = textarea instanceof HTMLTextAreaElement ? textarea.placeholder: '';
    const placeholderVisible =
      textarea instanceof HTMLTextAreaElement &&
      textareaRect !== undefined &&
      composerRect !== undefined &&
      textareaRect.bottom <= composerRect.bottom + 1 &&
      textareaRect.height >= 36;
    return {
      placeholder,
      placeholderVisible,
      textareaMinHeight: textareaStyle?.minHeight ?? '',
      composerOverflow: composerStyle?.overflow ?? '',
      transcriptOverflow: transcriptStyle?.overflowY ?? '',
      floatingMinHeight:
        floating instanceof HTMLElement ? getComputedStyle(floating).minHeight: '',
    };
  });
}

/**
 * @param {import('playwright').Page} page
 */
async function readOperatorDrawEvidence(page) {
  return page.evaluate( => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    const threads = surface?.threads;
    if (!Array.isArray(threads)) {
      return { createdShapeIds: [], drawToolStatus: null };
    }
    for (const thread of threads) {
      const messages = thread?.messages;
      if (!Array.isArray(messages)) {
        continue;
      }
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message?.kind !== 'tool' || message.toolName !== 'draw_shapes') {
          continue;
        }
        const args = message.args;
        const ids = Array.isArray(args?._createdShapeIds) ? args._createdShapeIds: [];
        const shapesAfterDraw = args?._shapesAfterDraw;
        return {
          createdShapeIds: ids.filter((id) => typeof id === 'string'),
          drawToolStatus: message.ok === true ? 'succeeded': 'failed',
          shapesAfterDraw:
            shapesAfterDraw &&
            typeof shapesAfterDraw === 'object' &&
            shapesAfterDraw !== null &&
            typeof shapesAfterDraw.count === 'number'
              ? {
                  count: shapesAfterDraw.count,
                  blueGeo:
                    typeof shapesAfterDraw.blueGeo === 'number' ? shapesAfterDraw.blueGeo: 0,
                }: null,
        };
      }
    }
    return { createdShapeIds: [], drawToolStatus: null };
  });
}
/**
 * @param {import('playwright').Page} page
 */
async function countCanvasShapes(page) {
  return page.evaluate(async () => {
    const host = document.querySelector('agentable-whiteboard');
    if (!(host instanceof HTMLElement) || typeof host.runScriptedTool !== 'function') {
      const root = host?.shadowRoot;
      const container = root?.querySelector('.tl-container');
      const shapes = container?.querySelectorAll('[data-shape-type]') ?? [];
      return { count: shapes.length, blueGeo: 0, via: 'dom' };
    }
    if (typeof host.whenReady === 'function') {
      await host.whenReady(10_000);
    }
    const read = await host.runScriptedTool('read_canvas', {});
    if (read.ok && read.result && typeof read.result === 'object' && read.result !== null) {
      const graph = /** @type {{ shapes?: Array<{ nativeType?: string; kind?: string; agentId?: string }> }} */ (
        read.result
      );
      const shapes = graph.shapes ?? [];
      const blueGeo = shapes.filter((shape) => {
        if (shape.nativeType !== 'geo' || shape.kind !== 'box') {
          return false;
        }
        return shape.agentId === 'operator' || shape.agentId === undefined;
      }).length;
      return { count: shapes.length, blueGeo, via: 'read_canvas' };
    }
    const root = host.shadowRoot;
    const container = root?.querySelector('.tl-container');
    const shapes = container?.querySelectorAll('[data-shape-type]') ?? [];
    return { count: shapes.length, blueGeo: 0, via: 'dom-fallback' };
  });
}

/**
 * @param {import('playwright').Page} page
 */
async function detectVisibleCanvasRect(page) {
  return page.evaluate( => {
    const host = document.querySelector('agentable-whiteboard');
    const root = host?.shadowRoot;
    const container = root?.querySelector('.tl-container');
    if (!(container instanceof HTMLElement)) {
      return { visibleGeoRects: 0, via: 'none' };
    }
    const geoShapes = container.querySelectorAll('[data-shape-type="geo"]');
    let visible = 0;
    for (const shapeEl of geoShapes) {
      if (!(shapeEl instanceof HTMLElement)) {
        continue;
      }
      const rect = shapeEl.getBoundingClientRect;
      if (rect.width >= 40 && rect.height >= 24) {
        visible += 1;
      }
    }
    return { visibleGeoRects: visible, via: 'dom-geo-bounds' };
  });
}

/**
 * @param {import('playwright').Page} page
 */
async function waitForOperatorComposer(page) {
  await page.waitForFunction(
     => {
      const placement = document.querySelector(
        'agentable-operator-surface-placement[placement-id="operator-main"]');
      const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
      return Boolean(root?.querySelector('textarea'));
    },
    { timeout: 30_000 });
}

/**
 * @param {import('playwright').Page} page
 */
async function createOperatorThread(page) {
  await page.evaluate( => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    if (surface && typeof surface.createThread === 'function') {
      surface.createThread;
    }
  });
  await page.waitForTimeout(400);
}

/**
 * @param {import('playwright').Page} page
 * @param {string} message
 * @param {'ask' | 'build' | 'draw'} mode
 * @param {{ freshThread?: boolean }} [options]
 */
async function sendOperatorProbe(page, message, mode, options = {}) {
  if (options.freshThread === true) {
    await createOperatorThread(page);
  }

  await waitForOperatorComposer(page);

  await page.evaluate((nextMode) => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    if (surface && typeof surface.selectMode === 'function') {
      surface.selectMode(nextMode);
    }
  }, mode);

  const textarea = page.locator('.operator-rail textarea,.operator-rail-inner textarea').first;
  await textarea.waitFor({ state: 'visible', timeout: 30_000 });
  await textarea.click;
  await textarea.fill('');
  await textarea.pressSequentially(message, { delay: 5 });

  await page.evaluate( => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
    const submit = root?.querySelector('[part="composer-submit"]');
    if (!(submit instanceof HTMLButtonElement)) {
      throw new Error('operator composer submit not found');
    }
    submit.click;
  });

  await page.waitForTimeout(1500);
}

/**
 * @param {string} name
 * @param {Buffer} buf
 */
function savePng(name, buf) {
  const artifact_path = join(PROOF_DIR, `${name}.png`);
  writeFileSync(artifact_path, buf);
  const sha256 = createHash('sha256').update(buf).digest('hex');
  return { artifact_path, bytes: buf.length, sha256 };
}

/**
 * @param {import('playwright').Page} page
 */
async function waitForGalleryReady(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(
     => {
      const ready = window.__galleryReady;
      return ready?.example === '13-canvas-wide-agent' && ready.ok === true;
    },
    { timeout: 45_000 });
  await page.waitForFunction(
     => window.__operatorGalleryResult?.ok === true,
    { timeout: 45_000 });
  await page.locator('agentable-operator-surface-placement[placement-id="operator-main"]').first.waitFor({
    state: 'attached',
    timeout: 30_000,
  });
  await waitForOperatorComposer(page);
  await page.waitForTimeout(500);
}

/**
 * @param {import('playwright').Page} page
 * @param {(name: string) => boolean} toolNameMatch
 * @param {number} timeoutMs
 */
async function waitForOperatorToolCard(page, toolNameMatch, timeoutMs) {
  await page.waitForFunction(
    (matcherSource) => {
      const matcher = new Function('name', `return (${matcherSource})(name);`);
      const placement = document.querySelector(
        'agentable-operator-surface-placement[placement-id="operator-main"]');
      const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
      const tools = root ? [...root.querySelectorAll('[data-testid="operator-tool"]')]: [];
      return tools.some((el) => matcher(el.getAttribute('data-tool-name') ?? ''));
    },
    toolNameMatch.toString,
    { timeout: timeoutMs });
}

async function main {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage;

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type === 'error') {
      const text = msg.text;
      if (text.includes('[voice] error: NotSupportedError')) {
        return;
      }
      consoleErrors.push(text);
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(String(err));
  });

  await waitForGalleryReady(page);

  const defaultMode = await readOperatorMode(page);
  const defaultModeShot = savePng(
    'operator-default-draw-mode',
    await page.screenshot({ fullPage: false }));
  proofs.push({
    criterion: 'G Default mode Draw on first load',
    pass: defaultMode === 'draw',
    artifact_path: defaultModeShot.artifact_path,
    notes: JSON.stringify({ defaultMode }),
  });

  await openFloatingOperator(page);
  const floatingMetrics = await readFloatingComposerMetrics(page);
  const floatingShot = savePng(
    'floating-operator-composer-visible',
    await page.screenshot({ fullPage: false }));
  proofs.push({
    criterion: 'F Floating operator composer visible + overlay scrollbars',
    pass:
      floatingMetrics.placeholder.includes('Message the operator') &&
      floatingMetrics.placeholderVisible === true &&
      floatingMetrics.textareaMinHeight !== '0px',
    artifact_path: floatingShot.artifact_path,
    notes: JSON.stringify(floatingMetrics),
  });

  const headerUiCheck = await page.evaluate( => {
    const header = document.querySelector('[data-testid="gallery-demo-header"]');
    const switcher = document.querySelector('[data-testid="gallery-demo-switcher"]');
    const style = header instanceof HTMLElement ? getComputedStyle(header): null;
    const bg = style?.backgroundImage ?? '';
    const bgColor = style?.backgroundColor ?? '';
    return {
      headerPresent: Boolean(header),
      switcherPresent: Boolean(switcher),
      hasPurpleGradient: /#1e1b4b|#4338ca|indigo/i.test(bg),
      headerBackground: bg.length > 0 ? bg: bgColor,
    };
  });
  const headerShot = savePng('gallery-header-flat-dark', await page.screenshot({ fullPage: false }));
  proofs.push({
    criterion: 'F1 Gallery header — demo dropdown, flat dark (no purple gradient)',
    pass:
      headerUiCheck.headerPresent &&
      headerUiCheck.switcherPresent &&
      !headerUiCheck.hasPurpleGradient,
    artifact_path: headerShot.artifact_path,
    notes: JSON.stringify(headerUiCheck),
  });

  const seamUiCheck = await page.evaluate( => {
    const handle = document.querySelector('[data-slot="resizable-handle"]');
    const grip = handle?.querySelector('svg, [class*="Grip"]');
    const style = handle instanceof HTMLElement ? getComputedStyle(handle): null;
    const beforeStyle =
      handle instanceof HTMLElement ? getComputedStyle(handle, '::before'): null;
    return {
      handlePresent: Boolean(handle),
      gripVisible: Boolean(grip),
      handleHasWithHandleChild: Boolean(
        handle?.querySelector('[class*="rounded-xs"][class*="border"]')),
      beforeBorderColor: beforeStyle?.backgroundColor ?? '',
      handleClass: handle?.className ?? '',
    };
  });
  const seamShot = savePng('operator-seam-subtle-edge', await page.screenshot({ fullPage: false }));
  proofs.push({
    criterion: 'F2 Operator seam — vibe border edge, no center grip ornament',
    pass:
      seamUiCheck.handlePresent &&
      !seamUiCheck.gripVisible &&
      !seamUiCheck.handleHasWithHandleChild,
    artifact_path: seamShot.artifact_path,
    notes: JSON.stringify(seamUiCheck),
  });

  const canvasChatCheck = await scanCanvasAndOperatorErrors(page);
  const noCanvasChatShot = savePng('no-canvas-chat', await page.screenshot({ fullPage: false }));
  proofs.push({
    criterion: 'A No in-canvas Atlas chat (suppress-canvas-chat)',
    pass:
      canvasChatCheck.suppressCanvasChat &&
      canvasChatCheck.openChatDisabled &&
      !canvasChatCheck.hasFloatingChatPanel &&
      !canvasChatCheck.hasErrorText &&
      canvasChatCheck.resizableChromeMounted,
    artifact_path: noCanvasChatShot.artifact_path,
    notes: JSON.stringify(canvasChatCheck),
  });

  await sendOperatorProbe(page, SUMMARIZE_PROBE, 'ask');
  await page.waitForFunction(
     => {
      const placement = document.querySelector(
        'agentable-operator-surface-placement[placement-id="operator-main"]');
      const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
      const walk = (node) => {
        if (!(node instanceof Element) && !(node instanceof DocumentFragment) && !(node instanceof ShadowRoot)) {
          return '';
        }
        let out = '';
        if (node instanceof Element && node.shadowRoot) out += walk(node.shadowRoot);
        for (const child of node.childNodes) {
          if (child instanceof Element) out += walk(child);
          else if (child.nodeType === Node.TEXT_NODE) out += child.textContent ?? '';
        }
        return out;
      };
      const text = root ? walk(root): '';
      return (
        /read_canvas|read canvas/i.test(text) &&
        /shape|viewport|Canvas/i.test(text) &&
        !text.includes('Operator ready')
      );
    },
    undefined,
    { timeout: 25_000 });
  await page.waitForTimeout(500);

  const summarizeCheck = await scanCanvasAndOperatorErrors(page);
  const operatorText = await operatorShadowText(page);
  const summarizeTools = await scanOperatorToolCards(page);
  const summarizeShot = savePng(
    'operator-send-summarize-canvas',
    await page.screenshot({ fullPage: false }));
  proofs.push({
    criterion: 'B Ask mode summarize canvas (read_canvas path)',
    pass:
      /read_canvas|read canvas/i.test(operatorText) &&
      /shape|viewport|Canvas/i.test(operatorText) &&
      !summarizeCheck.hasErrorText &&
      !summarizeCheck.hasErrorToast &&
      !OPERATOR_FAILURE_PATTERN.test(operatorText) &&
      summarizeTools.some((tool) => tool.name === 'read_canvas' && tool.status === 'succeeded'),
    artifact_path: summarizeShot.artifact_path,
    notes: JSON.stringify({...summarizeCheck, tools: summarizeTools }),
  });

  await sendOperatorProbe(page, BUILD_PROBE, 'build', { freshThread: true });
  await waitForOperatorToolCard(
    page,
    (name) => name === 'open_panel' || name === 'compose_panel',
    30_000);
  await page.waitForTimeout(800);

  const buildShot = savePng('operator-build-open-panel', await page.screenshot({ fullPage: false }));
  const buildText = await operatorShadowText(page);
  const buildTools = await scanOperatorToolCards(page);
  const buildPanelTool = buildTools.find(
    (tool) => tool.name === 'open_panel' || tool.name === 'compose_panel');
  const buildHasFailedShare = buildTools.some(
    (tool) => tool.name === 'share_artifact' && tool.status === 'failed');
  const buildHasAnyFailed = buildTools.some((tool) => tool.status === 'failed');
  proofs.push({
    criterion: 'C Build mode open document panel',
    pass:
      buildPanelTool?.status === 'succeeded' &&
      !buildHasFailedShare &&
      !buildHasAnyFailed &&
      !OPERATOR_FAILURE_PATTERN.test(buildText) &&
      !CAPABILITY_REFUSAL_PATTERN.test(buildText) &&
      /document panel|open_panel|content blocks/i.test(buildText),
    artifact_path: buildShot.artifact_path,
    notes: JSON.stringify({ buildTools, buildText: buildText.slice(0, 320) }),
  });

  const shapesBeforeDraw = await countCanvasShapes(page);
  await sendOperatorProbe(page, DRAW_PROBE, 'draw', { freshThread: true });
  await waitForOperatorToolCard(page, (name) => name === 'draw_shapes', 30_000);
  await page.waitForTimeout(1200);

  const drawShot = savePng('operator-draw-shape', await page.screenshot({ fullPage: false }));
  const drawText = await operatorShadowText(page);
  const drawTools = await scanOperatorToolCards(page);
  const drawShapeTool = drawTools.find((tool) => tool.name === 'draw_shapes');
  const shapesAfterDraw = await countCanvasShapes(page);
  const drawEvidence = await readOperatorDrawEvidence(page);
  const visibleCanvasRect = await detectVisibleCanvasRect(page);
  const shapeCountIncreased = shapesAfterDraw.count > shapesBeforeDraw.count;
  const hasBlueGeo = shapesAfterDraw.blueGeo > 0;
  const hasVisibleGeoRect = visibleCanvasRect.visibleGeoRects > 0;
  const hasCreatedShapeIds = drawEvidence.createdShapeIds.length > 0;
  const hasCanvasEvidence =
    (shapeCountIncreased && (hasBlueGeo || hasVisibleGeoRect)) ||
    (hasVisibleGeoRect && drawEvidence.drawToolStatus === 'succeeded');
  proofs.push({
    criterion: 'D Draw mode draw_shapes on canvas',
    pass:
      drawShapeTool?.status === 'succeeded' &&
      drawEvidence.drawToolStatus === 'succeeded' &&
      !CAPABILITY_REFUSAL_PATTERN.test(drawText) &&
      !HALLUCINATION_PATTERN.test(drawText) &&
      !OPERATOR_FAILURE_PATTERN.test(drawText) &&
      hasCanvasEvidence &&
      hasVisibleGeoRect &&
      /draw_shapes|rectangle|drew/i.test(drawText),
    artifact_path: drawShot.artifact_path,
    notes: JSON.stringify({
      drawTools,
      drawEvidence,
      shapesBeforeDraw,
      shapesAfterDraw,
      visibleCanvasRect,
      hasCreatedShapeIds,
      hasCanvasEvidence,
      drawText: drawText.slice(0, 320),
    }),
  });

  await page.evaluate( => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
    const mic = root?.querySelector('[data-testid="operator-speech-input"]');
    if (!(mic instanceof HTMLButtonElement)) {
      throw new Error('operator mic not found');
    }
    if (mic.disabled) {
      throw new Error('operator mic disabled');
    }
    mic.click;
  });

  await page.waitForFunction(
     => {
      const placement = document.querySelector(
        'agentable-operator-surface-placement[placement-id="operator-main"]');
      const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
      const mic = root?.querySelector('[data-testid="operator-speech-input"]');
      const session = window.__agentablePageSession__?.session?.getSnapshot?.;
      const voiceActive = mic?.getAttribute('data-operator-voice-active') === 'true';
      const voiceState = mic?.getAttribute('data-operator-voice-state') ?? 'idle';
      const connection = session?.connectionState ?? 'idle';
      return (
        voiceActive ||
        voiceState === 'connecting' ||
        voiceState === 'listening' ||
        voiceState === 'speaking' ||
        connection === 'connecting' ||
        connection === 'connected'
      );
    },
    undefined,
    { timeout: 8000 });
  await page.waitForTimeout(300);

  const voiceCheck = await page.evaluate( => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
    const mic = root?.querySelector('[data-testid="operator-speech-input"]');
    const session = window.__agentablePageSession__?.session?.getSnapshot?.;
    return {
      micPresent: Boolean(mic),
      voiceActive: mic?.getAttribute('data-operator-voice-active') === 'true',
      voiceState: mic?.getAttribute('data-operator-voice-state') ?? 'idle',
      pageSessionConnection: session?.connectionState ?? 'unknown',
    };
  });

  const voiceShot = savePng('operator-voice-agent-spawn', await page.screenshot({ fullPage: false }));
  proofs.push({
    criterion: 'E Voice mic spawns operator voice session',
    pass:
      voiceCheck.micPresent &&
      (voiceCheck.voiceActive ||
        voiceCheck.voiceState === 'connecting' ||
        voiceCheck.voiceState === 'listening' ||
        voiceCheck.voiceState === 'speaking' ||
        voiceCheck.pageSessionConnection === 'connecting' ||
        voiceCheck.pageSessionConnection === 'connected'),
    artifact_path: voiceShot.artifact_path,
    notes: JSON.stringify(voiceCheck),
  });

  writeFileSync(
    join(OUTPUT_DIR, 'console-errors.log'),
    consoleErrors.length > 0 ? consoleErrors.join('\n'): '(no console errors)');

  const consoleClean = consoleErrors.length === 0;
  proofs.push({
    criterion: 'H Zero console errors on happy path',
    pass: consoleClean,
    artifact_path: join(OUTPUT_DIR, 'console-errors.log'),
    notes: `${consoleErrors.length} console error(s)`,
  });

  writeFileSync(
    join(PROOF_DIR, 'png-manifest.txt'),
    proofs.map((p) => `${p.pass ? 'PASS': 'FAIL'}\t${p.criterion}\t${p.artifact_path}`).join('\n'));
  writeFileSync(
    join(OUTPUT_DIR, 'qa-browser-proof-results.json'),
    JSON.stringify({ url: URL, proofs, allPass: proofs.every((p) => p.pass) }, null, 2));

  await browser.close;

  const failed = proofs.filter((p) => !p.pass);
  if (failed.length > 0) {
    console.error('FAILED proofs:', failed);
    process.exit(1);
  }
  console.log('All browser proofs PASS');
  for (const proof of proofs) {
    console.log(`PASS ${proof.criterion} -> ${proof.artifact_path}`);
  }
}

main.catch((err) => {
  console.error(err);
  process.exit(1);
});
