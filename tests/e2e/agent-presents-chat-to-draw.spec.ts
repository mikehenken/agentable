/**
 * 08 - agent presents (Apogee Aerospace): flagship chat-to-draw offline path.
 *
 * Regression coverage for review findings:
 * - React error #185 (max update depth) at mount, root-caused to
 * PanelApprovalLayer's uncached useSyncExternalStore snapshot. The chat
 * input actually rendering (not the panel error boundary) is the guard.
 * - The chat-to-draw pipeline draws shapes end to end via the embed's
 * public surface (a starter-chip click), with no live endpoint
 * configured, so this exercises the deterministic offline fallback.
 * - No "multiple instances of some tldraw libraries" warning: this page
 * loads only /embed/agentable-whiteboard.js, never a second script that
 * imports engine code.
 *
 * Run against a build with no live Gemini credential so the offline path is
 * deterministic:
 * VITE_GEMINI_API_KEY= VITE_LANDI_CHAT_PROXY_URL= npm run build:embed:whiteboard
 * npm run test:e2e -- tests/e2e/agent-presents-chat-to-draw.spec.ts
 */
import { test, expect } from '@playwright/test';
import { attachConsoleGuard, filterConsoleErrors } from './helpers/galleryHelpers';

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

test.describe('@demo 08 agent presents - chat-to-draw (offline path)', () => {
  test('mounts a real canvas, renders the chat input, draws shapes from a starter prompt, and logs no duplicate-tldraw warning', async ({
    page,
  }) => {
    const consoleErrors = attachConsoleGuard(page);
    const allConsoleText: string[] = [];
    page.on('console', (message) => {
      allConsoleText.push(message.text());
    });

    await page.goto('/examples/08-agent-presents/index.html');

    // --- React #185 regression guard ---
    // Before the fix, PanelApprovalLayer's uncached useSyncExternalStore
    // snapshot threw "Maximum update depth exceeded" during mount, the chat
    // panel crashed into its panel error boundary, and neither the input
    // nor the starter chips ever rendered. Asserting these are visible is
    // the guard against that regression.
    const chatInput = page.getByPlaceholder(/Ask Nova anything/);
    await expect(chatInput).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText("Hi, I'm Nova.")).toBeVisible();

    // Canvas actually mounted - data-skip-react-mount was removed.
    await expect(page.locator('.tl-container')).toHaveCount(1);

    // --- Offline mode ---
    // This spec is meant to run against a build with no live Gemini
    // credential (see the header comment), so chat is unconfigured and the
    // deterministic draw fallback should be the one that fires.
    const beforeCount = await page.evaluate(() => window.__agentPresentsToolCalls?.length ?? 0);

    await page.getByTestId('starter-chip-card').filter({ hasText: 'Launch sequence' }).click();

    await expect(page.getByText(/Offline demo mode/i)).toBeVisible({ timeout: 20_000 });

    await page.waitForFunction(
      (prevCount) => {
        const calls = window.__agentPresentsToolCalls ?? [];
        return calls.length > prevCount && calls.some((c) => c.name === 'draw_shapes' && c.ok);
      },
      beforeCount,
      { timeout: 20_000 });

    const toolCalls = await page.evaluate(() => window.__agentPresentsToolCalls ?? []);
    const drawCalls = toolCalls.filter((c) => c.name === 'draw_shapes');
    expect(drawCalls.length).toBeGreaterThan(0);
    expect(drawCalls.every((c) => c.ok)).toBe(true);
    expect(toolCalls.some((c) => c.name === 'clear_agent_drawings' && c.ok)).toBe(true);

    // --- Drawing-quality regression guard ---
    // The owner's review of an earlier draft found a rigid, basic-looking
    // result: fixed-size boxes overflowing their labels, shapes crowding
    // each other, no freehand pen strokes. Assert on the actual shapes
    // array passed to draw_shapes (available straight from the tool-call
    // args this page already records) rather than tldraw's internal DOM,
    // so this does not depend on tldraw's rendering internals.
    const drawnShapes = drawCalls.flatMap((call) => {
      const shapes = call.args.shapes;
      return Array.isArray(shapes) ? (shapes as Array<Record<string, unknown>>) : [];
    });

    const freehandShapes = drawnShapes.filter((shape) => shape.kind === 'freehand');
    expect(freehandShapes.length).toBeGreaterThanOrEqual(2);

    const geoShapes = drawnShapes.filter(
      (shape) => shape.kind === 'box' || shape.kind === 'ellipse');
    expect(geoShapes.length).toBeGreaterThan(0);
    for (const shape of geoShapes) {
      const geometry = shape.geometry as { kind?: string; w?: number; h?: number } | undefined;
      expect(geometry?.kind).toBe('rect');
      // The regression this guards against: every node box used to be a
      // fixed 120x80 regardless of label length, so text like "Regional
      // Director" or "Stage 2 Separation" overflowed below the box.
      expect(geometry?.w ?? 0).toBeGreaterThanOrEqual(180);
      expect(geometry?.h ?? 0).toBeGreaterThanOrEqual(80);
    }
    // Mixes ellipse (start/terminal) and box (process step) semantically,
    // not one shape kind for every node.
    expect(new Set(geoShapes.map((shape) => shape.kind)).size).toBe(2);

    // --- No duplicate-tldraw warning ---
    // This is the exact failure mode a second script importing engine code
    // (e.g. a gallery harness bundle) would cause; this page loads only the
    // whiteboard embed script, so it must never appear.
    expect(
      allConsoleText.some((text) => text.includes('multiple instances of some tldraw libraries'))).toBe(false);

    expect(filterConsoleErrors(consoleErrors)).toEqual([]);
  });

  test('typing tldraw tool-shortcut letters into the chat input types text and submits (shadow-DOM keyboard isolation)', async ({
    page,
  }) => {
    const consoleErrors = attachConsoleGuard(page);
    await page.goto('/examples/08-agent-presents/index.html');

    const chatInput = page.getByPlaceholder(/Ask Nova anything/);
    await expect(chatInput).toBeVisible({ timeout: 45_000 });

    const beforeCount = await page.evaluate(() => window.__agentPresentsToolCalls?.length ?? 0);

    // Focus the input, then type a phrase loaded with single-key tldraw tool
    // shortcuts: d (draw), r (rectangle), a (arrow), v (select), e (eraser),
    // s, h (hand), t (text). Before the fix, tldraw's container-level shortcut
    // handler (whose activeElement check is defeated by the shadow-DOM host)
    // swallowed these and switched tools, so the letters never reached the
    // textarea and pressing "d" flipped the canvas to the draw tool.
    await chatInput.click();
    // Let the focus-driven editor blur detach tldraw's keyboard listener. A
    // human's click-then-type gap covers this; near-instant synthetic typing
    // can otherwise race the listener teardown.
    await page.waitForTimeout(200);
    const phrase = 'draw the avionics vents, then separate stage';
    await page.keyboard.type(phrase);
    await expect(chatInput).toHaveValue(phrase);

    // Enter submits (the textarea's own handler still runs; only tldraw's
    // shortcut listener was suppressed), which fires the offline draw.
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      (prev) => {
        const calls = window.__agentPresentsToolCalls ?? [];
        return calls.length > prev && calls.some((c) => c.name === 'draw_shapes' && c.ok);
      },
      beforeCount,
      { timeout: 20_000 });

    expect(filterConsoleErrors(consoleErrors)).toEqual([]);
  });
});
