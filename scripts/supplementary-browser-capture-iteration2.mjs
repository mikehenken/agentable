/**
 * SUPPLEMENTARY - NOT A PASS — Playwright diagnostics.
 * Validates combined career-whiteboard.js: single tldraw copy + nav rail.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(
  ROOT,
  '../../../landi-labs/studies/Orchestration/agentable-panels/logs/career-canvas-tldraw-paritybrowser-proof-supplementary');

const LIT_EMBED_URL = 'http://localhost:5173/embed/sandals-whiteboard.html';
const REACT_WHITEBOARD_URL = 'http://localhost:5173/career-canvas-whiteboard';

async function captureLitEmbed {
  const browser = await chromium.launch;
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const logs = [];
  page.on('console', (message) => {
    logs.push({ type: message.type, text: message.text });
  });
  page.on('pageerror', (error) => {
    logs.push({ type: 'pageerror', text: error.message });
  });

  await page.goto(LIT_EMBED_URL, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(10000);

  const tldrawVersions = await page.evaluate( => {
    return window.__TLDRAW_LIBRARY_VERSIONS__ ?? null;
  });

  const navRailPresent = await page.evaluate( => {
    const host = document.querySelector('agentable-whiteboard');
    const root = host?.shadowRoot;
    if (!root) return { ok: false, reason: 'no shadow root' };
    const text = root.textContent ?? '';
    const hasMenu = text.includes('Menu') || text.includes('Open Positions');
    const hasBriefcase = root.querySelector('svg.lucide-briefcase') !== null;
    return {
      ok: hasMenu || hasBriefcase,
      hasMenu,
      hasBriefcase,
      snippet: text.slice(0, 500),
    };
  });

  await page.screenshot({
    path: path.join(OUT_DIR, '01-lit-career-whiteboard-SUPPLEMENTARY.png'),
    fullPage: true,
  });

  await writeFile(
    path.join(OUT_DIR, 'console-lit-career-whiteboard.json'),
    JSON.stringify({ url: LIT_EMBED_URL, logs, tldrawVersions, navRailPresent }, null, 2),
    'utf8');

  await browser.close;

  return { tldrawVersions, navRailPresent };
}

async function captureReactWhiteboard {
  const browser = await chromium.launch;
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const logs = [];
  page.on('console', (message) => {
    logs.push({ type: message.type, text: message.text });
  });
  page.on('pageerror', (error) => {
    logs.push({ type: 'pageerror', text: error.message });
  });

  await page.goto(REACT_WHITEBOARD_URL, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(8000);

  const tldrawVersions = await page.evaluate( => window.__TLDRAW_LIBRARY_VERSIONS__ ?? null);

  await page.screenshot({
    path: path.join(OUT_DIR, '02-react-career-whiteboard-SUPPLEMENTARY.png'),
    fullPage: true,
  });

  await writeFile(
    path.join(OUT_DIR, 'console-react-career-whiteboard.json'),
    JSON.stringify({ url: REACT_WHITEBOARD_URL, logs, tldrawVersions }, null, 2),
    'utf8');

  await browser.close;
}

await mkdir(OUT_DIR, { recursive: true });
const litResult = await captureLitEmbed;
await captureReactWhiteboard;

const versions = litResult.tldrawVersions?.versions ?? [];
const names = versions.map((entry) => entry.name);
const uniqueNames = new Set(names);
const didWarn = litResult.tldrawVersions?.didWarn === true;

console.log('SUPPLEMENTARY capture complete');
console.log(' tldraw package count:', names.length);
console.log(' unique packages:', uniqueNames.size);
console.log(' didWarn:', litResult.tldrawVersions?.didWarn);
console.log(' nav rail:', litResult.navRailPresent);

if (names.length !== uniqueNames.size || didWarn) {
  process.exitCode = 1;
}

if (!litResult.navRailPresent.ok) {
  process.exitCode = 1;
}
