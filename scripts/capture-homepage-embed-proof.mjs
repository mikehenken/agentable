/**
 * VP-13 homepage embed proof capture (1440×900).
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../landi-labs/studies/Orchestration/agentable-panels/logs/career-canvas-tldraw-paritybrowser-proof');
const SCREENSHOT = path.join(OUT_DIR, 'homepage-embed-qa-fix.png');
const MANIFEST = path.join(OUT_DIR, 'mcp-proof-manifest.json');
const URL = 'http://localhost:5173/#agent';

async function main {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-testid="career-homepage-embed-host"]', { timeout: 30000 });
  await page.locator('#agent').scrollIntoViewIfNeeded;
  await page.waitForTimeout(5000);

  const metrics = await page.evaluate(() => {
    const host = document.querySelector('[data-testid="career-homepage-embed-host"]');
    const frame =
      document.querySelector('[data-whiteboard-host-frame]') ??
      document.querySelector('.whiteboard-host-frame');
    const bodyText = document.body.innerText;
    const hasChat = /chat with sandy|how can i help|starter/i.test(bodyText);
    const hasOpenPositions = /open positions/i.test(bodyText);
    const hasNavRail = Boolean(
      document.querySelector('[data-testid="whiteboard-nav-rail"]') ??
        document.querySelector('[class*="NavRail"]') ??
        document.querySelector('aside'));
    const drawTool = document.querySelector('[data-tool="draw"], [aria-label="Draw"]');
    const ctaLinks = Array.from(document.querySelectorAll('#agent a[href]')).map((a) => ({
      text: (a.textContent ?? '').trim(),
      href: a.getAttribute('href'),
    }));
    const viewportW = window.innerWidth;
    const hostRect = host?.getBoundingClientRect;
    const frameRect = frame?.getBoundingClientRect;
    return {
      viewportW,
      hostWidthPx: hostRect?.width ?? 0,
      hostWidthPct: hostRect ? (hostRect.width viewportW) * 100: 0,
      frameWidthPx: frameRect?.width ?? 0,
      frameWidthPct: frameRect ? (frameRect.width viewportW) * 100: 0,
      hasChat,
      hasOpenPositions,
      hasNavRail,
      drawToolPresent: Boolean(drawTool),
      ctaCount: ctaLinks.length,
      ctaLinks,
      sandyTopBar: /sandy.*career concierge|career concierge/i.test(bodyText),
    };
  });

  await page.screenshot({ path: SCREENSHOT, fullPage: false });

  const pass =
    metrics.hostWidthPct >= 96 &&
    metrics.hasChat &&
    (metrics.hasOpenPositions || metrics.hasNavRail) &&
    metrics.ctaCount === 1 &&
    !metrics.drawToolPresent;

  const manifest = {
    capturedAt: new Date.toISOString(),
    url: URL,
    viewport: { width: 1440, height: 900 },
    screenshot: 'homepage-embed-qa-fix.png',
    metrics,
    verdict: pass ? 'PASS': 'FAIL',
    notes: [],
  };
  if (metrics.hostWidthPct < 96) manifest.notes.push(`Host width ${metrics.hostWidthPct.toFixed(1)}% < 96% viewport`);
  if (!metrics.hasChat) manifest.notes.push('Chat not detected on first paint');
  if (!metrics.hasOpenPositions && !metrics.hasNavRail) manifest.notes.push('No Open Positions or nav rail');
  if (metrics.ctaCount !== 1) manifest.notes.push(`Expected 1 CTA, found ${metrics.ctaCount}`);
  if (metrics.drawToolPresent) manifest.notes.push('Draw tool present');

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
  await browser.close;
  process.exit(pass ? 0: 1);
}

main.catch((err) => {
  console.error(err);
  process.exit(2);
});
