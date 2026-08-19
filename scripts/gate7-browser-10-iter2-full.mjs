/**
 * wave-3 — 10-locale-rtl browser verification.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const iterDir =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/retroactive-ui-coverage/10-locale-rtl/';
const shotDir = path.join(iterDir, 'outputs/browser-proof');
const reportPath = path.join(iterDir, 'gate7-browser-report.json');
const baseUrl = 'http://127.0.0.1:5199/examples/10-locale-rtl/index.html';
const cacheBust = 'iter2-favicon-fix-20260723';

fs.mkdirSync(shotDir, { recursive: true });

const report = {
  url: `${baseUrl}?v=${cacheBust}`,
  port: 5199,
  tool: 'playwright-supplementary',
  cursorIdeBrowserBlocked: false,
  cursorIdeBrowserError: null,
  build: 'dist/embed/agentable-panel.js',
  remediation: 'Added link rel=icon data URI to suppress /favicon.ico 404 console error',
  consoleMessages: [],
  consoleWarnings: [],
  consoleErrors: [],
  captures: [],
  steps: [],
  metrics: {},
};

function collectMetrics {
  const panel = document.querySelector('agentable-panel');
  const shadowDir = panel?.shadowRoot?.querySelector('[dir]')?.getAttribute('dir') ?? null;
  const list = panel?.shadowRoot?.querySelector('agentable-virtual-list');
  const text = list?.shadowRoot?.textContent ?? panel?.shadowRoot?.textContent ?? '';
  return {
    galleryReady: window.__galleryReady ?? null,
    docDir: document.documentElement.getAttribute('dir'),
    docLang: document.documentElement.lang,
    panelLocale: panel?.getAttribute('locale') ?? null,
    panelDir: shadowDir,
    panelTheme: panel?.getAttribute('data-theme') ?? null,
    brandVisible: document.querySelector('.brand-text h1')?.textContent?.includes('Archipelago') ?? false,
    localeSwitchPresent: Boolean(document.querySelector('[data-testid="locale-switch"]')),
    jobTitlesFound: ['Guest Experience Lead', 'Culinary Innovation Chef'].filter((t) => text.includes(t)),
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

async function waitGalleryReady(page, expectedLocale) {
  await page.waitForFunction(
    (locale) => {
      const ready = window.__galleryReady;
      const expectedDir = locale === 'ar' ? 'rtl': 'ltr';
      return (
        ready?.example === '10-locale-rtl' &&
        ready.ok === true &&
        ready.locale === locale &&
        ready.docDir === expectedDir &&
        ready.panelDir === expectedDir &&
        ready.themeDark === true
      );
    },
    expectedLocale,
    { timeout: 45000 });
  await page.waitForFunction(
     => {
      const panel = document.querySelector('agentable-panel');
      const list = panel?.shadowRoot?.querySelector('agentable-virtual-list');
      const rowText = list?.shadowRoot?.textContent ?? '';
      return (
        Array.isArray(list?.items) &&
        list.items.length >= 2 &&
        rowText.includes('Guest Experience Lead') &&
        rowText.includes('Culinary Innovation Chef')
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

  await page.goto(`${baseUrl}?v=${cacheBust}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitGalleryReady(page, 'ar');
  report.steps.push({ step: 'S0', action: 'initial load Arabic RTL desktop', ok: true });
  await capture(page, 'cursor-browser-01-initial-load-ar-desktop.png', 'S0');

  report.steps.push({ step: 'S1', action: 'panel close-up Arabic RTL', ok: true });
  await capturePanel(page, 'cursor-browser-02-panel-ar-rtl-closeup.png', 'S1');

  await page.locator('[data-locale="en"]').click;
  await waitGalleryReady(page, 'en');
  report.steps.push({ step: 'S2', action: 'switch to English LTR', ok: true });
  await capture(page, 'cursor-browser-03-after-switch-en-ltr.png', 'S2');

  report.steps.push({ step: 'S3', action: 'panel close-up English LTR', ok: true });
  await capturePanel(page, 'cursor-browser-04-panel-en-ltr-closeup.png', 'S3');

  await page.locator('[data-locale="ar"]').click;
  await waitGalleryReady(page, 'ar');
  report.steps.push({ step: 'S4', action: 'switch back to Arabic RTL', ok: true });
  await capture(page, 'cursor-browser-05-after-switch-back-ar.png', 'S4');

  report.steps.push({ step: 'S5', action: 'panel close-up Arabic restored', ok: true });
  await capturePanel(page, 'cursor-browser-06-panel-ar-restored-closeup.png', 'S5');

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
  await waitGalleryReady(mobilePage, 'ar');
  report.steps.push({ step: 'M0', action: 'mobile Arabic initial', ok: true });
  await capture(mobilePage, 'cursor-browser-m01-mobile-ar-initial.png', 'M0');

  await mobilePage.locator('[data-locale="en"]').click;
  await waitGalleryReady(mobilePage, 'en');
  report.steps.push({ step: 'M1', action: 'mobile switch to English', ok: true });
  await capture(mobilePage, 'cursor-browser-m02-mobile-en-after-switch.png', 'M1');

  report.metrics.mobile = await mobilePage.evaluate(collectMetrics);

  report.capturedAt = new Date.toISOString();
  report.pass =
    report.metrics.desktop?.galleryReady?.ok === true &&
    report.metrics.desktop?.galleryReady?.themeDark === true &&
    report.metrics.desktop?.jobTitlesFound?.length === 2 &&
    report.metrics.mobile?.galleryReady?.ok === true &&
    report.consoleErrors.length === 0;

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const manifestLines = report.captures.map((c) => `${c.path}\t${c.bytes}`);
  fs.writeFileSync(path.join(iterDir, 'png-manifest.txt'), `${manifestLines.join('\n')}\n`);

  console.log(JSON.stringify({ pass: report.pass, captures: report.captures.length, consoleErrors: report.consoleErrors }, null, 2));
} finally {
  await browser.close;
}
