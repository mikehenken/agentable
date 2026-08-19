import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.route('**/gallery-demo.mjs', (route) => route.abort);
await page.goto('http://127.0.0.1:5199/examples/12-open-agent-canvas/index.html?v=probe-iter4', {
  waitUntil: 'domcontentloaded',
});
await page.waitForFunction(() => {
  const board = document.querySelector('agentable-whiteboard');
  return Boolean(board?.shadowRoot?.querySelector('canvas'));
});

const promise = page.evaluate(async () => {
  const board = document.querySelector('agentable-whiteboard');
  await board.whenReady(45_000);
  return board.runMeridianDemo('document');
});

for (let i = 0; i < 50; i += 1) {
  await page.waitForTimeout(200);
  const metrics = await page.evaluate(() => {
    const wb = document.querySelector('agentable-whiteboard');
    const sr = wb?.shadowRoot;
    const board = wb;
    let shapeSummary = null;
    if (board && typeof board.runMeridianDemo === 'function') {
       no editor access from outside; inspect tldraw store via DOM
    }
    const testIds = sr
      ? [...sr.querySelectorAll('[data-testid]')].map((el) => ({
          id: el.getAttribute('data-testid'),
          h: el.offsetHeight,
          w: el.offsetWidth,
          sample: (el.textContent ?? '').trim().slice(0, 80),
        })): [];
    const panelShapes = sr
      ? [...sr.querySelectorAll('[data-testid^="panel-shape-"]')].map((el) =>
          el.getAttribute('data-testid')): [];
    const bodyTestIds = [...document.querySelectorAll('[data-testid]')].map((el) =>
      el.getAttribute('data-testid'));
    return {
      phase: window.__galleryDemoPhase,
      docResult: window.__meridianDocumentResult,
      testIds,
      panelShapes,
      bodyPanelShapes: bodyTestIds.filter((id) => id?.startsWith('panel-shape-')),
      shadowTextHasBrief: (sr?.textContent ?? '').includes('Meridian Labs Product Brief'),
    };
  });

  const found = metrics.testIds.some((entry) => entry.id === 'meridian-document-panel');
  if (found || metrics.testIds.some((entry) => entry.id === 'meridian-document-panel-error')) {
    console.log(JSON.stringify({ iter: i, metrics }, null, 2));
    break;
  }
  if (i === 49) {
    console.log(JSON.stringify({ iter: i, metrics }, null, 2));
  }
}

const result = await promise;
console.log('result', JSON.stringify(result, null, 2));
await browser.close;
