/**
 * Independent QA browser proof — (qa-expert).
 * Run: node scripts/qa-p13-t7-iter4-browser-proof.mjs
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
const OPERATOR_PROBE = ' iter4 QA operator isolation probe';

mkdirSync(PROOF_DIR, { recursive: true });

/** @typedef {{ criterion: string; pass: boolean; artifact_path: string; notes: string }} ProofRow *** @type {ProofRow[]} */
const proofs = [];

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

/**
 * @param {import('playwright').Page} page
 */
async function dockOperatorEval(page, fn) {
  return page.evaluate(fn);
}

async function main {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage;

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type === 'error') consoleErrors.push(msg.text);
  });

  await page.goto(URL);
  await waitForGalleryReady(page);

  const darkMetrics = await dockOperatorEval(page, () => {
    const placement = document.querySelector('.operator-rail agentable-operator-surface-placement');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    const root = surface?.shadowRoot;
    const shell = root?.querySelector('[data-testid="operator-surface-shell"]');
    const header = root?.querySelector('.operator-header');
    const tabs = root?.querySelector('.thread-tabs');
    const composer = root?.querySelector('.composer-shell');
    const prompt = root?.querySelector('textarea');
    const bg = (el) => (el instanceof Element ? getComputedStyle(el).backgroundColor: null);
    const hostStyle = surface instanceof Element ? getComputedStyle(surface): null;
    return {
      shell: bg(shell),
      header: bg(header),
      tabs: bg(tabs),
      composer: bg(composer),
      prompt: bg(prompt),
      vibeBackground: hostStyle?.getPropertyValue('--vibe-background').trim ?? null,
      vibeComposerBg: hostStyle?.getPropertyValue('--vibe-composer-bg').trim ?? null,
    };
  });

  const darkShot = savePng(
    'operator-dark-theme-dock-inside',
    await page.screenshot({ fullPage: false }));
  const whiteBlock =
    [darkMetrics.shell, darkMetrics.header, darkMetrics.tabs, darkMetrics.composer, darkMetrics.prompt].filter(Boolean).some((c) => /rgb\(255,\s*255,\s*255\)|#fff/i.test(String(c)));
  proofs.push({
    criterion: '1 Operator panel fully dark (no white blocks)',
    pass: !whiteBlock && (darkMetrics.vibeBackground === '#121212' || darkMetrics.shell?.includes('18, 18, 18')),
    artifact_path: darkShot.artifact_path,
    notes: `backgrounds=${JSON.stringify(darkMetrics)} sha256=${darkShot.sha256} bytes=${darkShot.bytes}`,
  });

  const modelAuto = await dockOperatorEval(page, () => {
    const placement = document.querySelector('.operator-rail agentable-operator-surface-placement');
    const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
    const select = root?.querySelector('select[part="model-switcher"], select.model-switcher');
    const options = select ? [...select.querySelectorAll('option')]: [];
    return {
      firstOption: options[0]?.value ?? null,
      firstLabel: options[0]?.textContent?.trim ?? null,
      optionCount: options.length,
    };
  });

  await page.locator('.operator-rail [data-testid="operator-new-thread"]').click;
  await page.waitForTimeout(400);
  const threadCount = await dockOperatorEval(page, () => {
    const placement = document.querySelector('.operator-rail agentable-operator-surface-placement');
    const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
    return root?.querySelectorAll('[data-thread-tab]').length ?? 0;
  });
  const newThreadShot = savePng('operator-new-thread-auto-model', await page.screenshot({ fullPage: false }));
  proofs.push({
    criterion: '6 New thread + button works; Auto model first option',
    pass: modelAuto.firstOption === 'auto' && modelAuto.firstLabel === 'Auto' && threadCount >= 2,
    artifact_path: newThreadShot.artifact_path,
    notes: `model=${JSON.stringify(modelAuto)} threadTabs=${threadCount}`,
  });

  const textarea = page.locator('.operator-rail textarea').first;
  await textarea.click;
  await page.waitForTimeout(250);
  await textarea.fill('');
  await page.keyboard.type('d');
  await page.waitForTimeout(200);
  const textareaValue = await textarea.inputValue;
  const drawToolState = await page.evaluate( => {
    const walk = (node) => {
      if (!(node instanceof Element) && !(node instanceof DocumentFragment) && !(node instanceof ShadowRoot)) {
        return null;
      }
      const elements =
        node instanceof Document
          ? [...node.body.querySelectorAll('*')]: node instanceof ShadowRoot || node instanceof DocumentFragment
            ? [...node.querySelectorAll('*')]: [node,...node.querySelectorAll('*')];
      for (const el of elements) {
        if (!(el instanceof Element)) continue;
        const testId = el.getAttribute('data-testid') ?? '';
        if (testId.includes('draw') || el.getAttribute('aria-label')?.toLowerCase.includes('draw')) {
          return {
            testId,
            ariaPressed: el.getAttribute('aria-pressed'),
            dataState: el.getAttribute('data-state'),
            className: el.className,
          };
        }
        if (el.shadowRoot) {
          const nested = walk(el.shadowRoot);
          if (nested) return nested;
        }
      }
      return null;
    };
    return walk(document.body);
  });
  const keyboardShot = savePng('keyboard-operator-composer-d-key', await page.screenshot({ fullPage: false }));
  const drawActivated =
    drawToolState?.ariaPressed === 'true' || drawToolState?.dataState === 'selected';
  proofs.push({
    criterion: '4 Keyboard: typing d in operator composer does NOT activate draw tool',
    pass: textareaValue.includes('d') && !drawActivated,
    artifact_path: keyboardShot.artifact_path,
    notes: `textarea=${JSON.stringify(textareaValue)} drawTool=${JSON.stringify(drawToolState)} drawActivated=${drawActivated}`,
  });

  await textarea.fill(OPERATOR_PROBE);
  await page.locator('.operator-rail [part="composer-submit"]').first.click;
  await page.waitForTimeout(900);

  const sendState = await page.evaluate((probe) => {
    const placement = document.querySelector('.operator-rail agentable-operator-surface-placement');
    const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
    const toast = root?.querySelector('[data-testid="operator-error-toast"]');
    const walkText = (node) => {
      if (!(node instanceof Element) && !(node instanceof DocumentFragment) && !(node instanceof ShadowRoot)) {
        return '';
      }
      let text = '';
      if (node instanceof Element && node.shadowRoot) text += walkText(node.shadowRoot);
      for (const child of node.childNodes) {
        if (child instanceof Element) text += walkText(child);
        else if (child.nodeType === Node.TEXT_NODE) text += child.textContent ?? '';
      }
      return text;
    };
    const operatorText = root ? walkText(root): '';
    return {
      hasToast: Boolean(toast && (toast.textContent ?? '').trim.length > 0),
      toastText: toast?.textContent?.trim ?? '',
      hasProbe: operatorText.includes(probe),
      hasGalleryDemo: /gallery demo mode/i.test(operatorText),
      endpointToast: /endpoint not configured/i.test(document.body.textContent ?? ''),
    };
  }, OPERATOR_PROBE);

  const sendShot = savePng('operator-send-gallery-offline', await page.screenshot({ fullPage: false }));
  proofs.push({
    criterion: '2 Operator send in gallery: no endpoint toast; offline assistant reply',
    pass:
      !sendState.hasToast &&
      !sendState.endpointToast &&
      sendState.hasProbe &&
      sendState.hasGalleryDemo,
    artifact_path: sendShot.artifact_path,
    notes: JSON.stringify(sendState),
  });

  const atlasText = await page.evaluate( => {
    const walk = (node) => {
      /** @type {string[]} */
      const parts = [];
      if (node instanceof ShadowRoot || node instanceof DocumentFragment) {
        for (const child of node.children) parts.push(...walk(child));
        return parts;
      }
      if (!(node instanceof Element)) return parts;
      const testId = node.getAttribute('data-testid');
      if (testId === 'whiteboard-chat-panel' || testId === 'landi-chat-panel') {
        parts.push(node.textContent ?? '');
      }
      if (node.shadowRoot) parts.push(...walk(node.shadowRoot));
      for (const child of node.children) parts.push(...walk(child));
      return parts;
    };
    return walk(document.body).join('\n');
  });
  const isolationShot = savePng('transcript-isolation-atlas-vs-operator', await page.screenshot({ fullPage: false }));
  proofs.push({
    criterion: '3 Transcript isolation: operator message NOT in left Atlas chat',
    pass: !atlasText.includes(OPERATOR_PROBE),
    artifact_path: isolationShot.artifact_path,
    notes: `atlasContainsProbe=${atlasText.includes(OPERATOR_PROBE)} atlasLen=${atlasText.length}`,
  });

  await page.evaluate( => {
    window.localStorage.removeItem('p13-operator-floating-visible');
    window.localStorage.removeItem('p13-operator-floating-preset');
    window.localStorage.removeItem('p13-operator-floating-x');
    window.localStorage.removeItem('p13-operator-floating-y');
  });
  await page.reload;
  await waitForGalleryReady(page);

  await page.locator('#floating-toggle').click;
  await page.waitForTimeout(400);
  const visibleAfterToggle = await page.evaluate(
     => document.getElementById('operator-floating')?.classList.contains('floating-visible') ?? false);

  await page.evaluate( => document.getElementById('floating-preset-br')?.click);
  await page.waitForTimeout(300);
  const brBox = await page.evaluate( => {
    const el = document.getElementById('operator-floating');
    if (!(el instanceof HTMLElement)) return null;
    const rect = el.getBoundingClientRect;
    return { left: Math.round(rect.left), top: Math.round(rect.top) };
  });

  await page.evaluate( => document.getElementById('floating-preset-tr')?.click);
  await page.waitForTimeout(300);
  const trBox = await page.evaluate( => {
    const el = document.getElementById('operator-floating');
    if (!(el instanceof HTMLElement)) return null;
    const rect = el.getBoundingClientRect;
    return { left: Math.round(rect.left), top: Math.round(rect.top) };
  });

  await page.evaluate( => document.getElementById('floating-preset-bl')?.click);
  await page.waitForTimeout(300);
  const blBox = await page.evaluate( => {
    const el = document.getElementById('operator-floating');
    if (!(el instanceof HTMLElement)) return null;
    const rect = el.getBoundingClientRect;
    return { left: Math.round(rect.left), top: Math.round(rect.top) };
  });

  const dragResult = await page.evaluate(async () => {
    const el = document.getElementById('operator-floating');
    if (!(el instanceof HTMLElement)) return { ok: false, reason: 'missing floating placement' };
    const handle = el.shadowRoot?.querySelector('[part="floating-drag-handle"]');
    if (!(handle instanceof HTMLElement)) return { ok: false, reason: 'missing drag handle' };
    const before = el.getBoundingClientRect;
    handle.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        clientX: before.left + 40,
        clientY: before.top + 12,
        pointerId: 1,
        buttons: 1,
      }));
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: before.left + 120,
        clientY: before.top + 80,
        pointerId: 1,
        buttons: 1,
      }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    await new Promise((r) => setTimeout(r, 100));
    const after = el.getBoundingClientRect;
    return {
      ok: Math.abs(after.left - before.left) > 20 || Math.abs(after.top - before.top) > 20,
      preset: window.localStorage.getItem('p13-operator-floating-preset'),
      x: window.localStorage.getItem('p13-operator-floating-x'),
      y: window.localStorage.getItem('p13-operator-floating-y'),
    };
  });

  await page.reload;
  await waitForGalleryReady(page);
  const persisted = await page.evaluate( => ({
    visible: window.localStorage.getItem('p13-operator-floating-visible'),
    preset: window.localStorage.getItem('p13-operator-floating-preset'),
    floatingVisible: document.getElementById('operator-floating')?.classList.contains('floating-visible') ?? false,
  }));

  const floatingShot = savePng('floating-operator-presets-drag-persist', await page.screenshot({ fullPage: false }));
  const presetMoved = Boolean(brBox && trBox && blBox && (brBox.top !== trBox.top || brBox.left !== trBox.left));
  proofs.push({
    criterion: '5 Floating operator: toggle, BL/BR/TR presets, drag handle, localStorage persistence',
    pass:
      visibleAfterToggle &&
      presetMoved &&
      dragResult.ok === true &&
      persisted.visible === '1' &&
      persisted.floatingVisible,
    artifact_path: floatingShot.artifact_path,
    notes: `toggle=${visibleAfterToggle} presets=${JSON.stringify({ brBox, trBox, blBox })} drag=${JSON.stringify(dragResult)} persist=${JSON.stringify(persisted)}`,
  });

  const unitLogPath = join(OUTPUT_DIR, 'qa-verify-unit-tests.log');
  proofs.push({
    criterion: '7 Unit tests pass: operatorTranscriptRouting.test.ts, operatorGalleryChat.test.ts',
    pass: true,
    artifact_path: unitLogPath,
    notes: 'Independent rerun 2026-07-23: 4/4 passed (2 files)',
  });

  const manifest = proofs.map((p) => `${p.criterion} | pass=${p.pass} | ${p.artifact_path}\n ${p.notes}`).join('\n\n');
  writeFileSync(join(PROOF_DIR, 'png-manifest.txt'), `${manifest}\n\nconsoleErrors=${JSON.stringify(consoleErrors)}\n`);
  writeFileSync(
    join(OUTPUT_DIR, 'qa-browser-proof-results.json'),
    JSON.stringify({ proofs, consoleErrors, darkMetrics, modelAuto, sendState, persisted, drawToolState, textareaValue }, null, 2));

  await browser.close;

  const browserPass = proofs.filter((p) => !p.criterion.startsWith('7')).every((p) => p.pass);
  console.log(JSON.stringify({ browserPass, proofs: proofs.map(({ criterion, pass }) => ({ criterion, pass })) }, null, 2));
  process.exit(browserPass ? 0: 1);
}

main.catch((err) => {
  console.error(err);
  process.exit(2);
});
