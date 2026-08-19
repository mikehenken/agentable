/**
 * — full.. browser verification (Playwright supplementary).
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const iterDir =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/retroactive-ui-coverage/12-open-agent-canvas/';
const shotDir = path.join(iterDir, 'screenshots/12-open-agent-canvas');
const reportPath = path.join(iterDir, 'gate7-browser-report.json');
const baseUrl = 'http://127.0.0.1:5199/examples/12-open-agent-canvas/index.html';
const cacheBust = 'iter4-cursor-20260723';

fs.mkdirSync(shotDir, { recursive: true });

/** @type {Record<string, unknown>} */
const report = {
  url: `${baseUrl}?v=${cacheBust}`,
  port: 5199,
  tool: 'playwright-supplementary',
  cursorIdeBrowserBlocked: true,
  cursorIdeBrowserError: 'browser_navigate → No browser tab available',
  build: 'npm run build:embed:whiteboard (fresh before run)',
  consoleMessages: [],
  consoleWarnings: [],
  consoleErrors: [],
  captures: [],
  steps: [],
};

function shadowQuery {
  function deepQuerySelector(selector) {
    const roots = [];
    const wb = document.querySelector('agentable-whiteboard');
    if (wb?.shadowRoot) roots.push(wb.shadowRoot);
    const seen = new Set;
    while (roots.length > 0) {
      const root = roots.shift;
      if (root === undefined || seen.has(root)) continue;
      seen.add(root);
      const hit = root.querySelector(selector);
      if (hit) return hit;
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) roots.push(el.shadowRoot);
      });
    }
    return null;
  }

  function queryVisible(selector) {
    const el = document.querySelector(selector) ?? deepQuerySelector(selector);
    if (!(el instanceof HTMLElement)) return null;
    const rect = el.getBoundingClientRect;
    if (rect.width <= 0 || rect.height <= 0) return null;
    return el;
  }

  function deepTextIncludes(needle) {
    const roots = [document];
    const wb = document.querySelector('agentable-whiteboard');
    if (wb?.shadowRoot) roots.push(wb.shadowRoot);
    const seen = new Set;
    while (roots.length > 0) {
      const root = roots.shift;
      if (root === undefined || seen.has(root)) continue;
      seen.add(root);
      if ((root.textContent ?? '').includes(needle)) return true;
      if ('querySelectorAll' in root) {
        root.querySelectorAll('*').forEach((el) => {
          if (el.shadowRoot) roots.push(el.shadowRoot);
        });
      }
    }
    return false;
  }

  const FUNNEL = ['Navigation', 'Hero headline', 'Feature grid', 'Sign up CTA'];
  const STENCILS = ['Meridian nav', 'Hero card', 'Email capture', 'Start trial'];
  const wb = document.querySelector('agentable-whiteboard');
  const shadow = wb?.shadowRoot ?? null;
  const text = shadow?.textContent ?? '';
  const docPanel = queryVisible('[data-testid="meridian-document-panel"]');
  const exportConfirmation = queryVisible('[data-testid="meridian-export-confirmation"]');
  const hitlCard = queryVisible('[data-testid="meridian-hitl-card"]');
  const canvases = shadow ? [...shadow.querySelectorAll('canvas')]: [];
  const rect = wb?.getBoundingClientRect;
  const blockTypes = ['heading', 'paragraph', 'list', 'callout'].filter((type) =>
    Boolean(queryVisible(`[data-block-type="${type}"]`) ?? deepQuerySelector(`[data-block-type="${type}"]`)));

  return {
    galleryDemoPhase: window.__galleryDemoPhase ?? null,
    galleryReady: window.__galleryReady ?? null,
    meridianDemoResult: window.__meridianDemoResult ?? null,
    meridianDocumentResult: window.__meridianDocumentResult ?? null,
    meridianExportResult: window.__meridianExportResult ?? null,
    meridianHitlResult: window.__meridianHitlResult ?? null,
    hasTldrawCanvas: canvases.length > 0,
    h1: document.querySelector('h1')?.textContent?.trim() ?? '',
    hasStatusJson: Boolean(document.querySelector('#status')),
    docHeightRatio:
      Math.round((document.documentElement.scrollHeight window.innerHeight) * 100) 100,
    canvasBandRatio: rect ? Math.round((rect.height window.innerHeight) * 100) 100: 0,
    funnelLabelsFound: FUNNEL.filter((label) => text.includes(label)),
    stencilLabelsFound: STENCILS.filter((label) => text.includes(label)),
    documentPanelVisible: Boolean(docPanel),
    documentTitleVisible: deepTextIncludes('Meridian Labs Product Brief'),
    blockTypesFound: blockTypes,
    blockCountVisible: blockTypes.length,
    exportConfirmationVisible: Boolean(exportConfirmation),
    exportMessageVisible: deepTextIncludes('PDF exported'),
    hitlCardVisible: Boolean(hitlCard),
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };
}

