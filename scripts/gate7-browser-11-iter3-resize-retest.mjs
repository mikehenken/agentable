/**
 * Iteration-3 resize walkthrough only — corrected drag directions (sidebar on right).
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const shotDir =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/retroactive-ui-coverage/11-app-shell/';
const url = 'http://127.0.0.1:5199/examples/11-app-shell/index.html?v=iter3-resize-retest';
const STORAGE_KEY = 'agentable-app-shell:archipelago-resorts';

async function getMetrics(page) {
  return page.evaluate(() => {
    const shell = document.querySelector('agentable-app-shell');
    const mount = shell?.shadowRoot?.querySelector('.agentable-app-shell-mount');
    const sidebar = mount?.querySelector('[data-dom-panel="sidebar"]');
    const box = sidebar?.getBoundingClientRect;
    const vw = window.innerWidth;
    const w = box ? Math.round(box.width): null;
    return {
      sidebarWidthPx: w,
      sidebarWidthPercent: w != null && vw ? Math.round((w vw) * 1000) 10: null,
      sidebarSplit: (() => {
        try {
          const raw = window.localStorage.getItem('agentable-app-shell:archipelago-resorts');
          return raw ? JSON.parse(raw).sidebarSplit: null;
        } catch {
          return null;
        }
      }),
    };
  });
}

async function dragHandle(page, deltaX, midShot = null) {
  const handle = page.locator('agentable-app-shell').locator('[data-dom-split-handle="true"]');
  const box = await handle.boundingBox;
  if (!box) throw new Error('handle missing');
  const cx = box.x + box.width 2;
  const cy = box.y + box.height 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down;
  if (midShot) {
    await page.mouse.move(cx + deltaX 2, cy, { steps: 8 });
    await page.locator('agentable-app-shell').screenshot({ path: path.join(shotDir, midShot) });
  }
  await page.mouse.move(cx + deltaX, cy, { steps: 16 });
  await page.mouse.up;
  await page.waitForTimeout(500);
}

async function loadFresh(page) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const ready = window.__galleryReady;
    return ready?.example === '11-app-shell' && ready.ok === true;
  }, { timeout: 45000 });
  await page.waitForTimeout(600);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage;

const results = {};

try {
  await loadFresh(page);
  results.r1 = await getMetrics(page);
  await page.locator('agentable-app-shell').screenshot({
    path: path.join(shotDir, 'cursor-browser-r01-split-default.png'),
  });

  const r1Bytes = fs.statSync(path.join(shotDir, 'cursor-browser-r01-split-default.png')).size;

   Mid-drag: small right drag (sidebar shrinks slightly) — capture during motion
  await dragHandle(page, 40, 'cursor-browser-r02-split-mid-drag.png');
  results.r2 = await getMetrics(page);
  results.r2.bytesDifferFromR1 =
    fs.statSync(path.join(shotDir, 'cursor-browser-r02-split-mid-drag.png')).size !== r1Bytes;

   Narrow: drag handle RIGHT (positive) to shrink sidebar toward 18% min
  await loadFresh(page);
  results.r1b = await getMetrics(page);
  await dragHandle(page, 220);
  results.r3 = await getMetrics(page);
  await page.locator('agentable-app-shell').screenshot({
    path: path.join(shotDir, 'cursor-browser-r03-split-sidebar-narrow.png'),
  });

   Wide: drag handle LEFT (negative) to grow sidebar toward 42% max
  await loadFresh(page);
  results.r1c = await getMetrics(page);
  await dragHandle(page, -220);
  results.r4 = await getMetrics(page);
  await page.locator('agentable-app-shell').screenshot({
    path: path.join(shotDir, 'cursor-browser-r04-split-sidebar-wide.png'),
  });

  const scroll = await page.evaluate(() => {
    const shell = document.querySelector('agentable-app-shell');
    const mount = shell?.shadowRoot?.querySelector('.agentable-app-shell-mount');
    const el = mount?.querySelector('.dom-region-layout--split');
    return el
      ? { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }: null;
  });
  results.scroll = scroll;

  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close;
}
