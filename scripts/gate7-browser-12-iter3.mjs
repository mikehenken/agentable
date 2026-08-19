/**
 * GATE 7 browser verification � 12-open-agent-canvas (manual steps).
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const shotDir =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/retroactive-ui-coverage/12-open-agent-canvasscreenshots/12-open-agent-canvas';
const reportPath =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/retroactive-ui-coverage/12-open-agent-canvas/gate7-browser-report.json';
const baseUrl = 'http://127.0.0.1:5199/examples/12-open-agent-canvas/index.html';

fs.mkdirSync(shotDir, { recursive: true });

/** @type {Record<string, unknown>} */
const report = {
  url: `${baseUrl}?v=iter3-manual-20260723`,
  port: 5199,
  tool: 'playwright-supplementary',
  cursorIdeBrowserBlocked: true,
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
      root.querySelectorAll('*').forEach((el) => { if (el.shadowRoot) roots.push(el.shadowRoot); });
    }
    return null;
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
      if ('querySelectorAll' in root) root.querySelectorAll('*').forEach((el) => { if (el.shadowRoot) roots.push(el.shadowRoot); });
    }
    return false;
  }
  const FUNNEL = ['Navigation', 'Hero headline', 'Feature grid', 'Sign up CTA'];
  const STENCILS = ['Meridian nav', 'Hero card', 'Email capture', 'Start trial'];
  const wb = document.querySelector('agentable-whiteboard');
  const shadow = wb?.shadowRoot ?? null;
  const text = shadow?.textContent ?? '';
  const docPanel = deepQuerySelector('[data-testid="meridian-document-panel-host"]');
  const approvalLayer = deepQuerySelector('[data-testid="panel-approval-layer"]');
  const approvalBadge = deepQuerySelector('[data-testid="approval-awaiting-badge"]');
  const approvalCard = deepQuerySelector('[data-testid="approval-card"]') ?? deepQuerySelector('.panel-approval-card');
  const canvases = shadow ? [...shadow.querySelectorAll('canvas')]: [];
  const rect = wb?.getBoundingClientRect;
  const blockTypes = ['heading', 'paragraph', 'list', 'callout'].filter((type) =>
    deepQuerySelector(`[data-block-type="${type}"]`));

  return {
    galleryReady: window.__galleryReady ?? null,
    meridianDemoResult: window.__meridianDemoResult ?? null,
    meridianDocumentResult: window.__meridianDocumentResult ?? null,
    meridianExportResult: window.__meridianExportResult ?? null,
    meridianHitlResult: window.__meridianHitlResult ?? null,
    hasTldrawCanvas: canvases.length > 0,
    h1: document.querySelector('h1')?.textContent?.trim ?? '',
    hasStatusJson: Boolean(document.querySelector('#status')),
    docHeightRatio:
      Math.round((document.documentElement.scrollHeight window.innerHeight) * 100) 100,
    canvasBandRatio: rect ? Math.round((rect.height window.innerHeight) * 100) 100: 0,
    funnelLabelsFound: FUNNEL.filter((label) => text.includes(label)),
    stencilLabelsFound: STENCILS.filter((label) => text.includes(label)),
    documentPanelVisible: Boolean(docPanel && docPanel.offsetHeight > 0),
    documentTitleVisible: deepTextIncludes('Meridian Labs Product Brief'),
    blockTypesFound: blockTypes,
    exportMessageVisible: deepTextIncludes('PDF exported') || deepTextIncludes('meridian-product-brief.pdf'),
    approvalLayerVisible: Boolean(approvalLayer && approvalLayer.offsetHeight > 0),
    approvalBadgeVisible: Boolean(approvalBadge),
    approvalCardVisible: Boolean(approvalCard),
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };
}

async function waitForMetric(page, predicate, timeoutMs = 90_000) {
  const deadline = Date.now + timeoutMs;
  while (Date.now < deadline) {
    const metrics = await page.evaluate(shadowQuery);
    if (predicate(metrics)) return metrics;
    await page.waitForTimeout(40);
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
  await page.addInitScript( => {
    const origSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = ((handler, timeout,...args) => {
      const ms = typeof timeout === 'number' && timeout === 900 ? 6000: timeout;
      return origSetTimeout(handler, ms,...args);
    });
  });

  await page.goto(`${baseUrl}?v=iter3-manual-20260723`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });

  await page.waitForFunction( => {
    const board = document.querySelector('agentable-whiteboard');
    return board instanceof HTMLElement;
  });

  return { context, page };
}