async function waitForMetric(page, predicate, timeoutMs = 90_000) {
  const deadline = Date.now + timeoutMs;
  while (Date.now < deadline) {
    const metrics = await page.evaluate(shadowQuery);
    if (predicate(metrics)) return metrics;
    await page.waitForTimeout(80);
  }
  return null;
}

async function capture(page, filename, phase) {
  const fullPath = path.join(shotDir, filename);
  await page.screenshot({ path: fullPath, fullPage: false });
  const stat = fs.statSync(fullPath);
  report.captures.push({ phase, filename, bytes: stat.size, path: fullPath });
}

async function captureWhiteboard(page, filename, phase) {
  const fullPath = path.join(shotDir, filename);
  await page.locator('agentable-whiteboard').screenshot({ path: fullPath });
  const stat = fs.statSync(fullPath);
  report.captures.push({ phase, filename, bytes: stat.size, path: fullPath });
}

async function runMeridianStep(page, step) {
  return page.evaluate(async (demoStep) => {
    const board = document.querySelector('agentable-whiteboard');
    if (!(board instanceof HTMLElement) || typeof board.runMeridianDemo !== 'function') {
      throw new Error('runMeridianDemo unavailable');
    }
    await board.whenReady(45_000);
    return board.runMeridianDemo(demoStep);
  }, step);
}

const browser = await chromium.launch({ headless: true });

