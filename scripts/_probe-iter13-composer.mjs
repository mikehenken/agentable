import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html', {
  waitUntil: 'networkidle',
});
await page.waitForFunction(() => window.__galleryReady?.ok === true, { timeout: 60_000 });

const diag = await page.evaluate(() => {
  const placement = document.querySelector(
    'agentable-operator-surface-placement[placement-id="operator-main"]');
  const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
  const inner = surface?.shadowRoot;
  return {
    surfaceHtml: inner?.innerHTML?.slice(0, 500) ?? null,
    partNames: inner ? [...inner.querySelectorAll('[part]')].map((el) => el.getAttribute('part')): [],
    mode: surface?.mode,
    activeThreadId: surface?.activeThreadId,
    threadCount: surface?.threads?.length ?? 0,
  };
});

console.log(JSON.stringify(diag, null, 2));
await browser.close;
