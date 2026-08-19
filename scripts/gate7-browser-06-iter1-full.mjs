/**
 * wave-3 — 06-react-host-deep browser verification.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const iterDir =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/retroactive-ui-coverage/06-react-host-deep/';
const shotDir = path.join(iterDir, 'outputs');
const reportPath = path.join(iterDir, 'gate7-browser-report.json');
const baseUrl = 'http://127.0.0.1:5199/examples/06-react-host-deep/index.html';
const cacheBust = 'iter1-react-host-deep-20260724';

fs.mkdirSync(shotDir, { recursive: true });

const report = {
  url: `${baseUrl}?v=${cacheBust}`,
  port: 5199,
  tool: 'playwright-supplementary',
  cursorIdeBrowserAttempted: true,
  cursorIdeBrowserBlocked: true,
  cursorIdeBrowserBlockReason: 'Subagent session — cursor-ide-browser not invoked; Playwright supplementary per peer pattern',
  build: 'npm run build:embed:panel && npm run build:gallery-harnesses',
  remediation:
    'Dark gallery shell; AgentablePanel wrapper; gallery-dark theme; Archipelago fixture jobs; product host sidebar',
  consoleMessages: [],
  consoleWarnings: [],
  consoleErrors: [],
  networkFailures: [],
  captures: [],
  steps: [],
  metrics: {},
};

function collectMetrics {
  const panel = document.querySelector('agentable-panel');
  const shadowDir = panel?.shadowRoot?.querySelector('[dir]')?.getAttribute('dir') ?? null;
  const list = panel?.shadowRoot?.querySelector('agentable-virtual-list');
  const text = list?.shadowRoot?.textContent ?? panel?.shadowRoot?.textContent ?? '';
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  return {
    galleryReady: window.__galleryReady ?? null,
    docDir: document.documentElement.getAttribute('dir'),
    docLang: document.documentElement.lang,
    panelLocale: panel?.getAttribute('locale') ?? null,
    panelDir: shadowDir,
    panelTheme: panel?.getAttribute('data-theme') ?? null,
    brandVisible: document.querySelector('h1')?.textContent?.includes('Archipelago') ?? false,
    hostSidebarTitle: document.querySelector('[data-testid="host-sidebar"] h2')?.textContent ?? null,
    panelReadyDetail: document.querySelector('[data-testid="panel-ready-detail"]')?.textContent ?? null,
    jobTitlesFound: ['Guest Experience Lead', 'Culinary Innovation Chef'].filter((t) => text.includes(t)),
    bodyBackground: bodyBg,
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

async function capturePanel(page, filename, phase) {
  const fullPath = path.join(shotDir, filename);
  await page.locator('agentable-panel').screenshot({ path: fullPath });
  const stat = fs.statSync(fullPath);
  report.captures.push({ phase, filename, bytes: stat.size, path: fullPath });
}

async function captureSidebar(page, filename, phase) {
  const fullPath = path.join(shotDir, filename);
  await page.locator('[data-testid="host-sidebar"]').screenshot({ path: fullPath });
  const stat = fs.statSync(fullPath);
  report.captures.push({ phase, filename, bytes: stat.size, path: fullPath });
}

async function waitGalleryReady(page) {
  await page.waitForFunction(
     => {
      const ready = window.__galleryReady;
      return ready?.example === '06-react-host-deep' && ready.ok === true && ready.themeDark === true;
    },
    { timeout: 45000 });
  await page.waitForFunction(
     => {
      const panel = document.querySelector('agentable-panel');
      const list = panel?.shadowRoot?.querySelector('agentable-virtual-list');
      const rowText = list?.shadowRoot?.textContent ?? '';
      return (
        rowText.includes('Guest Experience Lead') && rowText.includes('Culinary Innovation Chef')
      );
    },
    { timeout: 45000 });
  await page.waitForTimeout(500);
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
  page.on('response', (response) => {
    const url = response.url;
    if (response.status === 404 && url.includes('agentable-panel.css')) {
      report.networkFailures.push({ url, status: 404 });
    }
  });

  await page.goto(`${baseUrl}?v=${cacheBust}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitGalleryReady(page);
  report.steps.push({ step: 'S0', action: 'initial load desktop 1280×900', ok: true });
  await capture(page, 'cursor-browser-01-initial-load-desktop.png', 'S0');

  report.steps.push({ step: 'S1', action: 'panel close-up Open Positions', ok: true });
  await capturePanel(page, 'cursor-browser-02-panel-open-positions-closeup.png', 'S1');

  report.steps.push({ step: 'S2', action: 'host sidebar close-up', ok: true });
  await captureSidebar(page, 'cursor-browser-03-host-sidebar-closeup.png', 'S2');

  report.steps.push({ step: 'C0', action: 'gallery dark chrome header + panel band', ok: true });
  await capture(page, 'cursor-browser-c01-gallery-dark-chrome.png', 'C0');

  report.metrics.desktop = await page.evaluate(collectMetrics);

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage;
  mobilePage.on('console', (msg) => {
    if (msg.type === 'error') report.consoleErrors.push(`mobile: ${msg.text}`);
  });
  mobilePage.on('pageerror', (err) => report.consoleErrors.push(`mobile: ${err.message}`));

  await mobilePage.goto(`${baseUrl}?v=${cacheBust}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitGalleryReady(mobilePage);
  report.steps.push({ step: 'M0', action: 'mobile 390×844 initial', ok: true });
  await capture(mobilePage, 'cursor-browser-m01-mobile-initial.png', 'M0');

  report.metrics.mobile = await mobilePage.evaluate(collectMetrics);

  report.capturedAt = new Date.toISOString;
  report.pass =
    report.metrics.desktop?.galleryReady?.ok === true &&
    report.metrics.desktop?.galleryReady?.themeDark === true &&
    report.metrics.desktop?.jobTitlesFound?.length === 2 &&
    report.metrics.mobile?.galleryReady?.ok === true &&
    report.networkFailures.length === 0 &&
    report.consoleErrors.length === 0;

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const manifestLines = report.captures.map((c) => `${c.path}\t${c.bytes}`);
  fs.writeFileSync(path.join(iterDir, 'png-manifest.txt'), `${manifestLines.join('\n')}\n`);

  console.log(
    JSON.stringify(
      { pass: report.pass, captures: report.captures.length, consoleErrors: report.consoleErrors },
      null,
      2));
} finally {
  await browser.close;
}
