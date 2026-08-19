/**
 * self-verify — Meridian gallery /4/5 visual capture.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const shotDir = path.join(
  repoRoot,
  'logs/retroactive-ui-coverage/12-open-agent-canvasscreenshots');
const reportPath = path.join(
  repoRoot,
  'logs/retroactive-ui-coverage/12-open-agent-canvas/gate7-browser-report.json');
const baseUrl = 'http://127.0.0.1:5199/examples/12-open-agent-canvas/index.html';

fs.mkdirSync(shotDir, { recursive: true });

/** @type {Record<string, unknown>} */
const report = {
  url: `${baseUrl}?v=iter4-self-verify`,
  tool: 'playwright-self-verify',
  build: 'npm run build:embed:whiteboard',
  captures: [],
  steps: [],
};

function shadowQuery {
  function deepQuerySelector(selector) {
    const roots = [];
    const wb = document.querySelector('agentable-whiteboard');
    if (wb?.shadowRoot) roots.push(wb.shadowRoot);
    const seen = new Set;
    while (roots.length > 0) {
      const root = roots.shift;
      if (root === undefined || seen.has(root)) continue;
      seen.add(root);
      const hit = root.querySelector(selector);
      if (hit) return hit;
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) roots.push(el.shadowRoot);
      });
    }
    return null;
  }

  function deepTextIncludes(needle) {
    const roots = [document];
    const wb = document.querySelector('agentable-whiteboard');
    if (wb?.shadowRoot) roots.push(wb.shadowRoot);
    const seen = new Set;
    while (roots.length > 0) {
      const root = roots.shift;
      if (root === undefined || seen.has(root)) continue;
      seen.add(root);
      if ((root.textContent ?? '').includes(needle)) return true;
      if ('querySelectorAll' in root) {
        root.querySelectorAll('*').forEach((el) => {
          if (el.shadowRoot) roots.push(el.shadowRoot);
        });
      }
    }
    return false;
  }

  const docPanel = deepQuerySelector('[data-testid="meridian-document-panel"]');
  const exportConfirmation = deepQuerySelector('[data-testid="meridian-export-confirmation"]');
  const hitlCard = deepQuerySelector('[data-testid="meridian-hitl-card"]');
  const blockTypes = ['heading', 'paragraph', 'list', 'callout'].filter((type) =>
    deepQuerySelector(`[data-block-type="${type}"]`));

  return {
    galleryDemoPhase: window.__galleryDemoPhase ?? null,
    meridianDocumentResult: window.__meridianDocumentResult ?? null,
    meridianExportResult: window.__meridianExportResult ?? null,
    meridianHitlResult: window.__meridianHitlResult ?? null,
    documentPanelVisible: Boolean(docPanel && docPanel.offsetHeight > 0),
    documentTitleVisible: deepTextIncludes('Meridian Labs Product Brief'),
    blockTypesFound: blockTypes,
    exportConfirmationVisible: Boolean(exportConfirmation && exportConfirmation.offsetHeight > 0),
    exportMessageVisible: deepTextIncludes('PDF exported'),
    hitlCardVisible: Boolean(hitlCard && hitlCard.offsetHeight > 0),
  };
}

async function waitForMetric(page, predicate, timeoutMs = 120_000) {
  const deadline = Date.now + timeoutMs;
  while (Date.now < deadline) {
    const metrics = await page.evaluate(shadowQuery);
    if (predicate(metrics)) return metrics;
    await page.waitForTimeout(80);
  }
  return null;
}

async function capture(page, filename, phase) {
  const fullPath = path.join(shotDir, filename);
  await page.screenshot({ path: fullPath, fullPage: false });
  const stat = fs.statSync(fullPath);
  report.captures.push({ phase, filename, bytes: stat.size, path: fullPath });
}

async function runMeridianStep(page, step) {
  return page.evaluate(async (demoStep) => {
    const board = document.querySelector('agentable-whiteboard');
    if (!(board instanceof HTMLElement) || typeof board.runMeridianDemo !== 'function') {
      throw new Error('runMeridianDemo unavailable');
    }
    await board.whenReady(45_000);
    return board.runMeridianDemo(demoStep);
  }, step);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage;

await page.route('**/gallery-demo.mjs', (route) => route.abort);

await page.goto(`${baseUrl}?v=iter4-self-verify`, {
  waitUntil: 'domcontentloaded',
  timeout: 90_000,
});

await page.waitForFunction( => {
  const board = document.querySelector('agentable-whiteboard');
  const shadow = board?.shadowRoot;
  return Boolean(shadow?.querySelector('canvas'));
}, null, { timeout: 90_000 });

await runMeridianStep(page, 'wireframe');
await page.waitForTimeout(600);

const documentPromise = runMeridianStep(page, 'document');
const docMetrics = await waitForMetric(
  page,
  (m) =>
    m.documentPanelVisible ||
    m.documentTitleVisible ||
    (m.blockTypesFound?.length ?? 0) >= 3,
  45_000);
await capture(page, 'iter4-us3-document-panel.png', '');
const document = await documentPromise;
report.steps.push({ step: '-document', document, metrics: docMetrics });

const exportPromise = runMeridianStep(page, 'export');
const exportMetrics = await waitForMetric(
  page,
  (m) => m.exportConfirmationVisible || m.exportMessageVisible,
  45_000);
await capture(page, 'iter4-us4-export-confirmation.png', '');
const exportResult = await exportPromise;
report.steps.push({ step: '-export', exportResult, metrics: exportMetrics });

const hitlPromise = runMeridianStep(page, 'hitl');
let hitlMetrics = null;
for (let i = 0; i < 200; i += 1) {
  hitlMetrics = await page.evaluate(shadowQuery);
  if (hitlMetrics.hitlCardVisible) {
    await page.waitForTimeout(300);
    hitlMetrics = await page.evaluate(shadowQuery);
    await capture(page, 'iter4-us5-hitl-approval-card.png', '');
    report.steps.push({ step: '-hitl-capture', metrics: hitlMetrics });
    break;
  }
  await page.waitForTimeout(80);
}
const hitl = await hitlPromise;
report.steps.push({ step: '-hitl-result', hitl, metrics: hitlMetrics });

report.usVerdict = {
  us3: Boolean(
    document?.document?.ok === true &&
      (docMetrics?.documentPanelVisible ||
        docMetrics?.documentTitleVisible ||
        (docMetrics?.blockTypesFound?.length ?? 0) >= 3)),
  us4: Boolean(
    exportMetrics?.exportConfirmationVisible ||
      exportMetrics?.exportMessageVisible ||
      exportResult?.ok === true),
  us5: Boolean(hitlMetrics?.hitlCardVisible || hitl?.ok === true),
};

report.capturedAt = new Date.toISOString;
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
await context.close;
await browser.close;

console.log(JSON.stringify({ usVerdict: report.usVerdict, captures: report.captures }, null, 2));