async function setupPage(contextOptions) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage;

  page.on('console', (msg) => {
    const text = msg.text;
    report.consoleMessages.push({ type: msg.type, text });
    if (msg.type === 'warning') report.consoleWarnings.push(text);
    if (msg.type === 'error') report.consoleErrors.push(text);
  });
  page.on('pageerror', (err) => report.consoleErrors.push(err.message));

  await page.route('**/gallery-demo.mjs', (route) => route.abort);

  await page.goto(`${baseUrl}?v=${cacheBust}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });

  await page.waitForFunction(() => {
    const board = document.querySelector('agentable-whiteboard');
    return board instanceof HTMLElement;
  });

  return { context, page };
}

async function runDesktopManual {
  const { context, page } = await setupPage({ viewport: { width: 1280, height: 900 } });

  await page.waitForFunction(() => {
    const wb = document.querySelector('agentable-whiteboard');
    const shadow = wb?.shadowRoot;
    return Boolean(shadow?.querySelector('canvas'));
  }, null, { timeout: 90_000 });

  let metrics = await page.evaluate(shadowQuery);
  await capture(page, 'cursor-browser-01-initial-load-desktop.png', 'S0-US1');
  report.steps.push({ step: 'S0-initial', metrics });

  await captureWhiteboard(page, 'cursor-browser-02-whiteboard-empty.png', 'S1-US1-closeup');
  report.steps.push({ step: 'S1-whiteboard-closeup', metrics });

  await capture(page, 'cursor-browser-03-status-json.png', 'S2-status');
  report.steps.push({ step: 'S2-status-json', metrics });

  const wireframe = await runMeridianStep(page, 'wireframe');
  await page.waitForTimeout(600);
  metrics = await page.evaluate(shadowQuery);
  await captureWhiteboard(page, 'cursor-browser-02-whiteboard-wireframe.png', 'S1b-US2');
  report.steps.push({ step: 'S1-wireframe', wireframe, metrics });

  const documentPromise = runMeridianStep(page, 'document');
  await waitForMetric(
    page,
    (m) =>
      m.documentPanelVisible &&
      (m.blockTypesFound?.length ?? 0) >= 4 &&
      m.documentTitleVisible,
    45_000);
  await page.waitForTimeout(600);
  metrics = await page.evaluate(shadowQuery);
  await capture(page, 'cursor-browser-04-document-panel.png', 'S3-US3');
  const document = await documentPromise;
  report.steps.push({ step: 'S3-document', document, metrics });

  const exportPromise = runMeridianStep(page, 'export');
  await waitForMetric(
    page,
    (m) => m.exportConfirmationVisible && m.exportMessageVisible,
    45_000);
  await page.waitForTimeout(600);
  metrics = await page.evaluate(shadowQuery);
  await capture(page, 'cursor-browser-05-export-confirmation.png', 'S4-US4');
  const exportResult = await exportPromise;
  report.steps.push({ step: 'S4-export', exportResult, metrics });

  const hitlPromise = runMeridianStep(page, 'hitl');
  let hitlMetrics = null;
  let hitlCaptured = false;
  for (let i = 0; i < 250; i += 1) {
    hitlMetrics = await page.evaluate(shadowQuery);
    if (hitlMetrics.hitlCardVisible) {
      await page.waitForTimeout(800);
      hitlMetrics = await page.evaluate(shadowQuery);
      await capture(page, 'cursor-browser-06-hitl-approval-card.png', 'S5-US5');
      report.steps.push({ step: 'S5-hitl-capture', metrics: hitlMetrics });
      hitlCaptured = true;
      break;
    }
    await page.waitForTimeout(80);
  }
  const hitl = await hitlPromise;
  report.steps.push({
    step: 'S5-hitl-result',
    hitl,
    hitlCaptured,
    metrics: hitlMetrics ?? (await page.evaluate(shadowQuery)),
  });

  metrics = await page.evaluate(shadowQuery);
  report.steps.push({ step: 'final-settle', metrics });

  await context.close;
  return metrics;
}

async function runMobile {
  const { context, page } = await setupPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  await runMeridianStep(page, 'full');
  await page.waitForTimeout(1200);
  const metrics = await page.evaluate(shadowQuery);
  const mobilePath = path.join(shotDir, 'cursor-browser-m01-mobile-initial.png');
  await page.screenshot({ path: mobilePath, fullPage: true });
  const stat = fs.statSync(mobilePath);
  report.captures.push({
    phase: 'M0-US6',
    filename: 'cursor-browser-m01-mobile-initial.png',
    bytes: stat.size,
    path: mobilePath,
  });
  report.steps.push({ step: 'M0-mobile', metrics });
  await context.close;
  return metrics;
}

const desktopMetrics = await runDesktopManual;
const mobileMetrics = await runMobile;

report.desktop = desktopMetrics;
report.mobile = mobileMetrics;
report.capturedAt = new Date.toISOString();

const dupTldrawConsole = report.consoleMessages.some(
  (m) =>
    typeof m === 'object' &&
    m !== null &&
    'text' in m &&
    String(m.text).includes('multiple instances of some tldraw libraries'));
report.dupTldrawConsole = dupTldrawConsole;

const s1 = report.steps.find((s) => s.step === 'S1-wireframe');
const s3 = report.steps.find((s) => s.step === 'S3-document');
const s4 = report.steps.find((s) => s.step === 'S4-export');
const s5Capture = report.steps.find((s) => s.step === 'S5-hitl-capture');
const s5Result = report.steps.find((s) => s.step === 'S5-hitl-result');

report.usVerdict = {
  us1: Boolean(
    desktopMetrics?.h1?.includes('Meridian Labs') &&
      desktopMetrics?.hasTldrawCanvas &&
      !desktopMetrics?.hasStatusJson &&
      (desktopMetrics?.docHeightRatio ?? 99) <= 1.25 &&
      !dupTldrawConsole),
  us2: Boolean(
    (s1?.metrics?.funnelLabelsFound?.length ?? 0) >= 4 ||
      (s1?.metrics?.stencilLabelsFound?.length ?? 0) >= 4 ||
      s1?.wireframe?.summary?.flowBoxCount >= 4 ||
      s1?.wireframe?.ok === true),
  us3: Boolean(
    s3?.metrics?.documentPanelVisible &&
      (s3?.metrics?.blockTypesFound?.length ?? 0) >= 4 &&
      s3?.metrics?.documentTitleVisible &&
      (s3?.document?.document?.ok === true || s3?.document?.ok === true)),
  us4: Boolean(
    s4?.metrics?.exportConfirmationVisible &&
      s4?.metrics?.exportMessageVisible &&
      (s4?.exportResult?.ok === true || s4?.exportResult?.export?.ok === true)),
  us5: Boolean(
    s5Capture &&
      s5Capture.metrics?.hitlCardVisible &&
      (s5Result?.hitl?.ok === true || s5Result?.hitl?.hitl?.ok === true)),
  us6: Boolean(
    mobileMetrics?.canvasBandRatio >= 0.4 &&
      mobileMetrics?.hasTldrawCanvas &&
      (mobileMetrics?.stencilLabelsFound?.length ?? 0) >= 1),
};

report.verdict =
  report.usVerdict.us1 &&
  report.usVerdict.us2 &&
  report.usVerdict.us3 &&
  report.usVerdict.us4 &&
  report.usVerdict.us5 &&
  report.usVerdict.us6
    ? 'PASS': 'FAIL';

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
await browser.close;
console.log(JSON.stringify({ verdict: report.verdict, usVerdict: report.usVerdict, captures: report.captures }, null, 2));
