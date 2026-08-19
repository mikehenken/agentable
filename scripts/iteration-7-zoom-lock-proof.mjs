/**
 * Iteration-7 — verify canvas zoom stays locked on career whiteboard.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../landi-labs/studies/Orchestration/agentable-panels/logs/career-canvas-tldraw-paritybrowser-proof');
mkdirSync(OUT, { recursive: true });

const URL = 'http://localhost:5173/career-canvas-whiteboard';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(12000);

const beforeZoom = await page.evaluate(() => {
  const el = document.querySelector('.tlui-zoom-menu__button');
  return el?.textContent?.trim() ?? null;
});

await page.mouse.move(720, 450);
for (let i = 0; i < 8; i++) {
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(150);
}

const afterZoom = await page.evaluate(() => {
  const el = document.querySelector('.tlui-zoom-menu__button');
  return el?.textContent?.trim() ?? null;
});

const canvasMode = await page.evaluate(() =>
  document.querySelector('[data-canvas-mode]')?.getAttribute('data-canvas-mode'));

await page.screenshot({ path: join(OUT, 'zoom-lock-after-wheel.png'), fullPage: false });

const record = {
  url: URL,
  canvasModeAttr: canvasMode,
  zoomBeforeWheel: beforeZoom,
  zoomAfterWheel: afterZoom,
  zoomLocked: beforeZoom !== null && beforeZoom === afterZoom,
  capturedAt: new Date.toISOString(),
};

writeFileSync(join(OUT, 'zoom-lock-proof.json'), JSON.stringify(record, null, 2));
await browser.close;
console.log(' zoom proof:', record);
