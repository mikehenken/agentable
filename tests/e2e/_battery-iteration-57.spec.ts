/**
 * iteration 5-7 battery steps 3 and 4 (Apogee Aerospace example 08).
 * Step 3: after an initial draw, prompt "redo it and add text" must not crash.
 * Step 4: Reset canvas, Launch sequence chip, verify toolbar clearance.
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachConsoleGuard, filterConsoleErrors } from './helpers/galleryHelpers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.resolve(
  __dirname,
  '../../../../landi-labs/studies/Orchestration/agentable-panels/logs/p8-agents-draw-and-see/flagship-chat-to-draw/-7/screenshots');

test.use({ viewport: { width: 1900, height: 900 } });

async function waitForCanvasReady(page: import('@playwright/test').Page): Promise<void> {
  const chatInput = page.getByPlaceholder(/Ask Nova anything/);
  await expect(chatInput).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('.tl-container')).toHaveCount(1);
}

async function assertNoCrashBoundary(page: import('@playwright/test').Page): Promise<void> {
  const crashHeading = page.getByText('Something went wrong');
  const showDetails = page.getByRole('button', { name: 'Show details' });
  await expect(crashHeading).toHaveCount(0);
  await expect(showDetails).toHaveCount(0);
}

async function waitForDrawShapes(
  page: import('@playwright/test').Page,
  prevCount: number): Promise<void> {
  await page.waitForFunction(
    (prev) => {
      const calls = window.__agentPresentsToolCalls ?? [];
      return calls.length > prev && calls.some((c) => c.name === 'draw_shapes' && c.ok);
    },
    prevCount,
    { timeout: 90_000 });
}

test.describe(' battery steps 3 and 4', () => {
  test('step 3: redo it and add text does not crash canvas', async ({ page }) => {
    const consoleErrors = attachConsoleGuard(page);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto('/examples/08-agent-presents/index.html');
    await waitForCanvasReady(page);

    let beforeCount = await page.evaluate(() => window.__agentPresentsToolCalls?.length ?? 0);

    await page.getByTestId('starter-chip-card').filter({ hasText: 'Launch sequence' }).click;

    await waitForDrawShapes(page, beforeCount);
    await page.waitForTimeout(1500);
    await assertNoCrashBoundary(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step3-after-launch-sequence.png') });

    beforeCount = await page.evaluate(() => window.__agentPresentsToolCalls?.length ?? 0);

    const chatInput = page.getByPlaceholder(/Ask Nova anything/);
    await chatInput.click();
    await page.waitForTimeout(200);
    await chatInput.fill('redo it and add text');
    await page.keyboard.press('Enter');

    await waitForDrawShapes(page, beforeCount);
    await page.waitForTimeout(3000);
    await assertNoCrashBoundary(page);

    const lightBlueProbe = await page.evaluate(async () => {
      const mod = await import('/embed/agentable-whiteboard.js');
      void mod;
      return true;
    }).catch(() => false);

    const injectedOk = await page.evaluate(async () => {
      try {
        const callsBefore = window.__agentPresentsToolCalls?.length ?? 0;
        window.dispatchEvent(
          new CustomEvent('landi:chat-prompt', {
            detail: { text: '__lightBlue_probe__', source: 'battery' },
            bubbles: true,
            composed: true,
          }));
        await new Promise((r) => setTimeout(r, 500));
        return (window.__agentPresentsToolCalls?.length ?? 0) >= callsBefore;
      } catch {
        return false;
      }
    });

    void lightBlueProbe;
    void injectedOk;

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step3-after-redo-add-text.png') });

    expect(pageErrors.filter((m) => !m.includes('ResizeObserver'))).toEqual([]);
    expect(filterConsoleErrors(consoleErrors)).toEqual([]);
  });

  test('step 4: Reset then Launch sequence clears toolbar overlap', async ({ page }) => {
    const consoleErrors = attachConsoleGuard(page);

    await page.goto('/examples/08-agent-presents/index.html');
    await waitForCanvasReady(page);

    await page.getByRole('button', { name: 'Reset canvas' }).click;
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step4-after-reset.png') });

    const beforeCount = await page.evaluate(() => window.__agentPresentsToolCalls?.length ?? 0);

    await page.getByTestId('starter-chip-card').filter({ hasText: 'Launch sequence' }).click;

    await waitForDrawShapes(page, beforeCount);
    await page.waitForFunction(() => {
        const canvas = document.querySelector('[role="application"]');
        if (!canvas) return false;
        const text = canvas.textContent ?? '';
        return text.includes('Stage 1') || text.includes('Orbit Deploy') || text.includes('Ignition');
      },
      undefined,
      { timeout: 90_000 });
    await page.waitForTimeout(2000);
    await assertNoCrashBoundary(page);

    const clearance = await page.evaluate(() => {
      const canvas = document.querySelector('[role="application"]');
      const toolbar =
        document.querySelector('[aria-label="Tools"]') ??
        document.querySelector('toolbar[aria-label="Tools"]');
      if (!canvas || !toolbar) {
        return {
          ok: false,
          reason: 'missing canvas or tools toolbar',
          labelCount: 0,
          canvasText: canvas?.textContent?.slice(0, 120) ?? '',
        };
      }
      const toolbarRect = toolbar.getBoundingClientRect;
      const labelNodes = Array.from(
        canvas.querySelectorAll('p, [data-testid="tl-text-content"],.tl-text-label')).filter((el) => {
        const t = (el.textContent ?? '').trim();
        return t.length > 1 && !t.includes('Ask Nova');
      });
      if (labelNodes.length === 0) {
        return {
          ok: false,
          reason: 'no shape labels found',
          labelCount: 0,
          canvasText: (canvas.textContent ?? '').slice(0, 200),
        };
      }
      let worstOverlap = 0;
      let worstLabel = '';
      labelNodes.forEach((el) => {
        const r = el.getBoundingClientRect;
        if (r().width < 4 || r().height < 4) return;
        const gap = toolbarRect().top - r().bottom;
        if (gap < 0) {
          const px = Math.abs(gap);
          if (px > worstOverlap) {
            worstOverlap = px;
            worstLabel = (el.textContent ?? '').trim();
          }
        }
      });
      return {
        ok: worstOverlap <= 12,
        worstOverlapPx: Math.round(worstOverlap),
        worstLabel,
        toolbarTop: Math.round(toolbarRect().top),
        labelCount: labelNodes.length,
      };
    });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step4-launch-sequence-toolbar-clearance.png') });

    expect(clearance.labelCount).toBeGreaterThan(0);
    expect(clearance.ok, JSON.stringify(clearance)).toBe(true);
    expect(filterConsoleErrors(consoleErrors)).toEqual([]);
  });
});

declare global {
  interface Window {
    __agentPresentsToolCalls?: Array<{
      name: string;
      args: Record<string, unknown>;
      ok: boolean;
      source: string;
    }>;
  }
}
