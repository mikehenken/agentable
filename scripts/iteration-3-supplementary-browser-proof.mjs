/**
 * Iteration-3 supplementary browser proofs — SUPPLEMENTARY NOT A PASS.
 * Parent session must re-run browser-proof-checklist.md for real PASS.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../landi-labs/studies/Orchestration/agentable-panels/logs/career-canvas-tldraw-paritybrowser-proof-supplementary');

const TARGETS = [
  {
    slug: 'example-12-meridian-dark-chrome',
    url: 'http://127.0.0.1:5199/examples/12-open-agent-canvas/index.html',
    waitMs: 12_000,
  },
  {
    slug: 'lit-career-whiteboard',
    url: 'http://localhost:5173/embed/sandals-whiteboard.html',
    waitMs: 10_000,
  },
];

async function evaluateTldraw(page) {
  return page.evaluate( => {
    const v = window.__TLDRAW_LIBRARY_VERSIONS__;
    const names = (v?.versions ?? []).map((x) => x.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    return {
      didWarn: v?.didWarn,
      packageCount: names.length,
      uniqueCount: new Set(names).size,
      dupes,
      pass: v?.didWarn === false && dupes.length === 0,
    };
  });
}

async function evaluateDarkChrome(page) {
  return page.evaluate( => {
    const host = document.querySelector('agentable-whiteboard');
    const mount = host?.shadowRoot?.querySelector('.agentable-whiteboard-mount');
    const canvasRoot = mount?.querySelector('[data-testid="whiteboard-shell"],.tl-container,.tl-theme__dark');
    const hostBg = host ? getComputedStyle(host).backgroundColor: null;
    const darkSurface = mount?.querySelector('.tl-theme__dark') !== null;
    return {
      hasDarkCanvasAttribute: host?.hasAttribute('dark-canvas') ?? false,
      darkSurface,
      hostBackground: hostBg,
      foundCanvasRoot: canvasRoot !== null && canvasRoot !== undefined,
    };
  });
}

async function captureTarget(page, target) {
  await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(target.waitMs);

  const tldraw = await evaluateTldraw(page);
  const darkChrome = target.slug.includes('example-12') ? await evaluateDarkChrome(page): null;

  const pngPath = join(OUT_DIR, `${target.slug}.png`);
  await page.screenshot({ path: pngPath, fullPage: false });

  const dump = {
    url: target.url,
    slug: target.slug,
    tldraw,
    darkChrome,
    label: 'SUPPLEMENTARY - NOT A PASS',
  };
  writeFileSync(join(OUT_DIR, `${target.slug}.json`), JSON.stringify(dump, null, 2));

  const analysis = [
    `# ${target.slug} — SUPPLEMENTARY - NOT A PASS`,
    '',
    `**URL:** ${target.url}`,
    '',
    '## As a user',
    target.slug.includes('example-12')
      ? '- Meridian Labs gallery page with dark page chrome (#0f172a header). With `dark-canvas` on the embed, whiteboard chrome should match the pre- dark operator look rather than light Career Concierge (#F0F0EC).': '- Sandals career whiteboard with explicit `light-canvas` on light page background.',
    '',
    '## Console evaluate',
    '```json',
    JSON.stringify(dump, null, 2),
    '```',
    '',
  ].join('\n');
  writeFileSync(join(OUT_DIR, `${target.slug}-analysis.md`), analysis);
}

async function main {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  for (const target of TARGETS) {
    try {
      await captureTarget(page, target);
      console.log(`captured ${target.slug}`);
    } catch (error) {
      const message = error instanceof Error ? error.message: String(error);
      writeFileSync(
        join(OUT_DIR, `${target.slug}-error.txt`),
        `SUPPLEMENTARY capture failed: ${message}`);
      console.error(`failed ${target.slug}:`, message);
    }
  }

  await browser.close;
}

main.catch((error) => {
  console.error(error);
  process.exit(1);
});
