/**
 * Supplementary GATE 7 browser verification for 12-open-agent-canvas.
 * cursor-ide-browser MCP unavailable in subagent — Playwright captures PNGs + metrics.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const shotDir =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/retroactive-ui-coverage/12-open-agent-canvasscreenshots/12-open-agent-canvas';
const reportPath =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/retroactive-ui-coverage/12-open-agent-canvas/gate7-browser-report.json';
const url = 'http://127.0.0.1:5199/examples/12-open-agent-canvas/index.html';

fs.mkdirSync(shotDir, { recursive: true });

/** @type {Record<string, unknown>} */
const report = {
  url,
  port: 5199,
  tool: 'playwright-supplementary',
  cursorIdeBrowserBlocked: true,
  consoleMessages: [],
  consoleWarnings: [],
  consoleErrors: [],
  steps: [],
};

const browser = await chromium.launch({ headless: true });

async function collectMetrics(page) {
  return page.evaluate( => {
    const wb = document.querySelector('agentable-whiteboard');
    const shadow = wb?.shadowRoot ?? null;
    const canvases = shadow
      ? [...shadow.querySelectorAll('canvas')]: [...document.querySelectorAll('canvas')];
    const rect = wb?.getBoundingClientRect;
    const versions = window.__TLDRAW_LIBRARY_VERSIONS__ ?? {};
    let tldrawInstanceCount = 0;
    for (const v of Object.values(versions)) {
      if (Array.isArray(v)) tldrawInstanceCount += v.length;
    }
    const docHeightRatio =
      Math.round((document.documentElement.scrollHeight window.innerHeight) * 100) 100;
    const tlContainer = shadow?.querySelector('.tl-container');
    const toolbar = shadow?.querySelector('.tlui-layout');
    const textInShadow = shadow?.textContent ?? '';
    const funnelLabels = ['Navigation', 'Hero headline', 'Feature grid', 'Sign up CTA'].filter(
      (label) => textInShadow.includes(label));
    const stencilLabels = ['Meridian nav', 'Hero card', 'Email capture', 'Start trial'].filter(
      (label) => textInShadow.includes(label));
    const statusEl = document.querySelector('#status');
    const h1 = document.querySelector('h1')?.textContent?.trim ?? '';
    const canvasBandRatio = rect ? Math.round((rect.height window.innerHeight) * 100) 100: 0;

    return {
      galleryReady: window.__galleryReady ?? null,
      meridianDemoResult: window.__meridianDemoResult ?? null,
      hasTldrawCanvas: canvases.length > 0,
      canvasCount: canvases.length,
      hasTlContainer: Boolean(tlContainer),
      hasToolbar: Boolean(toolbar),
      whiteboardSize: rect
        ? { w: Math.round(rect.width), h: Math.round(rect.height) }: null,
      shadowChildCount: shadow?.childElementCount ?? 0,
      skipReactMount: wb?.getAttribute('data-skip-react-mount') ?? '',
      tldrawVersions: versions,
      tldrawInstanceCount,
      tldrawDidWarn: tldrawInstanceCount > 8,
      docHeightRatio,
      canvasBandRatio,
      h1,
      hasStatusJson: Boolean(statusEl),
      statusVisible: statusEl ? statusEl.offsetHeight > 0: false,
      funnelLabelsFound: funnelLabels,
      stencilLabelsFound: stencilLabels,
      viewport: { w: window.innerWidth, h: window.innerHeight },
    };
  });
}

async function runDesktop {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage;

  page.on('console', (msg) => {
    const text = msg.text;
    const entry = { type: msg.type, text };
    report.consoleMessages.push(entry);
    if (msg.type === 'warning') report.consoleWarnings.push(text);
    if (msg.type === 'error') report.consoleErrors.push(text);
  });
  page.on('pageerror', (err) => {
    report.consoleErrors.push(err.message);
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  let galleryReady = false;
  try {
    await page.waitForFunction(
       =>
        window.__galleryReady?.example === '12-open-agent-canvas' &&
        typeof window.__galleryReady?.ok === 'boolean',
      null,
      { timeout: 60_000 });
    galleryReady = true;
  } catch (err) {
    report.steps.push({ step: 'wait-galleryReady', error: String(err) });
  }

   Allow demo animation panel open to settle
  await page.waitForTimeout(3000);

  const metrics = await collectMetrics(page);
  report.steps.push({ step: 'desktop-settle', galleryReady, metrics });

  await page.screenshot({
    path: path.join(shotDir, 'cursor-browser-01-initial-load-desktop.png'),
    fullPage: false,
  });

  const wb = page.locator('agentable-whiteboard');
  await wb.screenshot({
    path: path.join(shotDir, 'cursor-browser-02-whiteboard-empty.png'),
  });

  await page.screenshot({
    path: path.join(shotDir, 'cursor-browser-03-status-json.png'),
    fullPage: true,
  });

  await context.close;
  return metrics;
}

async function runMobile {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage;

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  try {
    await page.waitForFunction(
       =>
        window.__galleryReady?.example === '12-open-agent-canvas' &&
        window.__galleryReady?.ok === true,
      null,
      { timeout: 60_000 });
  } catch {
     continue for screenshot evidence
  }
  await page.waitForTimeout(3000);

  const metrics = await collectMetrics(page);
  report.steps.push({ step: 'mobile-settle', metrics });

  await page.screenshot({
    path: path.join(shotDir, 'cursor-browser-m01-mobile-initial.png'),
    fullPage: true,
  });

  await context.close;
  return metrics;
}

const desktopMetrics = await runDesktop;
const mobileMetrics = await runMobile;

report.desktop = desktopMetrics;
report.mobile = mobileMetrics;

const dupTldrawConsole = report.consoleMessages.some(
  (m) =>
    typeof m === 'object' &&
    m !== null &&
    'text' in m &&
    String(m.text).includes('multiple instances of some tldraw libraries'));

report.dupTldrawConsole = dupTldrawConsole;

const us1 =
  desktopMetrics.h1.includes('Meridian Labs') &&
  desktopMetrics.hasTldrawCanvas &&
  !desktopMetrics.hasStatusJson &&
  desktopMetrics.docHeightRatio <= 1.25 &&
  !dupTldrawConsole &&
  !desktopMetrics.tldrawDidWarn;

const us2 =
  desktopMetrics.meridianDemoResult?.ok === true &&
  (desktopMetrics.meridianDemoResult?.flowBoxCount ?? 0) >= 4 &&
  desktopMetrics.funnelLabelsFound.length >= 4 &&
  desktopMetrics.hasTldrawCanvas;

const us6 =
  mobileMetrics.canvasBandRatio >= 0.4 &&
  mobileMetrics.hasTldrawCanvas &&
  !mobileMetrics.hasStatusJson;

report.usResults = { us1, us2, us3: null, us4: null, us5: null, us6 };
report.pass = us1 && us2 && us6;

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, usResults: report.usResults, desktopMetrics, mobileMetrics }, null, 2));

await browser.close;
process.exit(report.pass ? 0: 1);
