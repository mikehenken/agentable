/**

 * GATE 7 browser verification — example p8-agent-draw-demo.

 * v1.5.2: layoutMetrics + interaction proof sequence + functional pass criteria.

 */

import { chromium } from 'playwright';

import path from 'node:path';

import fs from 'node:fs';



const studyRoot =

  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels';

const iterationDir = path.join(studyRoot, 'logs/retroactive-ui-coverage/p8/');

const shotDir = path.join(iterationDir, 'screenshots/p8-agent-draw-demo');

const reportPath = path.join(iterationDir, 'gate7-p8-agent-draw-demo-report.json');

const consolePath = path.join(

  studyRoot,

  'logs/p8-agents-draw-and-see/example-p8-agent-draw-democonsole.log');

const url = 'http://127.0.0.1:5199/examples/p8-agent-draw-demo/index.html';



const BEFORE_RUN_RATIO_MAX = 1.25;

const AFTER_DEMO_RATIO_MAX = 2.0;

const STABILITY_DELTA_MAX_PX = 50;



fs.mkdirSync(shotDir, { recursive: true });

fs.mkdirSync(path.dirname(consolePath), { recursive: true });



/** @typedef {{ label: string, scrollHeight: number, innerHeight: number, ratio: number, canvasVisibleInViewport: boolean, canvasBBox: Record<string, number> | null }} LayoutMetric *** @param {import('playwright').Page} page @param {string} label */

async function collectLayoutMetric(page, label) {

  return page.evaluate((metricLabel) => {

    const scrollHeight = Math.max(

      document.documentElement.scrollHeight,

      document.body?.scrollHeight ?? 0);

    const innerHeight = window.innerHeight;

    const ratio = innerHeight > 0 ? scrollHeight innerHeight: Number.POSITIVE_INFINITY;

    const host =

      document.querySelector('[data-testid="p8-canvas-host"]') ??

      document.querySelector('main');

    let canvasVisibleInViewport = false;

    /** @type {Record<string, number> | null} */

    let canvasBBox = null;

    if (host instanceof HTMLElement) {

      const rect = host.getBoundingClientRect;

      const visibleTop = Math.max(rect.top, 0);

      const visibleBottom = Math.min(rect.bottom, innerHeight);

      const visibleHeight = Math.max(0, visibleBottom - visibleTop);

      canvasBBox = {

        x: rect.x,

        y: rect.y,

        width: rect.width,

        height: rect.height,

        clientHeight: host.clientHeight,

        visibleHeight,

      };

      canvasVisibleInViewport =

        rect.width > 80 &&

        visibleHeight >= 200 &&

        visibleBottom > 0 &&

        visibleTop < innerHeight;

    }

    return {

      label: metricLabel,

      scrollHeight,

      innerHeight,

      ratio: Number(ratio.toFixed(4)),

      canvasVisibleInViewport,

      canvasBBox,

    };

  }, label);

}



/**

 * @param {import('playwright').Page} page

 * @param {string} prefix

 */

async function measureIdleStability(page, prefix) {

  const t0 = await collectLayoutMetric(page, `${prefix}-T+0s`);

  await page.waitForTimeout(2000);

  const t2 = await collectLayoutMetric(page, `${prefix}-T+2s`);

  await page.waitForTimeout(3000);

  const t5 = await collectLayoutMetric(page, `${prefix}-T+5s`);

  const delta = Math.abs(t5.scrollHeight - t0.scrollHeight);

  return { samples: [t0, t2, t5], delta, stable: delta <= STABILITY_DELTA_MAX_PX };

}



/** @param {LayoutMetric} metric @param {number} innerWidth */

function canvasBoundedAtBeforeRun(metric, innerWidth) {

  if (metric.canvasBBox === null) return false;

  const visibleHeight =

    typeof metric.canvasBBox.visibleHeight === 'number'

      ? metric.canvasBBox.visibleHeight: Math.min(metric.canvasBBox.y + metric.canvasBBox.height, metric.innerHeight) -

        Math.max(metric.canvasBBox.y, 0);

  const clientHeight =

    typeof metric.canvasBBox.clientHeight === 'number'

      ? metric.canvasBBox.clientHeight: visibleHeight;

  return (

    metric.ratio <= BEFORE_RUN_RATIO_MAX &&

    visibleHeight >= 200 &&

    clientHeight >= 200 &&

    clientHeight <= metric.innerHeight * 1.05 &&

    metric.canvasBBox.width >= 80 &&

    metric.canvasBBox.width <= innerWidth * 1.05

  );

}



/** @param {LayoutMetric} metric @param {'before-run' | 'after-demo'} phase @param {number} innerWidth */

