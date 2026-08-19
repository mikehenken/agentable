/**
 * browser proof — operator-only chat, NAS UI, live path wiring.
 * Run: node scripts/qa-p13-t7-iter5-browser-proof.mjs
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
const OPERATOR_PROBE = ' iter5 operator NAS probe';

mkdirSync(PROOF_DIR, { recursive: true });
mkdirSync(OUTPUT_DIR, { recursive: true });

/** @typedef {{ criterion: string; pass: boolean; artifact_path: string; notes: string }} ProofRow *** @type {ProofRow[]} */
const proofs = [];

/**
 * @param {ParentNode} node
 */
function walkText(node) {
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
async function operatorShadowRoot(page) {
  return page.evaluateHandle( => {
    const placement = document.querySelector('.operator-rail agentable-operator-surface-placement');
    return placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot ?? null;
  });
}

/**
 * @param {import('playwright').Page} page
 * @param {string} text
 */
async function sendOperatorMessage(page, text) {
  await page.evaluate((message) => {
    const placement = document.querySelector('.operator-rail agentable-operator-surface-placement');
    const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
    const textarea = root?.querySelector('textarea');
    const submit = root?.querySelector('[part="composer-submit"]');
    if (!(textarea instanceof HTMLTextAreaElement) || !(submit instanceof HTMLButtonElement)) {
      throw new Error('operator composer not found');
    }
    textarea.focus;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value')?.set;
    setter?.call(textarea, message);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    submit.click;
  }, text);
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
  await page.goto(URL);
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
}

async function main {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage;

  await waitForGalleryReady(page);

  const canvasChatCheck = await page.evaluate( => {
    const whiteboard = document.querySelector('agentable-whiteboard');
    const chatDisabled = whiteboard?.getAttribute('open-chat-on-mount') === 'false';
    const chatPanel = document.querySelector('[data-testid="landi-chat-panel"]');
    const panelShapeChat = document.querySelector('[data-panel-id="chat"], [data-shape-type="panel"][data-panel-type="chat"]');
    return {
      chatDisabled,
      hasFloatingChatPanel: Boolean(chatPanel || panelShapeChat),
      galleryResult: window.__operatorGalleryResult ?? null,
    };
  });

  const noCanvasChatShot = savePng(
    'no-canvas-chat-panel',
    await page.screenshot({ fullPage: false }));
  proofs.push({
    criterion: 'A No in-canvas Atlas chat (open-chat-on-mount=false)',
    pass: canvasChatCheck.chatDisabled && !canvasChatCheck.hasFloatingChatPanel,
    artifact_path: noCanvasChatShot.artifact_path,
    notes: JSON.stringify(canvasChatCheck),
  });

  const nasUiCheck = await page.evaluate( => {
    const placement = document.querySelector('.operator-rail agentable-operator-surface-placement');
    const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
    return {
      speech: Boolean(root?.querySelector('[data-testid="operator-speech-input"]')),
      attachmentButton: Boolean(root?.querySelector('[data-testid="operator-attachment-button"]')),
      threadTabs: root?.querySelectorAll('[data-thread-tab]').length ?? 0,
      modelSelector: Boolean(root?.querySelector('select.model-switcher, select[part="model-switcher"]')),
    };
  });

  const nasUiShot = savePng('operator-nas-ui-wired', await page.screenshot({ fullPage: false }));
  proofs.push({
    criterion: 'C NAS UI wired (voice, attachments, tabs, model selector)',
    pass:
      nasUiCheck.speech &&
      nasUiCheck.attachmentButton &&
      nasUiCheck.threadTabs >= 1 &&
      nasUiCheck.modelSelector,
    artifact_path: nasUiShot.artifact_path,
    notes: JSON.stringify(nasUiCheck),
  });

  const textarea = page.locator('.operator-rail textarea').first;
  await textarea.fill(OPERATOR_PROBE);
  await page.locator('.operator-rail [part="composer-submit"]').first.click;
  await page.waitForFunction( => {
    const placement = document.querySelector('.operator-rail agentable-operator-surface-placement');
    const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
    return Boolean(root?.querySelector('[part="composer-submit"]'));
  }, { timeout: 15_000 });
  await page.waitForTimeout(400);

  const sendCheck = await page.evaluate((probe) => {
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
    return {
      hasUserMessage: text.includes(probe),
      hasGalleryDemo: /gallery demo mode/i.test(text),
      hasErrorToast: Boolean(root?.querySelector('[data-testid="operator-error-toast"]')),
    };
  }, OPERATOR_PROBE);

  const sendShot = savePng('operator-send-no-demo-toast', await page.screenshot({ fullPage: false }));
  proofs.push({
    criterion: 'B Live/offline send without gallery demo toast',
    pass: sendCheck.hasUserMessage && !sendCheck.hasGalleryDemo,
    artifact_path: sendShot.artifact_path,
    notes: JSON.stringify(sendCheck),
  });

  await page.locator('.operator-rail [data-testid="operator-new-thread"]').click;
  await page.waitForTimeout(500);
  await textarea.fill('Persistence thread B');
  await page.locator('.operator-rail [part="composer-submit"]').first.click;
  await page.waitForFunction( => {
    const placement = document.querySelector('.operator-rail agentable-operator-surface-placement');
    const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
    return Boolean(root?.querySelector('[part="composer-submit"]'));
  }, { timeout: 15_000 });
  await page.waitForTimeout(400);

  const threadIds = await page.evaluate( => {
    const placement = document.querySelector('.operator-rail agentable-operator-surface-placement');
    const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
    return [...(root?.querySelectorAll('[data-thread-tab]') ?? [])].map((el) => el.getAttribute('data-thread-tab'));
  });

  if (threadIds.length >= 2) {
    const closeId = threadIds[1];
    page.once('dialog', (dialog) => dialog.accept);
    await page.evaluate((threadId) => {
      const placement = document.querySelector('.operator-rail agentable-operator-surface-placement');
      const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
      root
        ?.querySelector(`[data-testid="operator-close-thread-${threadId}"]`)
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, closeId);
    await page.waitForTimeout(500);
  }

  const closeTabShot = savePng('operator-close-tab', await page.screenshot({ fullPage: false }));
  const afterCloseCount = await page.evaluate( => {
    const placement = document.querySelector('.operator-rail agentable-operator-surface-placement');
    const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
    return root?.querySelectorAll('[data-thread-tab]').length ?? 0;
  });
  proofs.push({
    criterion: 'C Close tab UX',
    pass: afterCloseCount >= 1 && afterCloseCount < threadIds.length,
    artifact_path: closeTabShot.artifact_path,
    notes: `before=${threadIds.length} after=${afterCloseCount}`,
  });

  await page.reload;
  await page.waitForFunction(
     => window.__operatorGalleryResult?.ok === true,
    { timeout: 45_000 });
  await page.waitForTimeout(800);

  const persistenceCheck = await page.evaluate((probe) => {
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
    return {
      persistedProbe: text.includes(probe),
      tabCount: root?.querySelectorAll('[data-thread-tab]').length ?? 0,
    };
  }, OPERATOR_PROBE);

  const persistenceShot = savePng('operator-persistence-after-reload', await page.screenshot({ fullPage: false }));
  proofs.push({
    criterion: 'C Tab transcript persists after reload',
    pass: persistenceCheck.persistedProbe && persistenceCheck.tabCount >= 1,
    artifact_path: persistenceShot.artifact_path,
    notes: JSON.stringify(persistenceCheck),
  });

  writeFileSync(join(PROOF_DIR, 'png-manifest.txt'), proofs.map((p) => `${p.pass ? 'PASS': 'FAIL'}\t${p.criterion}\t${p.artifact_path}`).join('\n'));
  writeFileSync(join(OUTPUT_DIR, 'qa-browser-proof-results.json'), JSON.stringify({ url: URL, proofs, allPass: proofs.every((p) => p.pass) }, null, 2));

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
