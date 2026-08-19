/**
 * — 11-app-shell QA (resize fix + styling regression).
 * Clears stale localStorage before desktop resize walkthrough.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const iterDir =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/retroactive-ui-coverage/11-app-shell/';
const shotDir = iterDir;
const reportPath = path.join(iterDir, 'gate7-browser-report.json');
const url11 = 'http://127.0.0.1:5199/examples/11-app-shell/index.html';
const url12 = 'http://127.0.0.1:5199/examples/12-open-agent-canvas/index.html';
const cacheBust = 'iter3-qa-20260723';
const STORAGE_KEY = 'agentable-app-shell:archipelago-resorts';

fs.mkdirSync(shotDir, { recursive: true });

const report = {
  url: `${url11}?v=${cacheBust}`,
  parityUrl: `${url12}?v=${cacheBust}`,
  port: 5199,
  tool: 'playwright-supplementary',
  cursorIdeBrowserAttempted: false,
  build: 'npm run build:embed:app-shell (2026-07-23 iter3)',
  localStorageCleared: true,
  consoleErrors: [],
  captures: [],
  steps: [],
  metrics: {},
  stylingChecks: {},
  resizeChecks: {},
};

function collectMetrics {
  const shell = document.querySelector('agentable-app-shell');
  const mount = shell?.shadowRoot?.querySelector('.agentable-app-shell-mount');
  const workspace = mount?.querySelector('[data-dom-engine="true"]');
  const text = mount?.textContent ?? '';
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const statusEl = document.getElementById('status');
  const telemetry = document.querySelector('details.gallery-telemetry');
  const tabButtons = Array.from(
    mount?.querySelectorAll('[data-dom-tab]') ?? []).map((el) => ({
    id: el.getAttribute('data-dom-tab'),
    label: el.textContent?.trim ?? '',
    active: el.getAttribute('data-active') === 'true',
  }));
  const sidebarPanel = mount?.querySelector('[data-dom-panel="sidebar"]');
  const mainPanel = mount?.querySelector('[data-dom-panel="main"]');
  const sidebarBox = sidebarPanel?.getBoundingClientRect;
  const mainBox = mainPanel?.getBoundingClientRect;
  const workspaceEl = mount?.querySelector('.dom-region-layout--split');
  const storageRaw = window.localStorage.getItem('agentable-app-shell:archipelago-resorts');
  let snapshot = null;
  try {
    snapshot = storageRaw ? JSON.parse(storageRaw): null;
  } catch {
    snapshot = null;
  }
  const viewportW = window.innerWidth;
  const sidebarPercent =
    sidebarBox && viewportW > 0 ? Math.round((sidebarBox.width viewportW) * 1000) 10: null;
  return {
    galleryReady: window.__galleryReady ?? null,
    brandVisible: document.querySelector('.brand-text h1')?.textContent?.includes('Archipelago Resorts') ?? false,
    headerPresent: Boolean(document.querySelector('header.brand-mark')),
    bodyBackground: bodyBg,
    bodyHeight100: document.body.style.height !== '' || getComputedStyle(document.body).height !== 'auto',
    telemetryCollapsed: telemetry instanceof HTMLDetailsElement ? !telemetry.open: null,
    statusVisibleAboveFold: ( => {
      if (!statusEl) return false;
      const r = statusEl.getBoundingClientRect;
      return r.top < window.innerHeight && r.height > 40 && !telemetry?.open;
    }),
    hasDomEngine: Boolean(workspace),
    cameraNone: workspace?.getAttribute('data-camera') === 'none',
    tlContainerCount: document.querySelectorAll('.tl-container').length,
    canvasCount: document.querySelectorAll('canvas').length,
    tabButtons,
    humanTabLabels: tabButtons.some((t) => t.label === 'Open Positions') &&
      tabButtons.some((t) => t.label === 'Growth Paths'),
    rawIdOnlyTabs: tabButtons.some((t) => t.label === t.id),
    jobTitlesFound: ['Guest Experience Lead', 'Culinary Innovation Chef'].filter((t) => text.includes(t)),
    growthPathsActive: Boolean(mount?.querySelector('[data-dom-tab="growth-paths"][data-active="true"]')),
    splitHandlePresent: Boolean(mount?.querySelector('[data-dom-split-handle="true"]')),
    sidebarWidthPx: sidebarBox ? Math.round(sidebarBox.width): null,
    sidebarWidthPercent: sidebarPercent,
    mainWidthPx: mainBox ? Math.round(mainBox.width): null,
    workspaceScrollWidth: workspaceEl ? workspaceEl.scrollWidth: null,
    workspaceClientWidth: workspaceEl ? workspaceEl.clientWidth: null,
    horizontalScrollExplosion: workspaceEl ? workspaceEl.scrollWidth > workspaceEl.clientWidth + 4: false,
    docHeightRatio: Math.round((document.documentElement.scrollHeight window.innerHeight) * 100) 100,
    compactLayout: Boolean(mount?.querySelector('.dom-region-layout--compact')),
    drawerTogglePresent: Boolean(mount?.querySelector('[data-dom-drawer-toggle="true"]')),
    activeTabMain: snapshot?.activeTab?.main ?? null,
    sidebarSplit: snapshot?.sidebarSplit ?? null,
    viewport: { w: viewportW, h: window.innerHeight },
  };
}

async function capture(page, filename, phase) {
  const fullPath = path.join(shotDir, filename);
  await page.screenshot({ path: fullPath, fullPage: false });
  const stat = fs.statSync(fullPath);
  report.captures.push({ phase, filename, bytes: stat.size, path: fullPath });
  return fullPath;
}

async function captureShell(page, filename, phase) {
  const fullPath = path.join(shotDir, filename);
  await page.locator('agentable-app-shell').screenshot({ path: fullPath });
  const stat = fs.statSync(fullPath);
  report.captures.push({ phase, filename, bytes: stat.size, path: fullPath });
  return fullPath;
}

async function getSidebarWidth(page) {
  return page.evaluate( => {
    const shell = document.querySelector('agentable-app-shell');
    const mount = shell?.shadowRoot?.querySelector('.agentable-app-shell-mount');
    const sidebar = mount?.querySelector('[data-dom-panel="sidebar"]');
    return sidebar ? Math.round(sidebar.getBoundingClientRect.width): null;
  });
}

async function dragSplitHandle(page, deltaX, captureMid = null) {
  const splitHandle = page.locator('agentable-app-shell').locator('[data-dom-split-handle="true"]');
  const handleBox = await splitHandle.boundingBox;
  if (!handleBox) return { ok: false, reason: 'handle not found' };
  const cx = handleBox.x + handleBox.width 2;
  const cy = handleBox.y + handleBox.height 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down;
  if (captureMid) {
    await page.mouse.move(cx + deltaX 2, cy, { steps: 8 });
    await captureShell(page, captureMid, captureMid.replace('.png', ''));
  }
  await page.mouse.move(cx + deltaX, cy, { steps: 16 });
  await page.mouse.up;
  await page.waitForTimeout(450);
  return { ok: true, handleBox };
}

const browser = await chromium.launch({ headless: true });
try {
  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desktopContext.newPage;
  page.on('console', (msg) => {
    if (msg.type === 'error') report.consoleErrors.push(msg.text);
  });
  page.on('pageerror', (err) => report.consoleErrors.push(err.message));

   Clear stale iter-2 sidebarSplit before resize walkthrough
  await page.goto(`${url11}?v=${cacheBust}-clear`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
  report.steps.push({ step: 'PRE', action: 'localStorage cleared', key: STORAGE_KEY, ok: true });

   Header comparison (11 vs 12)
  const page12 = await desktopContext.newPage;
  await page12.goto(`${url12}?v=${cacheBust}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page12.waitForTimeout(800);
  const header12Buf = await page12.locator('body > header').screenshot;
  await page.goto(`${url11}?v=${cacheBust}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction( => {
    const ready = window.__galleryReady;
    return ready?.example === '11-app-shell' && ready.ok === true;
  }, { timeout: 45000 });
  await page.waitForTimeout(600);
  const header11Buf = await page.locator('body > header').screenshot;
  const comparisonPage = await desktopContext.newPage;
  await comparisonPage.setViewportSize({ width: 1280, height: 120 });
  await comparisonPage.setContent(
    `<!DOCTYPE html><html><body style="margin:0;background:#000;display:flex;gap:0">
      <img id="a" style="width:640px;height:auto" />
      <img id="b" style="width:640px;height:auto" />
    </body></html>`);
  await comparisonPage.evaluate(
    ([b11, b12]) => {
      document.getElementById('a').src = `data:image/png;base64,${b11}`;
      document.getElementById('b').src = `data:image/png;base64,${b12}`;
    },
    [header11Buf.toString('base64'), header12Buf.toString('base64')]);
  await comparisonPage.waitForTimeout(200);
  const comparisonPath = path.join(shotDir, 'comparison-11-vs-12-header.png');
  await comparisonPage.screenshot({ path: comparisonPath, fullPage: true });
  report.captures.push({
    phase: 'C0',
    filename: 'comparison-11-vs-12-header.png',
    bytes: fs.statSync(comparisonPath).size,
    path: comparisonPath,
  });
  await page12.close;
  await comparisonPage.close;

  report.steps.push({ step: 'S0', action: 'initial load desktop', ok: true });
  await capture(page, 'cursor-browser-01-initial-load-desktop.png', 'S0');

  const defaultWidth = await getSidebarWidth(page);
  const defaultMetrics = await page.evaluate(collectMetrics);
  report.steps.push({
    step: 'R1',
    action: 'split default',
    ok: true,
    sidebarWidthPx: defaultWidth,
    sidebarWidthPercent: defaultMetrics.sidebarWidthPercent,
    sidebarSplit: defaultMetrics.sidebarSplit,
  });
  const r1Path = await captureShell(page, 'cursor-browser-r01-split-default.png', 'R1');
  const r1Bytes = fs.statSync(r1Path).size;

  const beforeMid = await getSidebarWidth(page);
  await dragSplitHandle(page, -120, 'cursor-browser-r02-split-mid-drag.png');
  const midWidth = await getSidebarWidth(page);
  const r2Capture = report.captures.find((c) => c.filename === 'cursor-browser-r02-split-mid-drag.png');
  report.steps.push({
    step: 'R2',
    action: 'mid-drag left',
    ok: true,
    sidebarWidthPx: midWidth,
    deltaFromDefault: midWidth != null && defaultWidth != null ? midWidth - defaultWidth: null,
    r2BytesDifferFromR1: r2Capture ? r2Capture.bytes !== r1Bytes: null,
  });

  await dragSplitHandle(page, -180);
  const narrowWidth = await getSidebarWidth(page);
  const narrowMetrics = await page.evaluate(collectMetrics);
  report.steps.push({
    step: 'R3',
    action: 'sidebar narrow',
    ok: narrowWidth != null && defaultWidth != null ? narrowWidth < defaultWidth - 20: false,
    sidebarWidthPx: narrowWidth,
    sidebarWidthPercent: narrowMetrics.sidebarWidthPercent,
    sidebarSplit: narrowMetrics.sidebarSplit,
  });
  await captureShell(page, 'cursor-browser-r03-split-sidebar-narrow.png', 'R3');

  await dragSplitHandle(page, 260);
  const wideWidth = await getSidebarWidth(page);
  const wideMetrics = await page.evaluate(collectMetrics);
  report.steps.push({
    step: 'R4',
    action: 'sidebar wide',
    ok: wideWidth != null && narrowWidth != null ? wideWidth > narrowWidth + 20: false,
    sidebarWidthPx: wideWidth,
    sidebarWidthPercent: wideMetrics.sidebarWidthPercent,
    sidebarSplit: wideMetrics.sidebarSplit,
  });
  await captureShell(page, 'cursor-browser-r04-split-sidebar-wide.png', 'R4');

   Tab switch regression
  await page.locator('agentable-app-shell').locator('[data-dom-tab="growth-paths"]').click;
  await page.waitForFunction( => {
    const shell = document.querySelector('agentable-app-shell');
    const mount = shell?.shadowRoot?.querySelector('.agentable-app-shell-mount');
    return Boolean(mount?.querySelector('[data-dom-tab="growth-paths"][data-active="true"]'));
  });
  await page.waitForTimeout(400);
  report.steps.push({ step: '', action: 'Growth Paths tab', ok: true });

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
  report.steps.push({ step: '', action: 'reload restored', ok: true });

  report.metrics.desktop = await page.evaluate(collectMetrics);

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const mobilePage = await mobileContext.newPage;
  mobilePage.on('console', (msg) => {
    if (msg.type === 'error') report.consoleErrors.push(`[mobile] ${msg.text}`);
  });
  await mobilePage.goto(`${url11}?v=${cacheBust}-mobile`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await mobilePage.waitForFunction( => {
    const ready = window.__galleryReady;
    return ready?.example === '11-app-shell' && ready.ok === true;
  }, { timeout: 45000 });
  await mobilePage.waitForTimeout(600);
  report.steps.push({ step: 'M0', action: 'mobile initial', ok: true });
  await capture(mobilePage, 'cursor-browser-m01-mobile-initial.png', 'M0');

  const drawerToggle = mobilePage.locator('agentable-app-shell').locator('[data-dom-drawer-toggle="true"]');
  if (await drawerToggle.count) {
    await drawerToggle.click;
    await mobilePage.waitForTimeout(400);
    report.steps.push({ step: 'M1', action: 'open sidebar drawer', ok: true });
  } else {
    report.steps.push({ step: 'M1', action: 'open sidebar drawer', ok: false, reason: 'toggle not found' });
  }
  await capture(mobilePage, 'cursor-browser-m02-mobile-sidebar-drawer.png', 'M1');
  report.metrics.mobile = await mobilePage.evaluate(collectMetrics);
  await mobileContext.close;
  await desktopContext.close;

  const d = report.metrics.desktop;
  const m = report.metrics.mobile;
  const r1Step = report.steps.find((s) => s.step === 'R1');
  const r2Step = report.steps.find((s) => s.step === 'R2');
  const r3Step = report.steps.find((s) => s.step === 'R3');
  const r4Step = report.steps.find((s) => s.step === 'R4');

  report.stylingChecks = {
    darkBodyBackground: d.bodyBackground === 'rgb(15, 23, 42)' || d.bodyBackground === '#0f172a',
    headerBrandBlock: d.brandVisible && d.headerPresent,
    workspaceFillsViewport: d.hasDomEngine && d.docHeightRatio <= 1.25,
    noLightFixture: d.bodyBackground !== 'rgb(248, 250, 252)',
    humanTabLabels: d.humanTabLabels && !d.rawIdOnlyTabs,
    statusCollapsed: d.telemetryCollapsed === true && !d.statusVisibleAboveFold,
    parityHeaderCaptured: fs.existsSync(comparisonPath),
  };

  report.resizeChecks = {
    splitHandlePresent: d.splitHandlePresent,
    defaultSidebarWidthPx: defaultWidth,
    defaultSidebarWidthPercent: r1Step?.sidebarWidthPercent ?? null,
    defaultSidebarReadable: (defaultWidth ?? 0) >= 200,
    defaultSidebarNear30Percent:
      r1Step?.sidebarWidthPercent != null &&
      r1Step.sidebarWidthPercent >= 24 &&
      r1Step.sidebarWidthPercent <= 36,
    midDragVisibleChange: r2Step?.r2BytesDifferFromR1 === true &&
      Math.abs((r2Step?.deltaFromDefault ?? 0)) >= 10,
    narrowSidebarWidthPx: narrowWidth,
    narrowNear18Percent:
      r3Step?.sidebarWidthPercent != null &&
      r3Step.sidebarWidthPercent >= 16 &&
      r3Step.sidebarWidthPercent <= 22,
    narrowStillReadable: (narrowWidth ?? 0) >= 180,
    wideSidebarWidthPx: wideWidth,
    wideNear42Percent:
      r4Step?.sidebarWidthPercent != null &&
      r4Step.sidebarWidthPercent >= 36 &&
      r4Step.sidebarWidthPercent <= 44,
    wideGrowsNotShrinks: (wideWidth ?? 0) > (narrowWidth ?? 0) + 20,
    sidebarWidthChanged: narrowWidth != null && wideWidth != null && defaultWidth != null &&
      narrowWidth < defaultWidth - 15 && wideWidth > narrowWidth + 15,
    noHorizontalScrollExplosion: !d.horizontalScrollExplosion,
    bothPanelsReadable: (d.mainWidthPx ?? 0) >= 400 && (d.sidebarWidthPx ?? 0) >= 180,
    mobileCompactOrDrawer: m.compactLayout || m.drawerTogglePresent,
    mobileDocHeightOk: m.docHeightRatio <= 1.25,
  };

  const stylingFail = [];
  if (!report.stylingChecks.darkBodyBackground) stylingFail.push('body not #0f172a dark');
  if (!report.stylingChecks.headerBrandBlock) stylingFail.push('brand/header missing');
  if (!report.stylingChecks.humanTabLabels) stylingFail.push('tab labels not human-readable');
  if (!report.stylingChecks.statusCollapsed) stylingFail.push('#status not collapsed/hidden');
  if (!report.stylingChecks.workspaceFillsViewport) stylingFail.push('workspace viewport fill');

  const resizeFail = [];
  if (!report.resizeChecks.splitHandlePresent) resizeFail.push('split handle missing');
  if (!report.resizeChecks.defaultSidebarReadable) resizeFail.push('default sidebar not readable (~42px bug)');
  if (!report.resizeChecks.defaultSidebarNear30Percent) resizeFail.push('default sidebar not ~30%');
  if (!report.resizeChecks.midDragVisibleChange) resizeFail.push('mid-drag no visible ratio change');
  if (!report.resizeChecks.narrowStillReadable) resizeFail.push('narrow drag sidebar unreadable');
  if (!report.resizeChecks.wideGrowsNotShrinks) resizeFail.push('wide drag shrinks sidebar instead of growing');
  if (!report.resizeChecks.noHorizontalScrollExplosion) resizeFail.push('horizontal scroll explosion');
  if (!report.resizeChecks.mobileCompactOrDrawer) resizeFail.push('mobile drawer/compact missing');

  const regressionFail = [];
  if (!d.hasDomEngine || d.tlContainerCount > 0) regressionFail.push('DOM engine tldraw violation');
  if (!d.growthPathsActive) regressionFail.push('growth-paths not active after reload');
  if (d.activeTabMain !== 1) regressionFail.push('persistence activeTab.main !== 1');
  if (d.jobTitlesFound.length < 1 && !d.growthPathsActive) regressionFail.push('career content missing');

  report.verdictStyling = stylingFail.length === 0 ? 'PASS': 'FAIL';
  report.verdictResize = resizeFail.length === 0 ? 'PASS': 'FAIL';
  report.verdictRegression = regressionFail.length === 0 ? 'PASS': 'FAIL';
  report.verdict =
    report.verdictStyling === 'PASS' && report.verdictResize === 'PASS' && report.verdictRegression === 'PASS'
      ? 'PASS': 'FAIL';
  report.stylingFailReasons = stylingFail;
  report.resizeFailReasons = resizeFail;
  report.regressionFailReasons = regressionFail;
  report.capturedAt = new Date.toISOString;

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

   png-manifest.txt
  const manifestLines = report.captures.map((c) => `${c.path}\t${c.bytes}`);
  fs.writeFileSync(path.join(iterDir, 'png-manifest.txt'), manifestLines.join('\n') + '\n');

  console.log(
    JSON.stringify(
      {
        verdict: report.verdict,
        styling: report.verdictStyling,
        resize: report.verdictResize,
        regression: report.verdictRegression,
        defaultSidebarPx: defaultWidth,
        defaultSidebarPercent: r1Step?.sidebarWidthPercent,
        captures: report.captures.length,
      },
      null,
      2));
} finally {
  await browser.close;
}
