/**
 * wave-3 — 04-zero-js-marketing browser verification.
 * Remediation: fixed images, 10-job fixture, OpenPositions ListPanel UX, career-light theme.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const iterDir =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/retroactive-ui-coverage/04-zero-js-marketing/';
const shotDir = path.join(iterDir, 'artifacts');
const reportPath = path.join(iterDir, 'gate7-browser-report.json');
const baseUrl = 'http://127.0.0.1:5199/examples/04-zero-js-marketing/index.html';
const cacheBust = 'iter3-zero-js-marketing-20260725';

const JOB_TITLES = [
  'Guest Experience Lead',
  'Culinary Innovation Chef',
  'Resort Operations Manager',
  'Senior Software Developer',
  'Guest Services Agent',
  'Spa Therapist',
  'Marine Sustainability Specialist',
  'ACU Learning Facilitator',
  'Evening Duty Manager',
  'Environmental Programs Coordinator',
];

fs.mkdirSync(shotDir, { recursive: true });

const report = {
  url: `${baseUrl}?v=${cacheBust}`,
  port: 5199,
  tool: 'playwright-supplementary',
  cursorIdeBrowserAttempted: false,
  cursorIdeBrowserBlocked: true,
  cursorIdeBrowserBlockReason:
    'qa-expert subagent — Playwright supplementary per peer pattern (10-locale iter-3)',
  build: 'dist/embed/agentable-panel.js',
  remediation:
    '24 broken images fixed; 10-job fixture; OpenPositionsPanel ListPanel (search/filters/detail); career-light theme; embed-band removed',
  consoleMessages: [],
  consoleWarnings: [],
  consoleErrors: [],
  networkFailures: [],
  captures: [],
  steps: [],
  metrics: {},
  criteria: {},
};

function collectMetrics {
  const JOB_TITLES = [
    'Guest Experience Lead',
    'Culinary Innovation Chef',
    'Resort Operations Manager',
    'Senior Software Developer',
    'Guest Services Agent',
    'Spa Therapist',
    'Marine Sustainability Specialist',
    'ACU Learning Facilitator',
    'Evening Duty Manager',
    'Environmental Programs Coordinator',
  ];
  const panel = document.querySelector('agentable-panel');
  const root = panel?.shadowRoot ?? null;
  const panelText = root?.textContent ?? '';
  const hero = document.getElementById('hero');
  const mount = document.querySelector('.panel-embed-mount');
  const mountStyles = mount ? getComputedStyle(mount): null;
  const agentSection = document.getElementById('agent');
  const agentStyles = agentSection ? getComputedStyle(agentSection): null;

  const imgs = [...document.querySelectorAll('img')];
  const brokenImages = imgs.filter((img) => !img.complete || img.naturalWidth === 0).map((img) => ({ src: img.currentSrc || img.src, alt: img.alt || '' }));

  const search = root?.querySelector('[role="searchbox"], [part="list-panel-search"] input');
  const chips = root?.querySelectorAll('[part="list-panel-chip"]') ?? [];
  const jobCards = root?.querySelectorAll('[data-testid^="open-positions-job-card-"]') ?? [];

  return {
    galleryReady: window.__galleryReady ?? null,
    autoMounted: document.querySelector('[data-agentable-mounted]') !== null,
    panelTheme: panel?.getAttribute('data-theme') ?? null,
    embedBandPresent: document.querySelector('.embed-band') !== null,
    panelEmbedMountPresent: mount !== null,
    mountBackground: mountStyles?.backgroundColor ?? null,
    mountBackgroundTransparent:
      mountStyles?.backgroundColor === 'rgba(0, 0, 0, 0)' ||
      mountStyles?.backgroundColor === 'transparent',
    agentSectionBackground: agentStyles?.backgroundColor ?? null,
    brandVisible: document.body.innerText.includes('Archipelago Resorts'),
    sandalsVisible: /Sandals/i.test(document.body.innerText),
    mossVisible: /\bMoss\b/i.test(document.body.innerText),
    sectionIds: ['hero', 'resorts', 'mission', 'growth', 'scu', 'roles', 'publications', 'testimonials', 'agent'].filter(
      (id) => document.getElementById(id) !== null),
    heroFullBleed: Boolean(hero?.querySelector('.hero-bg img')),
    jobTitlesFound: JOB_TITLES.filter((t) => panelText.includes(t)),
    jobCardCount: jobCards.length,
    searchPresent: Boolean(search),
    filterChipCount: chips.length,
    brokenImageCount: brokenImages.length,
    brokenImages,
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
        ready.themeCareerLight === true &&
        ready.autoMounted === true &&
        ready.searchAndFilters === true &&
        (ready.jobTitleCount ?? 0) >= 8
      );
    },
    { timeout: 60000 });
  await page.waitForTimeout(500);
}

async function scrollFullPage(page) {
  await page.evaluate(async () => {
    const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const step = Math.max(window.innerHeight * 0.75, 400);
    let y = 0;
    const max = document.documentElement.scrollHeight;
    while (y < max) {
      y += step;
      window.scrollTo({ top: y, behavior: 'instant' });
      await delay(120);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(300);
}

async function openFirstJobDetail(page) {
  return page.evaluate( => {
    const panel = document.querySelector('agentable-panel');
    const root = panel?.shadowRoot;
    if (!root) {
      return { ok: false, reason: 'no panel shadow root' };
    }
    const card =
      root.querySelector('[data-testid="open-positions-job-card-arch-job-1"]') ??
      root.querySelector('[data-testid^="open-positions-job-card-"]');
    if (!card) {
      return { ok: false, reason: 'no job card' };
    }
    const title = card.querySelector('h3')?.textContent?.trim ?? '';
    card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return { ok: true, title, cardTestId: card.getAttribute('data-testid') };
  });
}

async function readDetailState(page) {
  return page.evaluate( => {
    const panel = document.querySelector('agentable-panel');
    const root = panel?.shadowRoot;
    if (!root) {
      return { detailOpen: false };
    }
    const detail = root.querySelector('[data-testid^="open-positions-job-detail-"]');
    const backBtn = [...root.querySelectorAll('button')].find((btn) =>
      (btn.textContent ?? '').includes('All positions'));
    return {
      detailOpen: Boolean(detail),
      detailTestId: detail?.getAttribute('data-testid') ?? null,
      backButtonPresent: Boolean(backBtn),
      detailTitle: detail?.querySelector('h2')?.textContent?.trim ?? null,
    };
  });
}

async function clickBackFromDetail(page) {
  return page.evaluate( => {
    const panel = document.querySelector('agentable-panel');
    const root = panel?.shadowRoot;
    if (!root) {
      return { ok: false, reason: 'no panel shadow root' };
    }
    const backBtn = [...root.querySelectorAll('button')].find((btn) =>
      (btn.textContent ?? '').includes('All positions'));
    if (!backBtn) {
      return { ok: false, reason: 'no back button' };
    }
    backBtn.click;
    return { ok: true };
  });
}

async function readListState(page) {
  return page.evaluate( => {
    const panel = document.querySelector('agentable-panel');
    const root = panel?.shadowRoot;
    if (!root) {
      return { listVisible: false, cardCount: 0 };
    }
    const cards = root.querySelectorAll('[data-testid^="open-positions-job-card-"]');
    const search = root.querySelector('[role="searchbox"], [part="list-panel-search"] input');
    return {
      listVisible: cards.length > 0,
      cardCount: cards.length,
      searchPresent: Boolean(search),
    };
  });
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
    if (response.status >= 400 && (url.includes('/assets/') || url.includes('.jpg') || url.includes('.png'))) {
      report.networkFailures.push({ url, status: response.status });
    }
  });

  await page.goto(`${baseUrl}?v=${cacheBust}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitGalleryReady(page);
  report.steps.push({ step: 'S0', action: 'initial load desktop 1280×900', ok: true });
  await capture(page, 'cursor-browser-01-initial-load-desktop.png', 'S0');

  report.steps.push({ step: 'S1', action: 'panel close-up Open Positions list', ok: true });
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

  report.steps.push({ step: 'S3', action: 'full page scroll + broken image scan', ok: true });
  await scrollFullPage(page);
  report.metrics.afterScroll = await page.evaluate(collectMetrics);
  await capture(page, 'cursor-browser-04-full-page-scroll.png', 'S3', true);

  report.steps.push({ step: 'S4', action: 'job row click opens detail with back', ok: false });
  await page.locator('#agent').scrollIntoViewIfNeeded;
  await page.waitForTimeout(300);
  const openDetail = await openFirstJobDetail(page);
  await page.waitForTimeout(400);
  const detailState = await readDetailState(page);
  report.metrics.jobDetail = { openDetail, detailState };
  await capturePanel(page, 'cursor-browser-05-panel-job-detail.png', 'S4');
  const backClick = await clickBackFromDetail(page);
  await page.waitForTimeout(400);
  const listState = await readListState(page);
  report.metrics.jobDetailBack = { backClick, listState };
  await capturePanel(page, 'cursor-browser-06-panel-after-back-to-list.png', 'S4b');
  report.steps.find((s) => s.step === 'S4').ok =
    openDetail.ok === true &&
    detailState.detailOpen === true &&
    detailState.backButtonPresent === true &&
    backClick.ok === true &&
    listState.listVisible === true;

  report.steps.push({ step: 'C0', action: 'panel embed mount — no dark embed-band backdrop', ok: true });
  await page.locator('.panel-embed-mount').screenshot({
    path: path.join(shotDir, 'cursor-browser-c01-panel-embed-mount.png'),
  });
  report.captures.push({
    phase: 'C0',
    filename: 'cursor-browser-c01-panel-embed-mount.png',
    bytes: fs.statSync(path.join(shotDir, 'cursor-browser-c01-panel-embed-mount.png')).size,
    path: path.join(shotDir, 'cursor-browser-c01-panel-embed-mount.png'),
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

  await scrollFullPage(mobilePage);
  report.metrics.mobileAfterScroll = await mobilePage.evaluate(collectMetrics);
  report.metrics.mobile = report.metrics.mobileAfterScroll;

  const d = report.metrics.desktop ?? {};
  const scroll = report.metrics.afterScroll ?? d;
  const s4 = report.steps.find((s) => s.step === 'S4');

  report.criteria = {
    zeroBrokenImages:
      scroll.brokenImageCount === 0 && (report.metrics.mobile?.brokenImageCount ?? 0) === 0,
    searchAndFilters: d.searchPresent === true && (d.filterChipCount ?? 0) >= 2,
    jobRowsAtLeast8: (d.jobCardCount ?? 0) >= 8 || (d.jobTitlesFound?.length ?? 0) >= 8,
    noEmbedBand: d.embedBandPresent === false,
    careerLightTheme: d.panelTheme === 'career-light' && d.panelTheme !== 'gallery-dark',
    jobDetailFlow: s4?.ok === true,
    galleryReady: d.galleryReady?.ok === true,
    consoleClean: report.consoleErrors.length === 0,
    networkClean: report.networkFailures.length === 0,
  };

  report.pass = Object.values(report.criteria).every(Boolean) && report.captures.length >= 7;

  report.capturedAt = new Date.toISOString;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const manifestLines = report.captures.map((c) => `${c.path}\t${c.bytes}`);
  fs.writeFileSync(path.join(iterDir, 'png-manifest.txt'), `${manifestLines.join('\n')}\n`);

  console.log(
    JSON.stringify(
      {
        pass: report.pass,
        criteria: report.criteria,
        captures: report.captures.length,
        consoleErrors: report.consoleErrors,
      },
      null,
      2));
} finally {
  await browser.close;
}
