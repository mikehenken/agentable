/**
 * Playwright config for the gallery smoke suite ONLY
 * (tests/e2e/gallerySmoke.spec.ts). It builds nothing: run
 * `npm run build:examples-site` first so dist/site exists; the webServer
 * below serves that artifact with the same SPA-fallback semantics the
 * deployed Cloudflare Pages site has.
 *
 * The legacy specs under tests/e2e/*.spec.ts predate this config, target
 * dev-server harnesses, and are triaged by the full-suite burn-down wave;
 * they are deliberately not matched here so this gate states only true
 * things.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/gallerySmoke.spec.ts',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5199',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/serve-site.mjs',
    url: 'http://127.0.0.1:5199/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