function evaluateLayoutMetric(metric, phase, innerWidth) {

  const ratioMax = phase === 'before-run' ? BEFORE_RUN_RATIO_MAX: AFTER_DEMO_RATIO_MAX;

  const ratioPass = metric.ratio <= ratioMax;

  const canvasVisiblePass = phase === 'before-run' ? metric.canvasVisibleInViewport: true;

  const canvasBoundedPass =

    phase === 'before-run' ? canvasBoundedAtBeforeRun(metric, innerWidth): true;

  return {

    ratioPass,

    canvasVisiblePass,

    canvasBoundedPass,

    pass: ratioPass && canvasVisiblePass && canvasBoundedPass,

  };

}



/** @param {import('playwright').Page} page */

async function collectFunctionalSignals(page) {

  return page.evaluate( => {

    const chatRoot =

      document.querySelector('[data-testid="whiteboard-chat-panel"]') ??

      document.querySelector('[data-testid="whiteboard-chat-column"]');

    const chatText = chatRoot?.textContent ?? '';

    const thinkingVisible =

      document.querySelector('[role="status"]')?.textContent?.includes('Thinking') ?? false;

    const rawJsonInChat =

      /\{[\s\S]*?"nodes"|layout=\{|diagram=\{|_demoSummary=/.test(chatText) ||

      /draw_shapes\(\{/.test(chatText);

    return {

      canvasLegible: window.__p8AgentDrawDemoCanvasLegible === true,

      legibility: window.__p8AgentDrawDemoLegibility ?? null,

      chatSettled: window.__p8AgentDrawDemoChatSettled === true,

      demoResult: window.__p8AgentDrawDemoResult ?? null,

      thinkingVisible,

      rawJsonInChat,

      chatTextSample: chatText.slice(0, 400),

    };

  });

}



/** @param {Record<string, unknown>} signals */

function evaluateFunctional(signals) {

  const demoResult = /** @type {{ ok?: boolean, agentStampedCount?: number } | null} */ (

    signals.demoResult

  );

  const agentCount = demoResult?.agentStampedCount ?? 0;
  const legibility = /** @type {{ visibleGeoNodeCount?: number } | null} */ (
    signals.legibility
  );
  const visibleGeoNodes = legibility?.visibleGeoNodeCount ?? 0;

  return {

    canvasLegible: signals.canvasLegible === true,

    visibleGeoNodes,

    agentStampedOk: demoResult?.ok === true && agentCount >= 4,

    chatNotThinking: signals.thinkingVisible !== true,

    noRawJsonInChat: signals.rawJsonInChat !== true,

    chatSettledWhenExpected: signals.chatSettled === true,

    pass:

      signals.canvasLegible === true &&

      visibleGeoNodes >= 4 &&

      demoResult?.ok === true &&

      agentCount >= 4 &&

      signals.thinkingVisible !== true &&

      signals.rawJsonInChat !== true,

  };

}



const report = {

  example: 'p8-agent-draw-demo',

  url,

  port: 5199,

  iteration: 4,

  config: 'v1.5.2-functional-user-review',

  interactionSteps: [],

  layoutMetrics: [],

  layoutStability: [],

  layoutPass: false,

  functionalPass: false,

  consoleErrors: [],

  pass: false,

  timestampUtc: new Date.toISOString,

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

await page.getByTestId('p8-run-full-demo').waitFor({ state: 'visible', timeout: 45_000 });

await page.waitForFunction( => window.__galleryReady?.ok === true, null, { timeout: 45_000 });



const desktopStability = await measureIdleStability(page, 'desktop-before-run');

report.layoutStability.push({ viewport: 'desktop',...desktopStability });

report.layoutMetrics.push(...desktopStability.samples);



const desktopBeforeRun = desktopStability.samples[0];

const beforeRunPath = path.join(shotDir, '01-before-run.png');

await page.screenshot({ path: beforeRunPath, fullPage: true });

report.interactionSteps.push({

  step: 'S0-load-idle',

  action: 'Initial load',

  pngPath: beforeRunPath,

  layout: evaluateLayoutMetric(desktopBeforeRun, 'before-run', 1280),

  functional: evaluateFunctional(await collectFunctionalSignals(page)),

  timestampUtc: new Date.toISOString,

});



await page.getByTestId('p8-draw-flow').click;

await page.waitForFunction( => window.__p8AgentDrawDemoCanvasLegible === true, null, {

  timeout: 15_000,

});

await page.waitForTimeout(600);

const afterFlowPath = path.join(shotDir, '02-after-draw-flow.png');

await page.screenshot({ path: afterFlowPath, fullPage: true });

report.interactionSteps.push({

  step: 'S1-after-draw-flow',

  action: 'Click Draw flow diagram',

  pngPath: afterFlowPath,

  functional: evaluateFunctional(await collectFunctionalSignals(page)),

  timestampUtc: new Date.toISOString,

});



await page.getByTestId('p8-draw-batch').click;

await page.waitForFunction( => window.__p8AgentDrawDemoCanvasLegible === true, null, {

  timeout: 15_000,

});

await page.waitForTimeout(600);

const afterBatchPath = path.join(shotDir, '03-after-draw-batch.png');

await page.screenshot({ path: afterBatchPath, fullPage: true });

report.interactionSteps.push({

  step: 'S2-after-draw-batch',

  action: 'Click Draw batch',

  pngPath: afterBatchPath,

  functional: evaluateFunctional(await collectFunctionalSignals(page)),

  timestampUtc: new Date.toISOString,

});



await page.getByTestId('p8-clear').click;

await page.waitForTimeout(400);



await page.getByTestId('p8-run-full-demo').click;

await page.waitForFunction(

   => {

    const result = window.__p8AgentDrawDemoResult;

    return result !== undefined && result.agentStampedCount >= 4 && result.ok === true;

  },

  null,

  { timeout: 45_000 });

await page.waitForFunction( => window.__p8AgentDrawDemoCanvasLegible === true, null, {

  timeout: 15_000,

});

await page.waitForTimeout(800);

const afterFullDemoPath = path.join(shotDir, '04-after-full-demo.png');

await page.screenshot({ path: afterFullDemoPath, fullPage: true });

const desktopAfterDemo = await collectLayoutMetric(page, 'desktop-after-full-demo');

report.layoutMetrics.push(desktopAfterDemo);

report.interactionSteps.push({

  step: 'S3-after-full-demo',

  action: 'Click Run full demo',

  pngPath: afterFullDemoPath,

  demoResult: await page.evaluate( => window.__p8AgentDrawDemoResult),

  layout: evaluateLayoutMetric(desktopAfterDemo, 'after-demo', 1280),

  functional: evaluateFunctional(await collectFunctionalSignals(page)),

  timestampUtc: new Date.toISOString,

});



await page.waitForFunction( => window.__p8AgentDrawDemoChatSettled === true, null, {

  timeout: 10_000,

});

await page.waitForTimeout(500);

const chatSettledPath = path.join(shotDir, '05-after-demo-chat-settled.png');

await page.screenshot({ path: chatSettledPath, fullPage: true });

const chatSettledFunctional = evaluateFunctional(await collectFunctionalSignals(page));

report.interactionSteps.push({

  step: 'S4-demo-chat-settled',

  action: 'Demo-complete chat settled',

  pngPath: chatSettledPath,

  functional: {...chatSettledFunctional,

    pass:

      chatSettledFunctional.pass &&

      chatSettledFunctional.chatSettledWhenExpected &&

      chatSettledFunctional.chatNotThinking,

  },

  timestampUtc: new Date.toISOString,

});



const demoResult = await page.evaluate( => window.__p8AgentDrawDemoResult);

const summaryText = await page.getByTestId('p8-provenance-summary').textContent;

const logSnippet = await page.getByTestId('p8-activity-log').textContent;



const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });

const mobilePage = await mobile.newPage;

mobilePage.on('console', (msg) => {

  if (msg.type === 'error') report.consoleErrors.push(`[mobile] ${msg.text}`);

});

mobilePage.on('pageerror', (err) => {

  report.consoleErrors.push(`[mobile] ${err.message}`);

});



await mobilePage.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });

await mobilePage.getByTestId('p8-run-full-demo').waitFor({ state: 'visible', timeout: 45_000 });

await mobilePage.waitForFunction( => window.__galleryReady?.ok === true, null, {

  timeout: 45_000,

});



const mobileStability = await measureIdleStability(mobilePage, 'mobile-before-run');

report.layoutStability.push({ viewport: 'mobile',...mobileStability });

report.layoutMetrics.push(...mobileStability.samples);



const mobileBeforeRun = mobileStability.samples[0];

const mobileBeforePath = path.join(shotDir, 'm01-mobile-before-run.png');

await mobilePage.screenshot({ path: mobileBeforePath, fullPage: true });

report.interactionSteps.push({

  step: 'M0-mobile-load',

  action: 'Mobile initial load',

  pngPath: mobileBeforePath,

  layout: evaluateLayoutMetric(mobileBeforeRun, 'before-run', 390),

  timestampUtc: new Date.toISOString,

});



await mobilePage.getByTestId('p8-run-full-demo').click;

await mobilePage.waitForFunction(

   => {

    const result = window.__p8AgentDrawDemoResult;

    return result !== undefined && result.ok === true && result.agentStampedCount > 0;

  },

  null,

  { timeout: 45_000 });

await mobilePage.waitForFunction( => window.__p8AgentDrawDemoChatSettled === true, null, {

  timeout: 15_000,

});

await mobilePage.waitForFunction( => window.__p8AgentDrawDemoCanvasLegible === true, null, {

  timeout: 20_000,

}).catch( => undefined);

await mobilePage.waitForTimeout(600);

const mobileAfterPath = path.join(shotDir, 'm02-mobile-after-full-demo.png');

await mobilePage.screenshot({ path: mobileAfterPath, fullPage: true });

const mobileAfterDemo = await collectLayoutMetric(mobilePage, 'mobile-after-full-demo');

report.layoutMetrics.push(mobileAfterDemo);

const mobileDemoResult = await mobilePage.evaluate( => window.__p8AgentDrawDemoResult);

report.interactionSteps.push({

  step: 'M1-mobile-after-full-demo',

  action: 'Mobile Run full demo',

  pngPath: mobileAfterPath,

  demoResult: mobileDemoResult,

  layout: evaluateLayoutMetric(mobileAfterDemo, 'after-demo', 390),

  functional: evaluateFunctional(await collectFunctionalSignals(mobilePage)),

  timestampUtc: new Date.toISOString,

});

await mobile.close;



const filteredErrors = report.consoleErrors.filter(

  (line) =>

    !line.includes('favicon.ico') &&

    !line.includes('Failed to load resource') &&

    !line.includes('net::ERR') &&

    !line.includes('Lit is in dev mode'));



const desktopBeforeEval = evaluateLayoutMetric(desktopBeforeRun, 'before-run', 1280);

const mobileBeforeEval = evaluateLayoutMetric(mobileBeforeRun, 'before-run', 390);

const desktopAfterEval = evaluateLayoutMetric(desktopAfterDemo, 'after-demo', 1280);

const mobileAfterEval = evaluateLayoutMetric(mobileAfterDemo, 'after-demo', 390);



report.layoutChecks = {

  desktopBeforeRunRatio: desktopBeforeRun.ratio,

  mobileBeforeRunRatio: mobileBeforeRun.ratio,

  desktopAfterDemoRatio: desktopAfterDemo.ratio,

  mobileAfterDemoRatio: mobileAfterDemo.ratio,

  desktopStabilityDelta: desktopStability.delta,

  mobileStabilityDelta: mobileStability.delta,

  desktopBeforeRunCanvasVisible: desktopBeforeRun.canvasVisibleInViewport,

  mobileBeforeRunCanvasVisible: mobileBeforeRun.canvasVisibleInViewport,

  desktopBeforeRunCanvasBounded: canvasBoundedAtBeforeRun(desktopBeforeRun, 1280),

  mobileBeforeRunCanvasBounded: canvasBoundedAtBeforeRun(mobileBeforeRun, 390),

};



report.layoutPass =

  desktopBeforeEval.pass &&

  mobileBeforeEval.pass &&

  desktopAfterEval.pass &&

  mobileAfterEval.pass &&

  desktopStability.stable &&

  mobileStability.stable;



const s1 = report.interactionSteps.find((s) => s.step === 'S1-after-draw-flow');

const s2 = report.interactionSteps.find((s) => s.step === 'S2-after-draw-batch');

const s3 = report.interactionSteps.find((s) => s.step === 'S3-after-full-demo');

const s4 = report.interactionSteps.find((s) => s.step === 'S4-demo-chat-settled');

const m1 = report.interactionSteps.find((s) => s.step === 'M1-mobile-after-full-demo');



report.functionalPass =

  s1?.functional?.canvasLegible === true &&

  s2?.functional?.canvasLegible === true &&

  s3?.functional?.pass === true &&

  s4?.functional?.pass === true &&

  m1?.functional?.pass === true;



report.filteredErrors = filteredErrors;

report.pass =

  demoResult?.ok === true &&

  (demoResult?.agentStampedCount ?? 0) >= 4 &&

  (summaryText?.includes('northstar-designer') ?? false) &&

  (logSnippet?.includes('read_canvas') ?? false) &&

  (logSnippet?.includes('draw_shapes') ?? false) &&

  (mobileDemoResult?.ok === true) &&

  filteredErrors.length === 0 &&

  report.layoutPass &&

  report.functionalPass;



fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

fs.writeFileSync(

  consolePath,

  [

    `# console capture — p8-agent-draw-demo GATE 7 `,

    `timestamp: ${report.timestampUtc}`,

    `raw_errors: ${report.consoleErrors.length}`,

    `filtered_errors: ${filteredErrors.length}`,

    `layoutPass: ${report.layoutPass}`,

    `functionalPass: ${report.functionalPass}`,

    `pass: ${report.pass}`,

    '',...report.consoleErrors.map((e) => `ERROR: ${e}`),

  ].join('\n'));



console.log(

  JSON.stringify(

    {

      pass: report.pass,

      layoutPass: report.layoutPass,

      functionalPass: report.functionalPass,

      desktopBeforeRunRatio: desktopBeforeRun.ratio,

      reportPath,

      shotDir,

    },

    null,

    2));

await browser.close;

process.exit(report.pass ? 0: 1);

