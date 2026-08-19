/**
 * SUPPLEMENTARY - NOT A PASS — Playwright diagnostic capture for.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(
  ROOT,
  '../../../landi-labs/studies/Orchestration/agentable-panels/logs/career-canvas-tldraw-paritybrowser-proof-supplementary');

async function captureUrl(url, screenshotName, consoleName) {
  const browser = await chromium.launch;
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const logs = [];
  page.on('console', (message) => {
    logs.push({ type: message.type, text: message.text });
  });
  page.on('pageerror', (error) => {
    logs.push({ type: 'pageerror', text: error.message });
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: path.join(OUT_DIR, screenshotName), fullPage: true });

  const tldrawVersions = await page.evaluate( => {
    return window.__TLDRAW_LIBRARY_VERSIONS__ ?? null;
  });

  await writeFile(
    path.join(OUT_DIR, consoleName),
    JSON.stringify({ url, logs, tldrawVersions }, null, 2),
    'utf8');
  await browser.close;
}

await mkdir(OUT_DIR, { recursive: true });
await captureUrl(
  'http://localhost:5173/career-canvas-whiteboard',
  '01-sandals-react-whiteboard-SUPPLEMENTARY.png',
  'console-sandals-react-whiteboard.json');
await captureUrl(
  'http://localhost:5173/embed/sandals-whiteboard.html',
  '02-sandals-lit-embed-SUPPLEMENTARY.png',
  'console-sandals-lit-embed.json');
console.log('SUPPLEMENTARY captures written to', OUT_DIR);
