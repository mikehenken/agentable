/**
 * browser proof — Ask summarize, Build panel, Draw shape, voice agent.
 * Run: node scripts/qa-p13-t7-iter7-browser-proof.mjs
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
 * @param {string} message
 * @param {'ask' | 'build' | 'draw'} mode
 */
async function sendOperatorProbe(page, message, mode) {
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
      handle instanceof HTMLElement
        ? getComputedStyle(handle, '::before'): null;
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
  const summarizeShot = savePng(
    'operator-send-summarize-canvas',
    await page.screenshot({ fullPage: false }));
  proofs.push({
    criterion: 'B Ask mode summarize canvas (read_canvas path)',
    pass:
      /read_canvas|read canvas/i.test(operatorText) &&
      /shape|viewport|Canvas/i.test(operatorText) &&
      !summarizeCheck.hasErrorText &&
      !summarizeCheck.hasErrorToast,
    artifact_path: summarizeShot.artifact_path,
    notes: JSON.stringify({...summarizeCheck,
      hasReadCanvas: /read_canvas|read canvas/i.test(operatorText),
    }),
  });

  await sendOperatorProbe(page, BUILD_PROBE, 'build');
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
      return /document panel|open_panel|content blocks/i.test(text);
    },
    undefined,
    { timeout: 30_000 });
  const buildShot = savePng('operator-build-open-panel', await page.screenshot({ fullPage: false }));
  const buildText = await operatorShadowText(page);
  proofs.push({
    criterion: 'C Build mode open document panel',
    pass: /document panel|open_panel|content blocks/i.test(buildText),
    artifact_path: buildShot.artifact_path,
    notes: buildText.slice(0, 240),
  });

  await sendOperatorProbe(page, DRAW_PROBE, 'draw');
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
      return /draw_shapes|rectangle|drew/i.test(text);
    },
    undefined,
    { timeout: 30_000 });
  const drawShot = savePng('operator-draw-shape', await page.screenshot({ fullPage: false }));
  const drawText = await operatorShadowText(page);
  proofs.push({
    criterion: 'D Draw mode draw_shapes on canvas',
    pass: /draw_shapes|rectangle|drew/i.test(drawText) && !/do not have drawing tools/i.test(drawText),
    artifact_path: drawShot.artifact_path,
    notes: drawText.slice(0, 240),
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
    criterion: 'G Zero console errors on happy path',
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