async function runDesktopManual {
  const { context, page } = await setupPage({ viewport: { width: 1280, height: 900 } });

  await page.waitForFunction( => {
    const wb = document.querySelector('agentable-whiteboard');
    const shadow = wb?.shadowRoot;
    return Boolean(shadow?.querySelector('canvas'));
  }, null, { timeout: 90_000 });

  let metrics = await page.evaluate(shadowQuery);
  await capture(page, 'cursor-browser-01-initial-load-desktop.png', 'S0-US1');
  report.steps.push({ step: 'S0-initial', metrics });

  const wireframe = await runMeridianStep(page, 'wireframe');
  await page.waitForTimeout(500);
  metrics = await page.evaluate(shadowQuery);
  await captureWhiteboard(page, 'cursor-browser-02-whiteboard-wireframe.png', 'S1-US2');
  report.steps.push({ step: 'S1-wireframe', wireframe, metrics });

  const document = await runMeridianStep(page, 'document');
  await waitForMetric(page, (m) => m.documentPanelVisible || m.documentTitleVisible || (m.blockTypesFound?.length ?? 0) >= 3, 15_000);
  metrics = await page.evaluate(shadowQuery);
  await capture(page, 'cursor-browser-04-document-panel.png', 'S3-US3');
  report.steps.push({ step: 'S3-document', document, metrics });

  const exportResult = await runMeridianStep(page, 'export');
  await waitForMetric(page, (m) => m.exportMessageVisible || m.meridianExportResult?.ok === true, 10_000);
  metrics = await page.evaluate(shadowQuery);
  await capture(page, 'cursor-browser-05-export-confirmation.png', 'S4-US4');
  report.steps.push({ step: 'S4-export', exportResult, metrics });

  const hitlPromise = runMeridianStep(page, 'hitl');
  let hitlMetrics = null;
  for (let i = 0; i < 120; i += 1) {
    hitlMetrics = await page.evaluate(shadowQuery);
    if (hitlMetrics.approvalLayerVisible || hitlMetrics.approvalBadgeVisible || hitlMetrics.approvalCardVisible) {
      await capture(page, 'cursor-browser-06-hitl-approval-card.png', 'S5-US5');
      report.steps.push({ step: 'S5-hitl-capture', metrics: hitlMetrics });
      break;
    }
    await page.waitForTimeout(50);
  }
  const hitl = await hitlPromise;
  report.steps.push({ step: 'S5-hitl-result', hitl, metrics: hitlMetrics ?? (await page.evaluate(shadowQuery)) });

  metrics = await page.evaluate(shadowQuery);
  report.steps.push({ step: 'final-settle', metrics });

  await context.close;
  return metrics;
}

async function runMobile {
  const { context, page } = await setupPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await runMeridianStep(page, 'full');
  await page.waitForTimeout(800);
  const metrics = await page.evaluate(shadowQuery);
  await page.screenshot({
    path: path.join(shotDir, 'cursor-browser-m01-mobile-initial.png'),
    fullPage: true,
  });
  const stat = fs.statSync(path.join(shotDir, 'cursor-browser-m01-mobile-initial.png'));
  report.captures.push({
    phase: 'M0-US6',
    filename: 'cursor-browser-m01-mobile-initial.png',
    bytes: stat.size,
    path: path.join(shotDir, 'cursor-browser-m01-mobile-initial.png'),
  });
  report.steps.push({ step: 'M0-mobile', metrics });
  await context.close;
  return metrics;
}

const desktopMetrics = await runDesktopManual;
const mobileMetrics = await runMobile;

report.desktop = desktopMetrics;
report.mobile = mobileMetrics;
report.capturedAt = new Date.toISOString;

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
    s1?.wireframe?.summary?.flowBoxCount >= 4 ||
      s1?.wireframe?.ok === true ||
      desktopMetrics?.meridianDemoResult?.flowBoxCount >= 4),
  us3: Boolean(
    s3?.document?.document?.ok === true &&
      (s3?.metrics?.documentPanelVisible || s3?.metrics?.documentTitleVisible || (s3?.metrics?.blockTypesFound?.length ?? 0) >= 3)),
  us4: Boolean(
    s4?.exportResult?.ok === true ||
      s4?.exportResult?.export?.ok === true ||
      desktopMetrics?.meridianExportResult?.ok === true),
  us5: Boolean(
    (s5Capture && s5Capture.metrics?.approvalLayerVisible) ||
      s5Result?.hitl?.ok === true ||
      desktopMetrics?.meridianHitlResult?.ok === true),
  us6: Boolean(mobileMetrics?.canvasBandRatio >= 0.4 && mobileMetrics?.hasTldrawCanvas),
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
await browser.close;
console.log(JSON.stringify({ usVerdict: report.usVerdict, captures: report.captures.length }));
