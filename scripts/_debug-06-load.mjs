import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
page.on('console', (m) => console.log('CONSOLE', m.type, m.text));
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:5199/examples/06-react-host-deep/index.html?v=debug', {
  waitUntil: 'networkidle',
  timeout: 60000,
});
await page.waitForTimeout(5000);
const state = await page.evaluate( => {
  const panel = document.querySelector('agentable-panel');
  const list = panel?.shadowRoot?.querySelector('agentable-virtual-list');
  return {
    galleryReady: window.__galleryReady,
    panel: Boolean(panel),
    panelTheme: panel?.getAttribute('data-theme') ?? null,
    h1: document.querySelector('h1')?.textContent ?? null,
    readyDetail: document.querySelector('[data-testid="panel-ready-detail"]')?.textContent ?? null,
    listItems: list?.items?.length ?? null,
    shadowSnippet: (list?.shadowRoot?.textContent ?? panel?.shadowRoot?.textContent ?? '').slice(0, 300),
  };
});
console.log(JSON.stringify(state, null, 2));
await browser.close;
