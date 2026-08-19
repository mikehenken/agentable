/**
 * — 11-app-shell (panel content + Cursor aesthetic).
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const iterDir =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/retroactive-ui-coverage/11-app-shellscreenshots/11-app-shell';
const reportPath = path.join(
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/retroactive-ui-coverage/11-app-shell/',
  'gate7-browser-report.json');
const url11 = 'http://127.0.0.1:5199/examples/11-app-shell/index.html';
const cacheBust = 'iter4-20260723';
const STORAGE_KEY = 'agentable-app-shell:archipelago-resorts';

fs.mkdirSync(iterDir, { recursive: true });

const report = {
  url: `${url11}?v=${cacheBust}`,
  port: 5199,
  tool: 'playwright-supplementary',
  cursorIdeBrowserAttempted: true,
  cursorIdeBrowserBlocked: true,
  cursorIdeBrowserBlockReason: 'browser_navigate returned No browser tab available (ghost tab)',
  build: 'npm run build:embed:app-shell (2026-07-23 iter4)',
  localStorageCleared: true,
  consoleErrors: [],
  captures: [],
  contentChecks: {},
  aestheticChecks: {},
  resizeChecks: {},
};

async function capture(page, filename, phase) {
  const fullPath = path.join(iterDir, filename);
  await page.screenshot({ path: fullPath, fullPage: false });
  const stat = fs.statSync(fullPath);
  report.captures.push({ phase, filename, bytes: stat.size, path: fullPath });
  return fullPath;
}

async function capturePanel(page, panelTestId, filename, phase) {
  const fullPath = path.join(iterDir, filename);
  const panel = page.locator('agentable-app-shell').locator(`[data-testid="${panelTestId}"]`);
  await panel.screenshot({ path: fullPath });
  const stat = fs.statSync(fullPath);
  report.captures.push({ phase, filename, bytes: stat.size, path: fullPath });
  return fullPath;
}

async function clickTab(page, tabId) {
  await page.locator('agentable-app-shell').locator(`[data-dom-tab="${tabId}"]`).click;
  await page.waitForTimeout(400);
}

async function getMetrics(page) {
  return page.evaluate( => {
    const shell = document.querySelector('agentable-app-shell');
    const mount = shell?.shadowRoot?.querySelector('.agentable-app-shell-mount');
    const text = mount?.textContent ?? '';
    const mainBody = mount?.querySelector('[data-dom-region-body="main"]');
    const sidebarBody = mount?.querySelector('[data-dom-region-body="sidebar"]');
    const mainBg = mainBody ? getComputedStyle(mainBody).backgroundColor: null;
    const sidebarBg = sidebarBody ? getComputedStyle(sidebarBody).backgroundColor: null;
    const listRows = mount?.querySelectorAll('agentable-virtual-list') ?? [];
    return {
      galleryReady: window.__galleryReady ?? null,
      jobTitles: ['Guest Experience Lead', 'Culinary Innovation Chef'].filter((t) => text.includes(t)),
      growthPathText: text.includes('Guest Experience Associate') && text.includes('Regional Director'),
      applicationJobs: ['Guest Experience Lead', 'Culinary Innovation Chef'].filter((t) => text.includes(t)),
      resourceTitle: text.includes('Island onboarding compass'),
      mainBodyBackground: mainBg,
      sidebarBodyBackground: sidebarBg,
      hasVirtualList: Boolean(mount?.querySelector('agentable-virtual-list')),
      hasSpecTable: Boolean(mount?.querySelector('.spec-table')),
      hasHeaderSubtitle: Boolean(mount?.querySelector('.spec-block__subtitle')),
      whiteCardCount: mount
        ? Array.from(mount.querySelectorAll('*')).filter((el) => {
            const bg = getComputedStyle(el).backgroundColor;
            return bg === 'rgb(255, 255, 255)' || bg === '#ffffff';
          }).length: 0,
    };
  });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage;

page.on('console', (msg) => {
  if (msg.type === 'error') report.consoleErrors.push(msg.text);
});

await page.goto(`${url11}?v=${cacheBust}`, { waitUntil: 'networkidle' });
await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction( => window.__galleryReady?.ok === true, null, { timeout: 30000 });

await capture(page, 'cursor-browser-p00-workspace-desktop.png', 'P0');
await capturePanel(page, 'app-shell-panel-open-positions', 'cursor-browser-p01-panel-open-positions.png', 'P1');

await clickTab(page, 'growth-paths');
await capturePanel(page, 'app-shell-panel-growth-paths', 'cursor-browser-p02-panel-growth-paths.png', 'P2');

await clickTab(page, 'applications');
await capturePanel(page, 'app-shell-panel-applications', 'cursor-browser-p03-panel-applications.png', 'P3');

await clickTab(page, 'resources');
await capturePanel(page, 'app-shell-panel-resources', 'cursor-browser-p04-panel-resources.png', 'P4');

await clickTab(page, 'open-positions');
await capture(page, 'cursor-browser-c01-panel-surfaces.png', 'C1');

const metrics = await getMetrics(page);
report.contentChecks = {
  jobTitlesFound: metrics.jobTitles,
  growthPathVisible: metrics.growthPathText,
  resourceVisible: metrics.resourceTitle,
  hasVirtualList: metrics.hasVirtualList,
  hasSpecTable: metrics.hasSpecTable,
  hasHeaderSubtitle: metrics.hasHeaderSubtitle,
};
report.aestheticChecks = {
  mainBodyBackground: metrics.mainBodyBackground,
  sidebarBodyBackground: metrics.sidebarBodyBackground,
  whiteCardCountInMount: metrics.whiteCardCount,
  surfacesDistinct:
    metrics.mainBodyBackground !== null &&
    metrics.sidebarBodyBackground !== null &&
    metrics.mainBodyBackground !== metrics.sidebarBodyBackground,
};

await capture(page, 'cursor-browser-r01-split-default.png', 'R1');

const handle = page.locator('agentable-app-shell').locator('[data-dom-split-handle="true"]');
const handleBox = await handle.boundingBox;
if (handleBox) {
  await page.mouse.move(handleBox.x + handleBox.width 2, handleBox.y + handleBox.height 2);
  await page.mouse.down;
  await page.mouse.move(handleBox.x + handleBox.width 2 + 180, handleBox.y + handleBox.height 2, {
    steps: 12,
  });
  await page.mouse.up;
  await page.waitForTimeout(300);
}
await capture(page, 'cursor-browser-r03-split-sidebar-narrow.png', 'R3');

const sidebarWidth = await page.evaluate( => {
  const shell = document.querySelector('agentable-app-shell');
  const sidebar = shell?.shadowRoot?.querySelector('[data-dom-panel="sidebar"]');
  return sidebar ? Math.round(sidebar.getBoundingClientRect.width): null;
});
report.resizeChecks = { sidebarWidthPxAfterNarrowDrag: sidebarWidth };

await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction( => window.__galleryReady?.ok === true, null, { timeout: 30000 });
await capture(page, 'cursor-browser-m01-mobile-initial.png', 'M0');

const manifestLines = report.captures.map((c) => `${c.path}\t${c.bytes}`);
fs.writeFileSync(
  path.join(
    'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/retroactive-ui-coverage/11-app-shell/',
    'png-manifest.txt'),
  `${manifestLines.join('\n')}\n`);
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

await browser.close;
console.log(JSON.stringify(report, null, 2));
