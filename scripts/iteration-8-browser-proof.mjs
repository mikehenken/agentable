/**
 * Iteration-8 full browser proof — all P0 panels, settings, tool-call blocks.
 * React career whiteboard + Lit embed. Saves to /browser-proof/.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../landi-labs/studies/Orchestration/agentable-panels/logs/career-canvas-tldraw-paritybrowser-proof');
mkdirSync(OUT, { recursive: true });

const REACT_URL = 'http://localhost:5173/career-canvas-whiteboard';
const LIT_URL = 'http://localhost:5173/embed/sandals-whiteboard.html';

/** @param {import('@playwright/test').Page} page */
async function clickByText(page, text, exact = true) {
  const sidebar = page.locator('[data-testid="nav-sidebar"]');
  const sidebarCount = await sidebar.count;
  const root = sidebarCount > 0 ? sidebar: page.locator('body');
  const target = root.getByText(text, { exact });
  await target.first.click({ timeout: 15000, force: true });
  return { clicked: true, via: sidebarCount > 0 ? 'nav-sidebar': 'body' };
}

/** @param {import('@playwright/test').Page} page */
async function bodyText(page) {
  return page.evaluate( => {
    const parts = [document.body?.innerText ?? ''];
    for (const host of document.querySelectorAll('agentable-whiteboard, agentable-canvas')) {
      const sr = host.shadowRoot;
      if (sr) parts.push(sr.textContent ?? '');
    }
     tldraw HTMLContainer panels live under.tl-html-container
    for (const container of document.querySelectorAll('.tl-html-container, [data-testid$="-panel"]')) {
      parts.push(container.textContent ?? '');
    }
    return parts.join('\n');
  });
}

/** @param {import('@playwright/test').Page} page */
async function capture(page, slug, extra = {}) {
  const text = await bodyText(page);
  const path = join(OUT, `${slug}.png`);
  await page.screenshot({ path, fullPage: false });
  const dump = {
    slug,
    capturedAt: new Date.toISOString,
    textSample: text.slice(0, 2400),...extra,
  };
  writeFileSync(join(OUT, `${slug}.json`), JSON.stringify(dump, null, 2));
  return dump;
}

/** @param {import('@playwright/test').Page} page */
async function gotoCareer(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(10000);
}

/** @param {import('@playwright/test').Page} page */
async function openNav(page, label) {
  const result = await clickByText(page, label, true);
  await page.waitForTimeout(3000);
  return result;
}

/** @param {import('@playwright/test').Page} page @param {string} testId */
async function waitForPanel(page, testId) {
  try {
    await page.locator(`[data-testid="${testId}"]`).first.waitFor({ state: 'visible', timeout: 8000 });
    return true;
  } catch {
    return false;
  }
}

/** @param {import('@playwright/test').Page} page */
async function injectToolCallBlock(page) {
  return page.evaluate( => {
    window.dispatchEvent(
      new CustomEvent('landi:tool-call', {
        detail: {
          name: 'open_positions',
          args: { location: 'Jamaica', track: 'Professionals' },
          ok: true,
          timestamp: new Date.toISOString,
        },
        bubbles: true,
        composed: true,
      }));
    return true;
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const results = [];

async function runSurface(prefix, url) {
  await gotoCareer(page, url);

   Nav rail
  results.push(
    await capture(page, `${prefix}-01-nav-rail`, {
      url,
      step: 'nav-rail-expanded',
      hasSettings: (await bodyText(page)).includes('Settings'),
      hasNewChat: (await bodyText(page)).includes('New Chat'),
    }));

   Open Positions + track chips
  await openNav(page, 'Open Positions');
  await waitForPanel(page, 'open-positions-panel');
  const opText = await bodyText(page);
  results.push(
    await capture(page, `${prefix}-02-open-positions`, {
      url,
      hasJobs: opText.includes('Resort Manager'),
      hasTrackFilter: opText.includes('Track') || opText.includes('Professionals'),
      hasSalary: opText.includes('$') || opText.includes('payRange'),
    }));

   Job detail + Apply Now
  await clickByText(page, 'Resort Manager', false);
  await page.waitForTimeout(2000);
  results.push(
    await capture(page, `${prefix}-03-job-detail`, {
      url,
      hasApplyNow: (await bodyText(page)).includes('Apply Now'),
    }));

   Applications + detail
  await openNav(page, 'My Applications');
  results.push(await capture(page, `${prefix}-04-applications`, { url }));
  await clickByText(page, 'Resort Manager', false);
  await page.waitForTimeout(2000);
  results.push(
    await capture(page, `${prefix}-05-application-detail`, {
      url,
      hasTimeline: (await bodyText(page)).includes('Timeline'),
    }));

   Resources
  await openNav(page, 'Resources');
  results.push(
    await capture(page, `${prefix}-06-resources`, {
      url,
      hasFeatured: (await bodyText(page)).includes('Recommended read'),
    }));

   Growth paths + detail
  await openNav(page, 'Growth Paths');
  results.push(await capture(page, `${prefix}-07-growth-paths`, { url }));
  await clickByText(page, 'Front desk', false);
  await page.waitForTimeout(2000);
  results.push(
    await capture(page, `${prefix}-08-growth-path-detail`, {
      url,
      hasFit: (await bodyText(page)).includes('fit'),
    }));

   Career tools
  await openNav(page, 'Career Tools');
  results.push(await capture(page, `${prefix}-09-career-tools`, { url }));

   Resume & docs — label may be key or translated
  const resumeClick =
    (await openNav(page, 'Resume & Docs')).clicked ||
    (await openNav(page, 'career.nav.resumeDocs')).clicked;
  results.push(await capture(page, `${prefix}-10-resume-docs`, { url, resumeClick }));

   Settings via footer
  await clickByText(page, 'Settings', true);
  await page.waitForTimeout(2000);
  results.push(
    await capture(page, `${prefix}-11-settings`, {
      url,
      hasSaveSync: (await bodyText(page)).includes('Save & Sync'),
    }));

   Journey via dock-menu toolbar (dispatch custom action)
  await page.evaluate( => {
    window.dispatchEvent(
      new CustomEvent('landi-whiteboard-custom-action:dock-menu', {
        detail: { id: 'dock-menu' },
        bubbles: true,
      }));
  });
  await page.waitForTimeout(2000);
  results.push(await capture(page, `${prefix}-12-journey`, { url }));

   Recent activity via toolbar event
  await page.evaluate( => {
    window.dispatchEvent(
      new CustomEvent('landi-whiteboard-custom-action:recent-activity', {
        detail: { id: 'recent-activity' },
        bubbles: true,
      }));
  });
  await page.waitForTimeout(2000);
  results.push(await capture(page, `${prefix}-13-recent-activity`, { url }));

   Tool-call block in chat
  await openNav(page, 'New Chat');
  await page.waitForTimeout(1500);
  await injectToolCallBlock(page);
  await page.waitForTimeout(1000);
  results.push(
    await capture(page, `${prefix}-14-chat-tool-call`, {
      url,
      hasToolBlock: (await bodyText(page)).includes('open_positions'),
    }));
}

try {
  console.log('Capturing React career whiteboard…');
  await runSurface('react', REACT_URL);
  console.log('Capturing Lit embed…');
  await runSurface('lit', LIT_URL);
} catch (err) {
  const message = err instanceof Error ? err.message: String(err);
  results.push({ error: message, capturedAt: new Date.toISOString });
  console.error('PROOF FAIL:', message);
}

writeFileSync(join(OUT, 'capture-summary.json'), JSON.stringify(results, null, 2));
await browser.close;
console.log(`Done — ${results.length} captures → ${OUT}`);
