/**
 * Iteration-4 career surface browser proof.
 * cursor-ide-browser ghost-tab fallback — Playwright capture only.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../landi-labs/studies/Orchestration/agentable-panels/logs/career-canvas-tldraw-paritybrowser-proof');

mkdirSync(OUT_DIR, { recursive: true });

/** @type {Array<{ slug: string; url: string; waitMs: number }>} */
const TARGETS = [
  {
    slug: '01-lit-sandals-whiteboard-embed',
    url: 'http://localhost:5173/embed/sandals-whiteboard.html',
    waitMs: 10_000,
  },
  {
    slug: '02-react-career-canvas-whiteboard',
    url: 'http://localhost:5173/career-canvas-whiteboard',
    waitMs: 12_000,
  },
  {
    slug: '03-moss-careers-harness',
    url: 'http://127.0.0.1:5198/',
    waitMs: 12_000,
  },
  {
    slug: '04-sandals-prod-workers-dev',
    url: 'https://sandals.justin-7a9.workers.dev/',
    waitMs: 15_000,
  },
];

/**
 * @param {import('@playwright/test').Page} page
 */
async function evaluateSurface(page) {
  return page.evaluate( => {
    const v = window.__TLDRAW_LIBRARY_VERSIONS__;
    const names = (v?.versions ?? []).map((x) => x.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    const host =
      document.querySelector('agentable-whiteboard') ??
      document.querySelector('agentable-canvas');
    const navRail =
      document.querySelector('[data-testid="nav-sidebar"]') ??
      document.querySelector('.nav-sidebar') ??
      host?.shadowRoot?.querySelector('[data-testid="nav-sidebar"],.nav-sidebar, nav');
    const menuLabel = document.body.innerText.includes('Open Positions');
    return {
      url: location.href,
      title: document.title,
      tldraw: {
        didWarn: v?.didWarn ?? null,
        packageCount: names.length,
        uniqueCount: new Set(names).size,
        dupes,
        pass: v?.didWarn === false && dupes.length === 0,
      },
      hostTag: host?.tagName?.toLowerCase ?? null,
      hasLightCanvas: host?.hasAttribute('light-canvas') ?? false,
      hasDarkCanvas: host?.hasAttribute('dark-canvas') ?? false,
      navRailPresent: navRail !== null && navRail !== undefined,
      openPositionsTextVisible: menuLabel,
    };
  });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ slug: string; url: string; waitMs: number }} target
 */
async function captureTarget(page, target) {
  await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(target.waitMs);
  const surface = await evaluateSurface(page);
  const pngPath = join(OUT_DIR, `${target.slug}.png`);
  await page.screenshot({ path: pngPath, fullPage: false });
  const dump = {...surface,
    slug: target.slug,
    capturedAt: new Date.toISOString,
    captureTool: 'playwright-fallback',
    label: 'SUPPLEMENTARY — cursor-ide-browser ghost-tab fallback',
  };
  writeFileSync(join(OUT_DIR, `${target.slug}.json`), JSON.stringify(dump, null, 2));
  return dump;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const results = [];

for (const target of TARGETS) {
  try {
    results.push(await captureTarget(page, target));
    console.log(`OK ${target.slug}`);
  } catch (err) {
    const message = err instanceof Error ? err.message: String(err);
    results.push({ slug: target.slug, url: target.url, error: message });
    console.error(`FAIL ${target.slug}: ${message}`);
  }
}

writeFileSync(join(OUT_DIR, 'capture-summary.json'), JSON.stringify(results, null, 2));
await browser.close;
