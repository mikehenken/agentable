/**
 * GATE 7 browser verification — example 09-multi-agent-page.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const studyRoot =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels';
const shotDir = path.join(studyRoot, 'logs/retroactive-ui-coverage/p8screenshots/09-multi-agent-page');
const reportPath = path.join(studyRoot, 'logs/retroactive-ui-coverage/p8gate7-09-multi-agent-page-report.json');
const consolePath = path.join(studyRoot, 'logs/p8-agents-draw-and-see/example-09-multi-agent-pageconsole.log');
const url = 'http://127.0.0.1:5199/examples/09-multi-agent-page/index.html';

fs.mkdirSync(shotDir, { recursive: true });
fs.mkdirSync(path.dirname(consolePath), { recursive: true });

const report = {
  example: '09-multi-agent-page',
  url,
  port: 5199,
  steps: [],
  consoleErrors: [],
  pass: false,
  timestampUtc: new Date.toISOString(),
};

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage;

page.on('console', (msg) => {
  if (msg.type === 'error') report.consoleErrors.push(msg.text);
});
page.on('pageerror', (err) => {
  report.consoleErrors.push(err.message);
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });

await page.waitForFunction(
   => window.__galleryReady?.example === '09-multi-agent-page' && window.__galleryReady?.ok === true,
  null,
  { timeout: 45_000 });

const ready = await page.evaluate(() => window.__galleryReady);
const multiResult = await page.evaluate(() => window.__multiAgentE2eResult);
report.steps.push({ step: 'gallery-ready', ready, multiResult });

await page.screenshot({ path: path.join(shotDir, '01-initial-load.png'), fullPage: true });

const statusText = await page.locator('#status').textContent;
report.steps.push({ step: 'status-json', length: statusText?.length ?? 0 });

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mobilePage = await mobile.newPage;
mobilePage.on('console', (msg) => {
  if (msg.type === 'error') report.consoleErrors.push(`[mobile] ${msg.text}`);
});
await mobilePage.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
await mobilePage.waitForFunction(
   => window.__galleryReady?.example === '09-multi-agent-page' && window.__galleryReady?.ok === true,
  null,
  { timeout: 45_000 });
await mobilePage.screenshot({ path: path.join(shotDir, '02-mobile.png'), fullPage: true });
await mobile.close;

const filteredErrors = report.consoleErrors.filter(
  (line) =>
    !line.includes('favicon.ico') &&
    !line.includes('Failed to load resource') &&
    !line.includes('net::ERR') &&
    !line.includes('Lit is in dev mode'));

report.filteredErrors = filteredErrors;
report.pass =
  ready?.ok === true &&
  multiResult?.ok === true &&
  Array.isArray(multiResult?.checks) &&
  multiResult.checks.every((c) => c.ok === true) &&
  filteredErrors.length === 0;

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
fs.writeFileSync(
  consolePath,
  [
    `# console capture — 09-multi-agent-page GATE 7 `,
    `timestamp: ${report.timestampUtc}`,
    `raw_errors: ${report.consoleErrors.length}`,
    `filtered_errors: ${filteredErrors.length}`,
    '',...report.consoleErrors.map((e) => `ERROR: ${e}`),
  ].join('\n'));

console.log(JSON.stringify({ pass: report.pass, reportPath, shotDir }, null, 2));
await browser.close;
process.exit(report.pass ? 0: 1);
