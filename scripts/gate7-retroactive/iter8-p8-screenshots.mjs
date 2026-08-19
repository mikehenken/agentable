/**
 * P8 cursor-browser verification screenshots.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const shotDir = path.resolve(
  repoRoot,
  '../landi-labs/studies/Orchestration/agentable-panels/logs/retroactive-ui-coverage/p8screenshots/p8-agent-draw-demo');

const url = 'http://127.0.0.1:5199/examples/p8-agent-draw-demo/index.html?v=iter8-verify';

async function waitForReady(page) {
  await page.goto(url);
  await page.waitForFunction(
     => window.__galleryReady?.ok === true,
    undefined,
    { timeout: 60_000 });
  await page.waitForTimeout(1500);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage;

await mkdir(shotDir, { recursive: true });

await waitForReady(page);

await page.getByTestId('p8-draw-flow').click;
await page.waitForTimeout(2500);
await page.screenshot({
  path: path.join(shotDir, 'cursor-browser-02-after-draw-flow.png'),
  fullPage: false,
});

await page.getByTestId('p8-clear').click;
await page.waitForTimeout(800);
await page.getByTestId('p8-run-full-demo').click;
await page.waitForFunction(
   => {
    const log = document.getElementById('p8-activity-log');
    return log?.textContent?.includes('Demo complete') ?? false;
  },
  undefined,
  { timeout: 45_000 });
await page.waitForTimeout(1200);
await page.screenshot({
  path: path.join(shotDir, 'cursor-browser-04-after-full-demo.png'),
  fullPage: false,
});

const result = await page.evaluate( => window.__p8AgentDrawDemoResult);
const logText = await page.evaluate( => document.getElementById('p8-activity-log')?.textContent ?? '');
const labels = await page.evaluate( => {
  const texts = Array.from(document.querySelectorAll('.tl-shape p,.tl-shape span, svg text')).map((el) => el.textContent?.trim).filter(Boolean);
  return texts.filter((t) =>
    ['Client brief', 'Moodboard', 'Concept sketches', 'Final delivery', 'Northstar Atelier'].includes(t));
});

await context.close;

const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mobilePage = await mobileContext.newPage;
await waitForReady(mobilePage);
await mobilePage.getByTestId('p8-run-full-demo').click;
await mobilePage.waitForFunction(
   => {
    const log = document.getElementById('p8-activity-log');
    return log?.textContent?.includes('Demo complete') ?? false;
  },
  undefined,
  { timeout: 45_000 });
await mobilePage.waitForTimeout(1200);
await mobilePage.screenshot({
  path: path.join(shotDir, 'cursor-browser-m02-mobile-after-full-demo.png'),
  fullPage: false,
});

const mobileResult = await mobilePage.evaluate( => window.__p8AgentDrawDemoResult);

await mobileContext.close;
await browser.close;

const metrics = {
  ok: result?.ok === true && (result?.agentStampedCount ?? 0) > 0,
  result,
  mobileResult,
  labelsFound: labels,
  logSnippet: logText.slice(0, 500),
  shotDir,
  screenshots: [
    'cursor-browser-02-after-draw-flow.png',
    'cursor-browser-04-after-full-demo.png',
    'cursor-browser-m02-mobile-after-full-demo.png',
  ],
};

console.log(JSON.stringify(metrics, null, 2));
