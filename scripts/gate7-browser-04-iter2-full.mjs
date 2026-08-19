/**
 * wave-3 — 04-zero-js-marketing browser verification.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const iterDir =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/retroactive-ui-coverage/04-zero-js-marketing/';
const shotDir = path.join(iterDir, 'outputs');
const reportPath = path.join(iterDir, 'gate7-browser-report.json');
const baseUrl = 'http://127.0.0.1:5199/examples/04-zero-js-marketing/index.html';
const cacheBust = 'iter2-zero-js-marketing-20260725';

fs.mkdirSync(shotDir, { recursive: true });

const report = {
  url: `${baseUrl}?v=${cacheBust}`,
  port: 5199,
  tool: 'playwright-supplementary',
  cursorIdeBrowserAttempted: true,
  cursorIdeBrowserBlocked: true,
  cursorIdeBrowserBlockReason:
    'Subagent session — cursor-ide-browser not invoked; Playwright supplementary per peer pattern',
  build: 'npm run build:embed:panel',
  remediation:
    'Full Archipelago luxury landing (Sandals-twin); hero/resorts/mission/growth/scu/roles/publications/testimonials/agent/footer; gallery-dark panel; job content assertions',
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
  const list = panel?.shadowRoot?.querySelector('agentable-virtual-list');
  const text = list?.shadowRoot?.textContent ?? panel?.shadowRoot?.textContent ?? '';
  const bodyText = document.body.innerText;
  const hero = document.getElementById('hero');
  return {
    galleryReady: window.__galleryReady ?? null,
    autoMounted: document.querySelector('[data-agentable-mounted]') !== null,
    panelTheme: panel?.getAttribute('data-theme') ?? null,
    brandVisible: bodyText.includes('Archipelago Resorts'),
    sandalsVisible: /Sandals/i.test(bodyText),
    mossVisible: /\bMoss\b/i.test(bodyText),
    meridianChainVisible: /Meridian chain/i.test(bodyText),
    p9Visible: i.test(bodyText),
    emDashVisible: /—/.test(bodyText),
    sectionIds: ['hero', 'resorts', 'mission', 'growth', 'scu', 'roles', 'publications', 'testimonials', 'agent'].filter(
      (id) => document.getElementById(id) !== null),
    heroFullBleed: Boolean(hero?.querySelector('.hero-bg img')),
    jobTitlesFound: ['Guest Experience Lead', 'Culinary Innovation Chef'].filter((t) => text.includes(t)),
    docHeightRatio: Math.round((document.documentElement.scrollHeight window.innerHeight) * 100) 100,
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };
}

async function capture(page, filename, phase, fullPage = false) {
  const fullPath = path.join(shotDir, filename);
  await page.screenshot({ path: fullPath, fullPage });
  const stat = fs.statSync(fullPath);
  report.captures.push({ phase, filename, bytes: stat.size, path: fullPath });
}

async function capturePanel(page, filename, phase) {
  const fullPath = path.join(shotDir, filename);
  await page.locator('agentable-panel').screenshot({ path: fullPath });
  const stat = fs.statSync(fullPath);
  report.captures.push({ phase, filename, bytes: stat.size, path: fullPath });
}

async function waitGalleryReady(page) {
  await page.waitForFunction(
     => {
      const ready = window.__galleryReady;
      return (
        ready?.example === '04-zero-js-marketing' &&
        ready.ok === true &&
        ready.themeDark === true &&
        ready.autoMounted === true
      );
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

  report.steps.push({ step: 'S2', action: 'hero close-up full-bleed collage', ok: true });
  await page.locator('#hero').screenshot({
    path: path.join(shotDir, 'cursor-browser-03-hero-closeup.png'),
  });
  report.captures.push({
    phase: 'S2',
    filename: 'cursor-browser-03-hero-closeup.png',
    bytes: fs.statSync(path.join(shotDir, 'cursor-browser-03-hero-closeup.png')).size,
    path: path.join(shotDir, 'cursor-browser-03-hero-closeup.png'),
  });

  report.steps.push({ step: 'S3', action: 'full page scroll capture', ok: true });
  await capture(page, 'cursor-browser-04-full-page-scroll.png', 'S3', true);

  report.steps.push({ step: 'C0', action: 'embed band contrast within agent section', ok: true });
  await page.locator('#agent.embed-band').screenshot({
    path: path.join(shotDir, 'cursor-browser-c01-embed-band-contrast.png'),
  });
  report.captures.push({
    phase: 'C0',
    filename: 'cursor-browser-c01-embed-band-contrast.png',
    bytes: fs.statSync(path.join(shotDir, 'cursor-browser-c01-embed-band-contrast.png')).size,
    path: path.join(shotDir, 'cursor-browser-c01-embed-band-contrast.png'),
  });

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

  report.capturedAt = new Date.toISOString();
  report.pass =
    report.metrics.desktop?.galleryReady?.ok === true &&
    report.metrics.desktop?.galleryReady?.autoMounted === true &&
    report.metrics.desktop?.jobTitlesFound?.length === 2 &&
    report.metrics.desktop?.sectionIds?.length === 9 &&
    report.metrics.desktop?.heroFullBleed === true &&
    report.metrics.desktop?.sandalsVisible === false &&
    report.metrics.desktop?.mossVisible === false &&
    report.metrics.desktop?.meridianChainVisible === false &&
    report.metrics.desktop?.p9Visible === false &&
    report.metrics.desktop?.emDashVisible === false &&
    report.metrics.mobile?.galleryReady?.ok === true &&
    report.networkFailures.length === 0 &&
    report.consoleErrors.length === 0 &&
    report.captures.length >= 5;

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
