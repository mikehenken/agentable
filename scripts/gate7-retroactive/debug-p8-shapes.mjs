/** One-off debug: dump tldraw shape bounds after draw flow. */
import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5199/examples/p8-agent-draw-demo/index.html';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction( => window.__galleryReady?.ok === true, { timeout: 30000 });
await page.click('[data-testid=p8-draw-flow]');
await page.waitForFunction( => window.__p8AgentDrawDemoCanvasLegible === true, null, {
  timeout: 20_000,
}).catch( => undefined);
await page.waitForTimeout(500);

const info = await page.evaluate( => ({
  legible: window.__p8AgentDrawDemoCanvasLegible,
  legibility: window.__p8AgentDrawDemoLegibility,
  dump: window.__p8AgentDrawDemoShapeDump,
}));

console.log(JSON.stringify(info, null, 2));
await browser.close;
