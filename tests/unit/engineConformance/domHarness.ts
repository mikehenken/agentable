/**
 * DOM workspace engine harness for the engine conformance kit.
 *
 * Unlike the tldraw harness, the DOM engine (..T4) has no attach step
 * and no underlying editor to spy on for z-order/camera primitives; it is
 * ready synchronously and reports z-order purely through `exportLayout`
 * ordering. `seedPanel` drives the same public `EngineHandle` surface a
 * host would use (`placePanel` + `setActiveTab`) so a seeded panel is the
 * active tab in its region by default, matching the tldraw stub's
 * always-visible seeded shapes.
 */
import type {
  EngineConformanceContext,
  EngineConformanceHarness,
} from '../../../src/engine/testing/types';
import type { DomRegionId } from '../../../src/engines/dom/types';
import type { Rect } from '../../../src/engine/types';
import { createDomEngine, type DomEngineHandle } from '../../../src/engines/dom/engine';

function regionIdForRect(rect: Rect): DomRegionId {
  return rect.x >= 500 ? 'sidebar': 'main';
}

export function createDomConformanceHarness(): EngineConformanceHarness {
  return {
    name: 'dom',
    layoutModel: 'region',
    createContext(): EngineConformanceContext {
      const engine: DomEngineHandle = createDomEngine;

      return {
        engine,
        reset: () => {
           // No attach/detach step to re-bind: the engine is ready
           // synchronously from construction.
        },
        teardown: () => {
          engine.destroy();
        },
        seedPanel: (panelId, rect) => {
          const regionId = regionIdForRect(rect);
          engine.placePanel(panelId, rect);
          engine.setActiveTab(regionId, engine.getDomLayout().panels.find(
            (panel) => panel.panelId === panelId)?.tabIndex ?? 0);
        },
        emitUserStoreChange: () => {
          engine.setSidebarDrawerOpen(!engine.getDomLayout().sidebarDrawerOpen);
        },
        emitCameraMotion: () => {
           camera: none: no / camera / to / move, kept as a / no-op / so
           // shared tests can call it unconditionally.
        },
        emitSelectionChange: (panelId) => {
          engine.placePanel(panelId, { x: 0, y: 0, w: 1, h: 1 }, { focus: true });
        },
      };
    },
  };
}
