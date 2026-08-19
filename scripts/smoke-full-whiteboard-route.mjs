/**
 * Smoke: full whiteboard route still loads after homepage embed changes.
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:5173/career-canvas-whiteboard';

async function main {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  const bodyText = await page.evaluate(() => document.body.innerText);
  const ok =
    /sandy|career concierge/i.test(bodyText) &&
    !/application error|failed to load/i.test(bodyText);
  console.log(JSON.stringify({ url: URL, ok, hasSandy: /sandy/i.test(bodyText) }, null, 2));
  await browser.close;
  process.exit(ok ? 0: 1);
}

main.catch((e) => {
  console.error(e);
  process.exit(2);
});
