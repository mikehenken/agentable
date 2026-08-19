import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5199/examples/12-open-agent-canvas/index.html';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__galleryReady?.ok === true, null, { timeout: 60_000 });
await page.waitForTimeout(2000);

const probe = await page.evaluate(() => {
  const wb = document.querySelector('agentable-whiteboard');
  const shadow = wb?.shadowRoot;
  const text = shadow?.textContent ?? '';
  return {
    hasBriefTitle: text.includes('Atlas onboarding brief'),
    hasProductBriefButton: text.includes('Product brief'),
    textSample: text.slice(0, 800),
  };
});

const clickResult = await page.evaluate(() => {
  const wb = document.querySelector('agentable-whiteboard');
  const shadow = wb?.shadowRoot;
  if (!shadow) return { clicked: false, reason: 'no shadow' };
  const clickables = [...shadow.querySelectorAll('button, [role="button"], a, [tabindex]')];
  const briefBtn = clickables.find((el) => (el.textContent ?? '').includes('Product brief'));
  if (briefBtn instanceof HTMLElement) {
    briefBtn.click;
    return { clicked: true, label: briefBtn.textContent?.trim() };
  }
  return {
    clicked: false,
    reason: 'no Product brief button',
    labels: clickables.slice(0, 15).map((b) => b.textContent?.trim()).filter(Boolean),
  };
});

await page.waitForTimeout(3000);

const afterClick = await page.evaluate(() => {
  const wb = document.querySelector('agentable-whiteboard');
  const shadow = wb?.shadowRoot;
  const text = shadow?.textContent ?? '';
  return {
    hasBriefTitle: text.includes('Atlas onboarding brief'),
    hasMeridianBrief: text.includes('Meridian Labs'),
    blockHints: {
      heading: /onboarding brief/i.test(text),
      paragraph: text.length > 500,
      list: /\d+\.|bullet|step/i.test(text),
      callout: /callout|note:|important/i.test(text),
    },
    visiblePanelTitles: [...(shadow?.querySelectorAll('h1,h2,h3,h4,[data-testid]') ?? [])].map((el) => el.textContent?.trim()).filter(Boolean).slice(0, 20),
  };
});

console.log(JSON.stringify({ probe, clickResult, afterClick }, null, 2));
await browser.close;
