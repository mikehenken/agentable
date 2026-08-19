/**
 * Iteration-5 comprehensive career browser proof — all panels + nav + zoom.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../landi-labs/studies/Orchestration/agentable-panels/logs/career-canvas-tldraw-paritybrowser-proof');
const ORIGINALS = join(ROOT, 'originals');
const AFTER = join(ROOT, 'after');

for (const dir of [ROOT, ORIGINALS, AFTER]) {
  mkdirSync(dir, { recursive: true });
}

const SANDALS_JOBS = [
  'Resort Manager',
  'Senior Software Developer',
  'Executive Chef',
  'Spa Therapist',
  'Front Desk Agent',
];

/** @param {import('@playwright/test').Page} page */
async function clickNavItem(page, label) {
  return page.evaluate((navLabel) => {
    const walk = (root) => {
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const text = (el.textContent || '').trim;
        if (text === navLabel) {
          el.click?.;
          return true;
        }
      }
      return false;
    };
    if (walk(document)) return { clicked: true, inShadow: false };
    const host = document.querySelector('agentable-whiteboard');
    const sr = host?.shadowRoot;
    if (sr && walk(sr)) return { clicked: true, inShadow: true };
    return { clicked: false };
  }, label);
}

/** @param {import('@playwright/test').Page} page */
async function evaluateSurface(page, navLabel) {
  return page.evaluate(({ jobs, navLabel: label }) => {
    const text = document.body.innerText;
    return {
      navLabel: label,
      matchedJobs: jobs.filter((title) => text.includes(title)),
      hasOpenPositionsEmpty: text.includes('No matches'),
      hasPanelNotRegistered: text.includes('Panel not registered'),
      hasAdapterUnavailable: text.includes('adapter unavailable') || text.includes('Adapter unavailable'),
      hasError: /\bError\b/.test(text) && text.includes('Panel'),
      menuExpanded: text.includes('Menu') && text.includes('Open Positions'),
      textSample: text.slice(0, 1800),
    };
  }, { jobs: SANDALS_JOBS, navLabel });
}

/** @param {import('@playwright/test').Page} page */
async function capture(page, outDir, slug, url, waitMs, navLabel) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(waitMs);
  if (navLabel) {
    await clickNavItem(page, navLabel);
    await page.waitForTimeout(3000);
  }
  const metrics = navLabel ? await evaluateSurface(page, navLabel): { navLabel: null };
  await page.screenshot({ path: join(outDir, `${slug}.png`), fullPage: false });
  const dump = {
    slug,
    url,
    navLabel,
    metrics,
    capturedAt: new Date.toISOString,
  };
  writeFileSync(join(outDir, `${slug}.json`), JSON.stringify(dump, null, 2));
  return dump;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const results = { originals: [], after: [] };

const originalCaptures = [
  ['moss-open-positions', 'http://127.0.0.1:5198/', 12000, 'Open Positions'],
  ['sandals-prod-whiteboard', 'https://sandals.justin-7a9.workers.dev/career-canvas-whiteboard', 12000, null],
];

for (const [slug, url, waitMs, nav] of originalCaptures) {
  try {
    results.originals.push(await capture(page, ORIGINALS, slug, url, waitMs, nav));
    console.log(`ORIGINAL OK ${slug}`);
  } catch (err) {
    const message = err instanceof Error ? err.message: String(err);
    results.originals.push({ slug, url, error: message });
    console.error(`ORIGINAL FAIL ${slug}: ${message}`);
  }
}

const afterCaptures = [
  ['lit-open-positions', 'http://localhost:5173/embed/sandals-whiteboard.html', 10000, 'Open Positions'],
  ['lit-applications', 'http://localhost:5173/embed/sandals-whiteboard.html', 10000, 'My Applications'],
  ['lit-resources', 'http://localhost:5173/embed/sandals-whiteboard.html', 10000, 'Resources'],
  ['lit-growth-paths', 'http://localhost:5173/embed/sandals-whiteboard.html', 10000, 'Growth Paths'],
  ['react-open-positions', 'http://localhost:5173/career-canvas-whiteboard', 12000, 'Open Positions'],
  ['react-applications', 'http://localhost:5173/career-canvas-whiteboard', 12000, 'My Applications'],
  ['react-chat-zoom-out', 'http://localhost:5173/career-canvas-whiteboard', 8000, null],
];

for (const [slug, url, waitMs, nav] of afterCaptures) {
  try {
    if (slug === 'react-chat-zoom-out') {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForTimeout(waitMs);
      await page.keyboard.press('Control+-');
      await page.keyboard.press('Control+-');
      await page.waitForTimeout(1500);
      const chatMetrics = await page.evaluate( => {
        const shapes = document.querySelectorAll('[data-panel-id="chat"], [data-testid="chat-panel"]');
        return {
          zoomedOut: true,
          bodySample: document.body.innerText.slice(0, 800),
          chatNodes: shapes.length,
        };
      });
      await page.screenshot({ path: join(AFTER, `${slug}.png`), fullPage: false });
      const dump = { slug, url, metrics: chatMetrics, capturedAt: new Date.toISOString };
      writeFileSync(join(AFTER, `${slug}.json`), JSON.stringify(dump, null, 2));
      results.after.push(dump);
    } else {
      results.after.push(await capture(page, AFTER, slug, url, waitMs, nav));
    }
    console.log(`AFTER OK ${slug}`);
  } catch (err) {
    const message = err instanceof Error ? err.message: String(err);
    results.after.push({ slug, url, error: message });
    console.error(`AFTER FAIL ${slug}: ${message}`);
  }
}

writeFileSync(join(ROOT, 'capture-summary.json'), JSON.stringify(results, null, 2));
await browser.close;
