/**
 * Iteration-11 browser proof — VP rubric signals + default panel dimensions.
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

const REACT_URL = 'http://localhost:5173/career-canvas-whiteboard?v=iter11';
const LIT_URL = 'http://localhost:5173/embed/sandals-whiteboard.html?v=iter11';

/** @param {import('@playwright/test').Page} page */
async function clickByText(page, text, exact = true) {
  const sidebar = page.locator('[data-testid="nav-sidebar"]');
  const sidebarCount = await sidebar.count;
  const root = sidebarCount > 0 ? sidebar: page.locator('body');
  const target = root.getByText(text, { exact });
  await target.first.click({ timeout: 15000, force: true });
  await page.waitForTimeout(2500);
}

/** @param {import('@playwright/test').Page} page */
async function bodyText(page) {
  return page.evaluate( => {
    const parts = [document.body?.innerText ?? ''];
    for (const host of document.querySelectorAll('agentable-whiteboard, agentable-canvas')) {
      const sr = host.shadowRoot;
      if (sr) parts.push(sr.textContent ?? '');
    }
    for (const container of document.querySelectorAll('.tl-html-container, [data-testid$="-panel"]')) {
      parts.push(container.textContent ?? '');
    }
    return parts.join('\n');
  });
}

/** @param {import('@playwright/test').Page} page */
async function measureChrome(page) {
  return page.evaluate( => {
    const canvas = document.querySelector('.tl-background,.tl-canvas');
    const canvasBg = canvas
      ? getComputedStyle(canvas).backgroundColor: getComputedStyle(document.body).backgroundColor;

    const composer = document.querySelector('[data-testid="chat-composer"], textarea, [contenteditable="true"]');
    const composerStyles = composer ? getComputedStyle(composer): null;

    const toolbarButtons = [...document.querySelectorAll('.tlui-toolbar button, [data-testid="whiteboard-toolbar"] button')];
    const questionMarks = toolbarButtons.filter((btn) => {
      const label = (btn.getAttribute('aria-label') ?? btn.textContent ?? '').toLowerCase;
      return label.includes('?') || btn.querySelector('text')?.textContent === '?';
    }).length;

    const panelRects = [...document.querySelectorAll('.tl-shape-panel, [data-testid$="-panel"]')].map((el) => {
        const r = el.getBoundingClientRect;
        return { testId: el.getAttribute('data-testid'), w: Math.round(r.width), h: Math.round(r.height) };
      }).filter((r) => r.w > 40 && r.h > 40);

    const zoomControl = document.querySelector('.tlui-zoom-menu, [data-testid="zoom-menu"], button[title*="Zoom"]');

    return {
      canvasBg,
      composerBg: composerStyles?.backgroundColor ?? null,
      composerColor: composerStyles?.color ?? null,
      toolbarButtonCount: toolbarButtons.length,
      questionMarkIcons: questionMarks,
      panelRects,
      hasZoomControl: Boolean(zoomControl),
    };
  });
}

/** @param {import('@playwright/test').Page} page */
async function triggerAutoArrange(page) {
  return page.evaluate( => {
    window.dispatchEvent(
      new CustomEvent('landi-whiteboard-auto-arrange', { bubbles: true, composed: true }));
    return true;
  });
}

/** @param {import('@playwright/test').Page} page @param {string} slug @param {Record<string, unknown>} extra */
async function capture(page, slug, extra = {}) {
  const text = await bodyText(page);
  const chrome = await measureChrome(page);
  const path = join(OUT, `${slug}.png`);
  await page.screenshot({ path, fullPage: false });
  const dump = {
    slug,
    capturedAt: new Date.toISOString,
    textSample: text.slice(0, 1800),
    chrome,...extra,
  };
  writeFileSync(join(OUT, `${slug}.json`), JSON.stringify(dump, null, 2));
  return dump;
}

/** @param {import('@playwright/test').Page} page @param {string} url */
async function gotoCareer(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(12000);
}

const NAV_ITEMS = [
  'Open Positions',
  'My Applications',
  'Resources',
  'Growth Paths',
  'Career Tools',
  'Settings',
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const results = [];

async function runSurface(prefix, url) {
  await gotoCareer(page, url);
  await triggerAutoArrange(page);
  await page.waitForTimeout(2000);

  results.push(
    await capture(page, `${prefix}-00-default-layout`, {
      url,
      step: 'auto-arrange-default',
    }));

  for (const [index, label] of NAV_ITEMS.entries) {
    await clickByText(page, label);
    results.push(
      await capture(page, `${prefix}-${String(index + 1).padStart(2, '0')}-${label.toLowerCase.replace(/\s+/g, '-')}`, {
        url,
        navItem: label,
      }));
  }

   Settings sub-nav
  for (const setting of ['Save & Sync', 'Notifications', 'Canvas', 'AI Features']) {
    try {
      await clickByText(page, setting, true);
      results.push(
        await capture(page, `${prefix}-settings-${setting.toLowerCase.replace(/\s+/g, '-')}`, {
          url,
          settingsSection: setting,
        }));
    } catch {
      results.push({ slug: `${prefix}-settings-${setting}`, error: 'click failed' });
    }
  }
}

try {
  await runSurface('react', REACT_URL);
  await runSurface('lit', LIT_URL);
} catch (err) {
  results.push({ error: String(err), stack: err instanceof Error ? err.stack: undefined });
}

writeFileSync(
  join(OUT, 'mcp-proof-manifest.json'),
  JSON.stringify(
    {
      iteration: 11,
      capturedAt: new Date.toISOString,
      reactUrl: REACT_URL,
      litUrl: LIT_URL,
      results,
    },
    null,
    2));

await browser.close;
console.log(`Wrote ${results.length} captures to ${OUT}`);
