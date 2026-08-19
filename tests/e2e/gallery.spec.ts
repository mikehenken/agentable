import { test, expect } from '@playwright/test';
import {
  GALLERY_EXAMPLES,
  filterConsoleErrors,
  waitForGalleryReady,
} from './helpers/galleryHelpers';

for (const example of GALLERY_EXAMPLES) {
  test.describe(`gallery · ${example.id}`, () => {
    test('loads with zero console errors and reports ready', async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') {
          consoleErrors.push(message.text());
        }
      });
      page.on('pageerror', (error) => {
        consoleErrors.push(error.message);
      });

      await page.goto(example.path);

      const ready = await waitForGalleryReady(
        page,
        example.id,
        example.id === '08-agent-presents' ||
          example.id === '12-open-agent-canvas' ||
          example.id === '13-canvas-wide-agent'
          ? 45_000 : 30_000);
      expect(ready.ok, JSON.stringify(ready, null, 2)).toBe(true);

      if (example.id === '03-multi-surface-dashboard') {
        const mounted = await page.evaluate(() => document.querySelectorAll('[data-agentable-mounted]').length);
        expect(mounted).toBeGreaterThanOrEqual(2);
      }

      if (example.id === '09-multi-agent-page') {
        const result = await page.evaluate(() => window.__multiAgentE2eResult);
        expect(result?.ok, JSON.stringify(result?.checks, null, 2)).toBe(true);
      }

      if (example.id === '12-open-agent-canvas') {
        const defined = await page.evaluate(() => customElements.get('agentable-whiteboard') !== undefined);
        expect(defined).toBe(true);

        const canvasState = await page.evaluate(() => {
          const whiteboard = document.querySelector('agentable-whiteboard');
          const shadow = whiteboard?.shadowRoot;
          const canvasCount = shadow?.querySelectorAll('canvas').length ?? 0;
          const demo = window.__meridianDemoResult;
          return {
            canvasCount,
            demoOk: demo?.ok === true,
            totalShapes: demo?.totalShapes ?? 0,
            flowBoxCount: demo?.flowBoxCount ?? 0,
          };
        });
        expect(canvasState.canvasCount, 'tldraw canvas must mount in shadow DOM').toBeGreaterThan(0);
        expect(canvasState.demoOk, 'Meridian wireframe demo must succeed').toBe(true);
        expect(canvasState.totalShapes).toBeGreaterThanOrEqual(4);
        expect(canvasState.flowBoxCount).toBe(4);
      }

      if (example.id === '13-canvas-wide-agent') {
        const operatorState = await page.evaluate(() => {
          const result = window.__operatorGalleryResult;
          const placementDefined =
            customElements.get('agentable-operator-surface-placement') !== undefined;
          const surfaceDefined = customElements.get('agentable-operator-surface') !== undefined;
          const dockInside = document.querySelector(
            'agentable-operator-surface-placement[placement="dock-inside"]');
          const floating = document.querySelector(
            'agentable-operator-surface-placement[placement="floating"]');
          const countSurfaces = (root) => {
            let count = 0;
            const walk = (node) => {
              if (
                !(
                  node instanceof Element ||
                  node instanceof DocumentFragment ||
                  node instanceof Document
                )
              ) {
                return;
              }
              const elements =
                node instanceof Document
                  ? [...node.body.querySelectorAll('*')]: node instanceof DocumentFragment
                    ? [...node.children]: [node,...node.querySelectorAll('*')];
              for (const el of elements) {
                if (!(el instanceof Element)) continue;
                if (el.tagName.toLowerCase() === 'agentable-operator-surface') {
                  count += 1;
                }
                if (el.shadowRoot) {
                  walk(el.shadowRoot);
                }
              }
            };
            walk(root);
            return count;
          };
          const rail = document.querySelector('.operator-rail');
          const dockInsideSurfaceCount = rail ? countSurfaces(rail): 0;
          return {
            result,
            placementDefined,
            surfaceDefined,
            dockInsideMounted: dockInside !== null,
            floatingMounted: floating !== null,
            dockInsideSurfaceCount,
          };
        });

        expect(operatorState.placementDefined).toBe(true);
        expect(operatorState.surfaceDefined).toBe(true);
        expect(operatorState.dockInsideMounted).toBe(true);
        expect(operatorState.floatingMounted).toBe(true);
        expect(operatorState.dockInsideSurfaceCount).toBe(1);
        expect(operatorState.result?.ok, JSON.stringify(operatorState.result, null, 2)).toBe(true);
        expect(operatorState.result?.sharedSession).toBe(true);
        expect(operatorState.result?.placementCount).toBe(2);
        expect(operatorState.result?.voiceDefaultOff).toBe(true);

        const probeMessage = 'operator probe';
        const textarea = page.locator('.operator-rail textarea').first();
        await textarea.fill(probeMessage);
        await page.locator('.operator-rail [part="composer-submit"]').first().click();
        await expect(page.locator('.operator-rail')).toContainText(probeMessage);
      }

      if (example.id === '08-agent-presents') {
        const defined = await page.evaluate(() => customElements.get('agentable-whiteboard') !== undefined);
        expect(defined).toBe(true);
      }

      if (example.id === '10-locale-rtl') {
        const dir = await page.evaluate(() => document.documentElement.getAttribute('dir'));
        expect(dir).toBe('rtl');
      }

      if (example.id === '06-react-host-deep') {
        const detail = await page.getByTestId('panel-ready-detail').textContent();
        expect(detail).toMatch(/Connected|Connection issue|Connecting/);
        const connectionState = await page.evaluate(() => window.__galleryReady?.connectionState);
        expect(connectionState).toBe('connected');
      }

      if (example.id === '11-app-shell') {
        // Fresh browser context per test: no saved layout yet, so the
        // DOM workspace engine seeds the default placement on first load.
        expect(ready.restored).toBe(false);

        const mainTabs = page.locator('[role="tablist"][data-dom-region="main"]');
        await expect(mainTabs.locator('[data-dom-tab="open-positions"][data-active="true"]')).toBeVisible();
        await expect(mainTabs.locator('[data-dom-tab="growth-paths"]')).toBeVisible();

        // Switch the main region's active tab away from the default.
        await mainTabs.locator('[data-dom-tab="growth-paths"]').click();
        await expect(mainTabs.locator('[data-dom-tab="growth-paths"][data-active="true"]')).toBeVisible();
        await expect(
          page.locator('[data-testid="app-shell-panel-growth-paths"]')).toBeVisible();

        // Wait for the debounced layout save to land in localStorage before
        // reloading. The persisted value is the DOM engine's native
        // snapshot (`{ version, panels, activeTab,... }`, from
        // `engine.exportSnapshot()`), not the engine-agnostic
        // `WorkspaceLayoutRecord[]` transport: activeTab.main must be 1
        // (growth-paths) for the reload assertion below to mean anything.
        await page.waitForFunction(() => {
          const raw = window.localStorage.getItem('agentable-app-shell:archipelago-resorts');
          if (!raw) return false;
          try {
            const snapshot = JSON.parse(raw) as { activeTab?: { main?: unknown } };
            return snapshot.activeTab?.main === 1;
          } catch {
            return false;
          }
        });

        await page.reload();
        const reloadedReady = await waitForGalleryReady(page, example.id, 30_000);
        expect(reloadedReady.ok, JSON.stringify(reloadedReady, null, 2)).toBe(true);
        expect(reloadedReady.restored, 'layout must be restored from storage after reload').toBe(true);

        // The tab switched before reload must still be active: layout survives reload.
        const mainTabsAfterReload = page.locator('[role="tablist"][data-dom-region="main"]');
        await expect(
          mainTabsAfterReload.locator('[data-dom-tab="growth-paths"][data-active="true"]')).toBeVisible();
        await expect(
          page.locator('[data-testid="app-shell-panel-growth-paths"]')).toBeVisible();

        // No tldraw canvas surface anywhere on this page.
        expect(await page.locator('.tl-container').count()).toBe(0);
        expect(await page.locator('canvas').count()).toBe(0);
      }

      const filtered = filterConsoleErrors(consoleErrors);
      expect(filtered, `console errors:\n${filtered.join('\n')}`).toEqual([]);
    });
  });
}
