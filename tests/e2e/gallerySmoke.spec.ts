/**
 * Gallery smoke suite: every page shipped to the deployed examples site must
 * load, render its key surface, keep the console clean, and (on
 * tldraw-bearing pages) survive past tldraw's ~5s unlicensed-production
 * blank-out window without showing the license-expired placeholder.
 *
 * Run against the assembled artifact: `npm run build:examples-site`, then
 * `npm run test:smoke`. The server (scripts/serve-site.mjs) reproduces the
 * Cloudflare Pages SPA fallback, so config-probe regressions show up here
 * before they ship.
 *
 * ALLOWED_CONSOLE_ERRORS is shrink-only: each entry names the defect, the
 * fix wave, and matches as narrowly as possible. Adding an entry requires an
 * explicit owner decision.
 */
import { test, expect, type Page } from '@playwright/test';

interface PageSpec {
  slug: string;
  /** CSS selector expected visible after settle. */
  selector?: string;
  /** Literal text expected somewhere on the page after settle. */
  text?: string;
  /** tldraw-bearing pages get the license blank-out assertion. */
  tldraw?: boolean;
}

const PAGES: PageSpec[] = [
  { slug: '01-career-homepage', selector: 'agentable-canvas', tldraw: true },
  { slug: '02-job-board-inline', selector: 'agentable-panel' },
  { slug: '03-multi-surface-dashboard', text: 'Operations dashboard' },
  { slug: '04-zero-js-marketing', selector: 'agentable-whiteboard', tldraw: true },
  { slug: '05-bounded-demo-kiosk', selector: 'agentable-canvas', tldraw: true },
  { slug: '06-react-host-deep', text: 'Gallery telemetry' },
  { slug: '07-iframe-cms', text: 'Careers block' },
  { slug: '08-agent-presents', selector: 'agentable-whiteboard', tldraw: true },
  { slug: '09-multi-agent-page', text: 'Multi-agent defaults' },
  { slug: '10-locale-rtl', selector: 'agentable-panel' },
  { slug: '11-app-shell', selector: 'agentable-app-shell' },
  { slug: '12-open-agent-canvas', selector: 'agentable-whiteboard', tldraw: true },
  { slug: '13-canvas-wide-agent', selector: 'agentable-operator-surface-placement', tldraw: true },
  { slug: 'p8-agent-draw-demo', selector: 'agentable-whiteboard', tldraw: true },
  { slug: 'support-inbox-quickstart', selector: 'agentable-panel' },
];

/** Shrink-only. Each entry: narrow matcher + defect + fix pointer. */
const ALLOWED_CONSOLE_ERRORS: Array<{ pattern: RegExp; reason: string }> = [
  {
    // Example 09 harness data-shape break (agents.registry.list is no longer
    // an array). Fails the demo on the live gallery too; fixed with the P6
    // cluster in the full-suite burn-down wave.
    pattern: /agents\.registry\.list\.map is not a function/,
    reason: 'P6 multi-agent registry shape regression, burn-down wave',
  },
];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
    // G3 runtime guard: the voice kernel logs apiKeyPresent at mount. A
    // bundle answering true has a provider key baked into it (the build
    // machine's .env.local leaked into the artifact); that must never ship.
    if (message.text().includes('apiKeyPresent: true')) {
      errors.push(`G3 violation: a provider key is baked into a bundle (${message.text().slice(0, 80)})`);
    }
  });
  page.on('pageerror', (error) => {
    errors.push(String(error));
  });
  return errors;
}

function unexpected(errors: string[]): string[] {
  return errors.filter((e) => !ALLOWED_CONSOLE_ERRORS.some(({ pattern }) => pattern.test(e)));
}

test('gallery index lists the shipped examples', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/index.html');
  await expect(page.locator('li a')).not.toHaveCount(0);
  expect(await page.locator('li a').count()).toBeGreaterThanOrEqual(13);
  expect(unexpected(errors)).toEqual([]);
});

for (const spec of PAGES) {
  test(`example ${spec.slug} loads clean`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`/examples/${spec.slug}/index.html`);

    if (spec.selector) {
      await expect(page.locator(spec.selector).first()).toBeVisible({ timeout: 20_000 });
    }
    if (spec.text) {
      await expect(page.getByText(spec.text).first()).toBeVisible({ timeout: 20_000 });
    }

    // tldraw classifies non-localhost https origins as unlicensed production
    // and blanks the editor ~5s after mount; localhost is exempt, so the real
    // guard is the license-key plumbing test plus this placeholder check.
    // Wait past the window regardless so late console errors surface too.
    await page.waitForTimeout(7_000);
    if (spec.tldraw) {
      await expect(page.locator('[data-testid="tl-license-expired"]')).toHaveCount(0);
    }

    // Layout sanity: a broken page grid (e.g. `grid-column: 1 / -1` losing
    // its slash in example 03) overflows the document horizontally and shows
    // up to the user as page-level scrollbars. Small tolerance for
    // scrollbar-width rounding across platforms.
    const overflowPx = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    expect(overflowPx, `horizontal document overflow on ${spec.slug}`).toBeLessThanOrEqual(20);

    expect(unexpected(errors), `console errors on ${spec.slug}`).toEqual([]);
  });
}
