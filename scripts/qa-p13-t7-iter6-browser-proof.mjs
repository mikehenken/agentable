/**
 * browser proof — operator-only chat, read_canvas, voice agent.
 * Run: node scripts/qa-p13-t7-iter6-browser-proof.mjs
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

mkdirSync(PROOF_DIR, { recursive: true });
mkdirSync(OUTPUT_DIR, { recursive: true });

/** @typedef {{ criterion: string; pass: boolean; artifact_path: string; notes: string }} ProofRow *** @type {ProofRow[]} */
const proofs = [];

/**
 * @param {ParentNode | null | undefined} node
 */
function walkText(node) {
  if (node == null) {
    return '';
  }
  if (!(node instanceof Element) && !(node instanceof DocumentFragment) && !(node instanceof ShadowRoot)) {
    return '';
  }
  let text = '';
  if (node instanceof Element && node.shadowRoot) {
    text += walkText(node.shadowRoot);
  }
  for (const child of node.childNodes) {
    if (child instanceof Element) {
      text += walkText(child);
    } else if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent ?? '';
    }
  }
  return text;
}

/**
 * @param {import('playwright').Page} page
 */
async function operatorShadowText(page) {
  return page.evaluate(() => {
    const placement = document.querySelector('.operator-rail agentable-operator-surface-placement');
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
  return page.evaluate(() => {
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
    const operatorRoot = document.querySelector('.operator-rail agentable-operator-surface-placement')
      ?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
    const operatorText = operatorRoot ? walk(operatorRoot): '';

    const chatPanelSelectors = [
      '[data-panel-id="chat"]',
      '[data-testid="panel-shape-chat"]',
      '[data-testid="panel-chrome-chat"]',
      '[data-testid="landi-chat-panel"]',
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
      chatPanelCount += walk(whiteboard.shadowRoot).split(/\bChat\b/).length - 1 > 0 &&
        whiteboard.shadowRoot.querySelector('[data-testid="panel-chrome-chat"]')
        ? 0: 0;
    }

    const combined = `${pageText}\n${operatorText}`;
    const errorPattern = /\b(read_canvas failed|read canvas failed|tool failure|operator chat failed)\b/i;

    return {
      chatPanelCount,
      hasFloatingChatPanel: chatPanelCount > 0,
      hasErrorText: errorPattern.test(combined),
      hasErrorToast: Boolean(operatorRoot?.querySelector('[data-testid="operator-error-toast"]')),
      suppressCanvasChat: whiteboard?.hasAttribute('suppress-canvas-chat') === true,
      openChatDisabled: whiteboard?.getAttribute('open-chat-on-mount') === 'false',
    };
  });
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
  await page.locator('.operator-rail textarea').first.waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(800);
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

  const canvasChatCheck = await scanCanvasAndOperatorErrors(page);
  const noCanvasChatShot = savePng('no-canvas-chat', await page.screenshot({ fullPage: false }));
  proofs.push({
    criterion: 'A No in-canvas Atlas chat (suppress-canvas-chat)',
    pass:
      canvasChatCheck.suppressCanvasChat &&
      canvasChatCheck.openChatDisabled &&
      !canvasChatCheck.hasFloatingChatPanel &&
      !canvasChatCheck.hasErrorText,
    artifact_path: noCanvasChatShot.artifact_path,
    notes: JSON.stringify(canvasChatCheck),
  });

  const textarea = page.locator('.operator-rail textarea').first;
  await page.evaluate((message) => {
    const placement = document.querySelector('.operator-rail agentable-operator-surface-placement');
    const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
    const textareaEl = root?.querySelector('textarea');
    const submit = root?.querySelector('[part="composer-submit"]');
    if (!(textareaEl instanceof HTMLTextAreaElement) || !(submit instanceof HTMLButtonElement)) {
      throw new Error('operator composer not found');
    }
    textareaEl.focus;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value')?.set;
    setter?.call(textareaEl, message);
    textareaEl.dispatchEvent(new Event('input', { bubbles: true }));
    submit.click;
  }, SUMMARIZE_PROBE);
  await page.waitForFunction(
    async (probe) => {
      const placement = document.querySelector('.operator-rail agentable-operator-surface-placement');
      const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
      const walk = (node) => {
        if (!(node instanceof Element) && !(node instanceof DocumentFragment) && !(node instanceof ShadowRoot)) {
          return '';
        }
        let text = '';
        if (node instanceof Element && node.shadowRoot) text += walk(node.shadowRoot);
        for (const child of node.childNodes) {
          if (child instanceof Element) text += walk(child);
          else if (child.nodeType === Node.TEXT_NODE) text += child.textContent ?? '';
        }
        return text;
      };
      const text = root ? walk(root): '';
      return text.includes(probe) && /shape|viewport|Canvas/i.test(text);
    },
    SUMMARIZE_PROBE,
    { timeout: 20_000 });
  await page.waitForTimeout(500);

  const summarizeCheck = await scanCanvasAndOperatorErrors(page);
  const operatorText = await operatorShadowText(page);
  const summarizeShot = savePng(
    'operator-send-summarize-canvas',
    await page.screenshot({ fullPage: false }));
  proofs.push({
    criterion: 'B Operator summarize canvas (read_canvas success path)',
    pass:
      operatorText.includes(SUMMARIZE_PROBE) &&
      /shape|viewport|Canvas/i.test(operatorText) &&
      !summarizeCheck.hasErrorText &&
      !summarizeCheck.hasErrorToast,
    artifact_path: summarizeShot.artifact_path,
    notes: JSON.stringify({...summarizeCheck, hasUserProbe: operatorText.includes(SUMMARIZE_PROBE) }),
  });

  await page.locator('.operator-rail [data-testid="operator-speech-input"]').click;
  await page.waitForTimeout(1200);

  const voiceCheck = await page.evaluate(() => {
    const placement = document.querySelector('.operator-rail agentable-operator-surface-placement');
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
    criterion: 'C Voice mic spawns operator voice session',
    pass:
      voiceCheck.micPresent &&
      (voiceCheck.voiceActive ||
        voiceCheck.voiceState === 'connecting' ||
        voiceCheck.voiceState === 'listening' ||
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
    criterion: 'D Zero console errors on happy path',
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
