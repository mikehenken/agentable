import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1: 0,
  use: {
    baseURL: 'http://127.0.0.1:5199',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node scripts/e2e-embed-server.mjs',
    url: 'http://127.0.0.1:5199/examples/02-job-board-inline/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
