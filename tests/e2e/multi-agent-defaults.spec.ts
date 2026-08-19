import { test, expect } from '@playwright/test';

test.describe(' multi-agent defaults ', () => {
  test('two agents, attribution, and scope refusal in browser harness', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type === 'error') {
        consoleErrors.push(message.text);
      }
    });
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    await page.goto('/harness/multi-agent.html');
    await page.waitForFunction(() => window.__multiAgentE2eResult !== undefined);

    const result = await page.evaluate(() => window.__multiAgentE2eResult);
    expect(result?.ok, JSON.stringify(result?.checks, null, 2)).toBe(true);

    const checkNames = (result?.checks ?? []).map((check) => check.name);
    expect(checkNames).toContain('two agents open different panels');
    expect(checkNames).toContain('HITL card attributed to acting agent');
    expect(checkNames).toContain('out-of-scope tool call refused');

    const filteredErrors = consoleErrors.filter(
      (line) => !line.includes('Lit is in dev mode'));
    expect(filteredErrors, `console errors: ${filteredErrors.join('\n')}`).toEqual([]);
  });
});

declare global {
  interface Window {
    __multiAgentE2eResult?: {
      ok: boolean;
      checks: Array<{ name: string; ok: boolean; detail?: string }>;
    };
  }
}
