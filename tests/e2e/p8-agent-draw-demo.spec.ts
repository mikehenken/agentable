import { test, expect } from '@playwright/test';
import { attachConsoleGuard, filterConsoleErrors } from './helpers/galleryHelpers';

declare global {
  interface Window {
    __p8AgentDrawDemoResult?: {
      ok: boolean;
      agentStampedCount: number;
      totalShapes: number;
      agentIds: string[];
    };
  }
}

test.describe('@demo P8 agent draw & see', () => {
  test('runs scripted draw + read and reports agent provenance', async ({ page }) => {
    const consoleErrors = attachConsoleGuard(page);

    await page.goto('/examples/p8-agent-draw-demo/index.html');

    await page.getByTestId('p8-run-full-demo').waitFor({ state: 'visible', timeout: 45_000 });

    await page.getByTestId('p8-run-full-demo').click();

    await page.waitForFunction(() => {
        const result = window.__p8AgentDrawDemoResult;
        return result !== undefined && result.agentStampedCount > 0;
      },
      undefined,
      { timeout: 30_000 });

    const summary = page.getByTestId('p8-provenance-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('northstar-designer');

    const log = page.getByTestId('p8-activity-log');
    await expect(log).toContainText('read_canvas');
    await expect(log).toContainText('draw_shapes');

    expect(filterConsoleErrors(consoleErrors)).toEqual([]);
  });
});
