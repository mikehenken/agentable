import { chromium } from 'playwright';

function collectShadowTexts(root, out = []) {
  if (root === null || root === undefined) return out;
  if (root instanceof ShadowRoot || root instanceof Document || root instanceof Element) {
    if (root instanceof Element && (root.textContent ?? '').includes('Chat')) {
      out.push({
        tag: root.tagName,
        testid: root.getAttribute?.('data-testid'),
        text: (root.textContent ?? '').slice(0, 120),
      });
    }
    const nodes =
      root instanceof Document
        ? [root.documentElement]: root instanceof ShadowRoot
          ? [...root.children]: [...(root.shadowRoot ? [root.shadowRoot]: []),...root.children];
    for (const node of nodes) {
      if (node instanceof Element) collectShadowTexts(node, out);
    }
  }
  return out;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.route('**/gallery-demo.mjs', (route) => route.abort);
await page.goto('http://127.0.0.1:5199/examples/12-open-agent-canvas/index.html?v=probe2', {
  waitUntil: 'domcontentloaded',
});
await page.waitForFunction(() => document.querySelector('agentable-whiteboard')?.shadowRoot?.querySelector('canvas'));

await page.evaluate(async () => {
  const board = document.querySelector('agentable-whiteboard');
  await board.whenReady(45_000);
  await board.runMeridianDemo('wireframe');
  await board.runMeridianDemo('document');
});

const dump = await page.evaluate(() => {
  const wb = document.querySelector('agentable-whiteboard');
  const sr = wb?.shadowRoot;
  const all = [];
  function walk(node) {
    if (!(node instanceof Element)) return;
    const tid = node.getAttribute('data-testid');
    if (tid) {
      all.push({ tid, h: node.offsetHeight, w: node.offsetWidth, text: (node.textContent ?? '').trim().slice(0, 100) });
    }
    if (node.shadowRoot) walk(node.shadowRoot);
    for (const child of node.children) walk(child);
  }
  walk(document.documentElement);
  return {
    phase: window.__galleryDemoPhase,
    doc: window.__meridianDocumentResult,
    testids: all.filter((x) =>
      x.tid.includes('panel') ||
      x.tid.includes('meridian') ||
      x.tid.includes('approval') ||
      x.tid.includes('document') ||
      x.tid.includes('spec-renderer')),
    hasChatText: (sr?.textContent ?? '').includes('Ask Atlas'),
    hasBrief: (document.documentElement.textContent ?? '').includes('Meridian Labs Product Brief'),
  };
});

console.log(JSON.stringify(dump, null, 2));
await browser.close;
