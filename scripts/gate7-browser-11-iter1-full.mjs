/**
 * wave-3 — 11-app-shell browser verification (Playwright supplementary).
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const iterDir =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/retroactive-ui-coverage/11-app-shell/';
const shotDir = path.join(iterDir, 'screenshots/11-app-shell');
const reportPath = path.join(iterDir, 'gate7-browser-report.json');
const baseUrl = 'http://127.0.0.1:5199/examples/11-app-shell/index.html';
const cacheBust = 'iter1-cursor-20260723';

fs.mkdirSync(shotDir, { recursive: true });

const report = {
  url: `${baseUrl}?v=${cacheBust}`,
  port: 5199,
  tool: 'playwright-supplementary',
  cursorIdeBrowserBlocked: true,
  cursorIdeBrowserError: 'browser_navigate browser_tabs -> No browser tab available',
  build: 'dist/embed/agentable-app-shell.js present (~814KB)',
  consoleMessages: [],
  consoleWarnings: [],
  consoleErrors: [],
  captures: [],
  steps: [],
  metrics: {},
};

function collectMetrics {
  const shell = document.querySelector('agentable-app-shell');
  const mount = shell?.shadowRoot?.querySelector('.agentable-app-shell-mount');
  const workspace = mount?.querySelector('[data-dom-engine="true"]');
  const growthActive = mount?.querySelector('[data-dom-tab="growth-paths"][data-active="true"]');
  const text = mount?.textContent ?? '';
  const storageRaw = window.localStorage.getItem('agentable-app-shell:archipelago-resorts');
  let snapshot = null;
  try {
    snapshot = storageRaw ? JSON.parse(storageRaw): null;
  } catch {
    snapshot = null;
  }
  return {
    galleryReady: window.__galleryReady ?? null,
    brandVisible: document.querySelector('.brand')?.textContent?.includes('Archipelago Resorts') ?? false,
    hasDomEngine: Boolean(workspace),
    cameraNone: workspace?.getAttribute('data-camera') === 'none',
    tlContainerCount: document.querySelectorAll('.tl-container').length,
    canvasCount: document.querySelectorAll('canvas').length,
    growthPathsActive: Boolean(growthActive),
    jobTitlesFound: ['Guest Experience Lead', 'Culinary Innovation Chef'].filter((t) => text.includes(t)),
    splitHandlePresent: Boolean(mount?.querySelector('[data-dom-split-handle="true"]')),
    compactLayout: Boolean(mount?.querySelector('.dom-region-layout--compact')),
    drawerTogglePresent: Boolean(mount?.querySelector('[data-dom-drawer-toggle="true"]')),
    activeTabMain: snapshot?.activeTab?.main ?? null,
    docHeightRatio: Math.round((document.documentElement.scrollHeight window.innerHeight) * 100) 100,
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };
}

async function capture(page, filename, phase) {
  const fullPath = path.join(shotDir, filename);
  await page.screenshot({ path: fullPath, fullPage: false });
  const stat = fs.statSync(fullPath);
  report.captures.push({ phase, filename, bytes: stat.size, path: fullPath });
}

async function captureShell(page, filename, phase) {
  const fullPath = path.join(shotDir, filename);
  await page.locator('agentable-app-shell').screenshot({ path: fullPath });
  const stat = fs.statSync(fullPath);
  report.captures.push({ phase, filename, bytes: stat.size, path: fullPath });
}

const browser = await chromium.launch({ headless: true });
try {
  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desktopContext.newPage;
  page.on('console', (msg) => {
    const text = msg.text;
    report.consoleMessages.push({ type: msg.type, text });
    if (msg.type === 'warning') report.consoleWarnings.push(text);
    if (msg.type === 'error') report.consoleErrors.push(text);
  });
  page.on('pageerror', (err) => report.consoleErrors.push(err.message));

  await page.goto(`${baseUrl}?v=${cacheBust}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction( => {
    const ready = window.__galleryReady;
    return ready?.example === '11-app-shell' && ready.ok === true;
  }, { timeout: 45000 });
  await page.waitForTimeout(600);
  report.steps.push({ step: 'S0', action: 'initial load desktop', ok: true });
  await capture(page, 'cursor-browser-01-initial-load-desktop.png', 'S0');
  report.steps.push({ step: 'S1', action: 'workspace close-up', ok: true });
  await captureShell(page, 'cursor-browser-02-dom-workspace-default.png', 'S1');
  report.steps.push({ step: 'S2', action: 'full page with status', ok: true });
  await capture(page, 'cursor-browser-03-status-json.png', 'S2');

  await page.locator('agentable-app-shell').locator('[data-dom-tab="growth-paths"]').click;
  await page.waitForFunction( => {
    const shell = document.querySelector('agentable-app-shell');
    const mount = shell?.shadowRoot?.querySelector('.agentable-app-shell-mount');
    return Boolean(mount?.querySelector('[data-dom-tab="growth-paths"][data-active="true"]'));
  });
  await page.waitForTimeout(400);
  report.steps.push({ step: 'S3', action: 'click Growth Paths tab', ok: true });
  await captureShell(page, 'cursor-browser-04-after-tab-switch.png', 'S3');

  const splitHandle = page.locator('agentable-app-shell').locator('[data-dom-split-handle="true"]');
  const handleBox = await splitHandle.boundingBox;
  if (handleBox) {
    await page.mouse.move(handleBox.x + handleBox.width 2, handleBox.y + handleBox.height 2);
    await page.mouse.down;
    await page.mouse.move(handleBox.x - 80, handleBox.y + handleBox.height 2, { steps: 12 });
    await page.mouse.up;
    await page.waitForTimeout(500);
    report.steps.push({ step: 'S4', action: 'drag split handle', ok: true });
  } else {
    report.steps.push({ step: 'S4', action: 'drag split handle', ok: false, reason: 'handle not found' });
  }
  await captureShell(page, 'cursor-browser-05-after-split-resize.png', 'S4');

  await page.waitForFunction( => {
    const raw = window.localStorage.getItem('agentable-app-shell:archipelago-resorts');
    if (!raw) return false;
    try {
      return JSON.parse(raw).activeTab?.main === 1;
    } catch {
      return false;
    }
  }, { timeout: 10000 });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction( => {
    const ready = window.__galleryReady;
    return ready?.example === '11-app-shell' && ready.ok === true && ready.restored === true;
  }, { timeout: 45000 });
  await page.waitForTimeout(600);
  report.steps.push({ step: 'S5', action: 'reload with restored layout', ok: true });
  await captureShell(page, 'cursor-browser-06-after-reload-restored.png', 'S5');
  report.metrics.desktop = await page.evaluate(collectMetrics);

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const mobilePage = await mobileContext.newPage;
  mobilePage.on('console', (msg) => { if (msg.type === 'error') report.consoleErrors.push(`[mobile] ${msg.text}`); });
  await mobilePage.goto(`${baseUrl}?v=${cacheBust}-mobile`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await mobilePage.waitForFunction( => {
    const ready = window.__galleryReady;
    return ready?.example === '11-app-shell' && ready.ok === true;
  }, { timeout: 45000 });
  await mobilePage.waitForTimeout(600);
  report.steps.push({ step: 'M0', action: 'mobile initial', ok: true });
  const m0Path = path.join(shotDir, 'cursor-browser-m01-mobile-initial.png');
  await mobilePage.screenshot({ path: m0Path, fullPage: false });
  report.captures.push({ phase: 'M0', filename: 'cursor-browser-m01-mobile-initial.png', bytes: fs.statSync(m0Path).size, path: m0Path });
  const drawerToggle = mobilePage.locator('agentable-app-shell').locator('[data-dom-drawer-toggle="true"]');
  if (await drawerToggle.count) {
    await drawerToggle.click;
    await mobilePage.waitForTimeout(400);
    report.steps.push({ step: 'M1', action: 'open sidebar drawer', ok: true });
  } else {
    report.steps.push({ step: 'M1', action: 'open sidebar drawer', ok: false, reason: 'toggle not found' });
  }
  const m1Path = path.join(shotDir, 'cursor-browser-m02-mobile-sidebar-drawer.png');
  await mobilePage.screenshot({ path: m1Path, fullPage: false });
  report.captures.push({ phase: 'M1', filename: 'cursor-browser-m02-mobile-sidebar-drawer.png', bytes: fs.statSync(m1Path).size, path: m1Path });
  report.metrics.mobile = await mobilePage.evaluate(collectMetrics);
  await mobileContext.close;
  await desktopContext.close;

  const d = report.metrics.desktop;
  const m = report.metrics.mobile;
  const failReasons = [];
  if (!d.brandVisible) failReasons.push('brand not visible');
  if (!d.hasDomEngine) failReasons.push('DOM engine shell missing');
  if (d.tlContainerCount > 0 || d.canvasCount > 0) failReasons.push('tldraw/canvas present');
  if (!d.growthPathsActive) failReasons.push('growth-paths not active after reload');
  if (d.activeTabMain !== 1) failReasons.push('activeTab.main !== 1 in storage');
  if (d.jobTitlesFound.length < 1) failReasons.push('career job titles not found in DOM');
  if (d.docHeightRatio > 1.25) failReasons.push('desktop docHeightRatio > 1.25');
  if (!m.compactLayout && !m.drawerTogglePresent) failReasons.push('mobile compact layout missing');
  if (m.docHeightRatio > 1.25) failReasons.push('mobile docHeightRatio > 1.25');

  report.verdict = failReasons.length === 0 ? 'PASS': 'FAIL';
  report.failReasons = failReasons;
  report.capturedAt = new Date.toISOString;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ verdict: report.verdict, captures: report.captures.length, failReasons }, null, 2));
} finally {
  await browser.close;
}
