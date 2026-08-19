/**
 * Engine SPI conformance suite (panel system spec section 14).
 *
 * Registers vitest cases for mount/unmount lifecycle, place/resize/remove/z-order,
 * CanvasMode constraint behavior, layout export/import round-trip, event contracts,
 * and capability honesty. Call from a test file with an engine-specific harness:
 *
 * registerEngineConformanceTests(createTldrawConformanceHarness());
 * registerEngineConformanceTests(createDomConformanceHarness());
 *
 * The tldraw engine passes this kit in CI; the DOM workspace engine
 * passes it as well. The kit runs unmodified against every
 * engine; assertions that depend on a declared `EngineCapabilities` flag or
 * on the engine's `layoutModel` branch per engine so a capability an
 * engine lacks is asserted as declared-absent rather than failing the kit.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { EngineCapabilities, WorkspaceLayoutRecord } from '../types';
import type { EngineConformanceContext, EngineConformanceHarness } from './types';

const SAMPLE_LAYOUT: WorkspaceLayoutRecord[] = [
  {
    panelId: 'conformance-a',
    contextId: 'ctx:1',
    position: { x: 100, y: 80 },
    size: { w: 320, h: 240 },
    pinned: false,
    origin: 'agent',
  },
  {
    panelId: 'conformance-b',
    contextId: null,
    position: { x: 500, y: 120 },
    size: { w: 200, h: 160 },
    pinned: false,
    origin: 'host',
  },
];

/** Same fixture, expressed in the DOM workspace engine's region layout model. */
const SAMPLE_LAYOUT_REGION: WorkspaceLayoutRecord[] = [
  {
    panelId: 'conformance-a',
    contextId: 'ctx:1',
    position: { x: 0, y: 0 },
    size: { w: 320, h: 240 },
    pinned: false,
    origin: 'agent',
    region: 'main',
    tabGroup: 0,
    order: 0,
  },
  {
    panelId: 'conformance-b',
    contextId: null,
    position: { x: 1, y: 0 },
    size: { w: 200, h: 160 },
    pinned: false,
    origin: 'host',
    region: 'sidebar',
    tabGroup: 0,
    order: 0,
  },
];

/**
 * Interim signal for "does this engine expose a controllable camera at
 * all". Today only the tldraw engine supports camera pan/zoom,
 * and it is the only engine declaring `infinitePan: true`; the DOM
 * workspace engine is `camera: none` and declares every flag false. A
 * future engine that decouples camera support from `infinitePan` will
 * need a dedicated SPI capability flag, tracked as a gap and not solved
 * here, since the existing kit is reused rather than growing the SPI.
 */
function hasSpatialCamera(caps: EngineCapabilities): boolean {
  return caps.infinitePan;
}

export function registerEngineConformanceTests(harness: EngineConformanceHarness): void {
  describe(`engine conformance kit — ${harness.name}`, () => {
    let ctx: EngineConformanceContext;

    beforeEach(() => {
      ctx = harness.createContext();
    });

    afterEach(() => {
      ctx.teardown();
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    describe('lifecycle', () => {
      it('is ready after harness attach', () => {
        expect(ctx.engine.isReady()).toBe(true);
      });

      it('emits change for user store entries', () => {
        const changeSpy = vi.fn();
        ctx.engine.on('change', changeSpy);
        ctx.emitUserStoreChange();
        expect(changeSpy).toHaveBeenCalledTimes(1);
      });

      it('stops emitting change after teardown', () => {
        const changeSpy = vi.fn();
        ctx.engine.on('change', changeSpy);
        ctx.teardown();
        ctx.emitUserStoreChange();
        expect(changeSpy).not.toHaveBeenCalled();
      });


      it('suppresses change during importSnapshot', () => {
        const changeSpy = vi.fn();
        ctx.engine.on('change', changeSpy);
        ctx.engine.importSnapshot({ document: { pages: [] } });
        expect(changeSpy).not.toHaveBeenCalled();
        ctx.emitUserStoreChange();
        expect(changeSpy).toHaveBeenCalledTimes(1);
      });

      it('destroy clears readiness', () => {
        ctx.engine.destroy();
        expect(ctx.engine.isReady()).toBe(false);
      });
    });

    describe('panel geometry', () => {
      it('placePanel creates a panel at the requested rect', () => {
        ctx.engine.placePanel('jobs', { x: 105, y: 83, w: 301, h: 199 });
        const records = ctx.engine.exportLayout();
        if (harness.layoutModel === 'region') {
          // Region engines (DOM) encode placement as region/tabGroup order rather than literal pixels; only size round-trips as-is.
          expect(records).toContainEqual(
            expect.objectContaining({
              panelId: 'jobs',
              size: { w: 301, h: 199 },
              region: expect.any(String),
            }));
          return;
        }
        expect(records).toContainEqual(
          expect.objectContaining({
            panelId: 'jobs',
            position: { x: 105, y: 83 },
            size: { w: 301, h: 199 },
          }));
      });

      it('resizePanel updates geometry and ignores absent panels', () => {
        ctx.seedPanel('jobs', { x: 0, y: 0, w: 100, h: 100 });
        ctx.engine.resizePanel('jobs', { x: 40, y: 60, w: 500, h: 400 });
        const [record] = ctx.engine.exportLayout().filter((row) => row.panelId === 'jobs');
        if (harness.layoutModel === 'region') {
          expect(record).toMatchObject({ size: { w: 500, h: 400 } });
        } else {
          expect(record).toMatchObject({
            position: { x: 40, y: 60 },
            size: { w: 500, h: 400 },
          });
        }

        const before = ctx.engine.exportLayout().length;
        ctx.engine.resizePanel('missing', { x: 0, y: 0, w: 10, h: 10 });
        expect(ctx.engine.exportLayout()).toHaveLength(before);
      });

      it('removePanel deletes the panel container', () => {
        ctx.seedPanel('jobs', { x: 0, y: 0, w: 100, h: 100 });
        ctx.engine.removePanel('jobs');
        expect(ctx.engine.exportLayout().find((row) => row.panelId === 'jobs')).toBeUndefined();
      });

      it('setZOrder maps front, back, and numeric slots', () => {
        ctx.seedPanel('a', { x: 0, y: 0, w: 10, h: 10 });
        ctx.seedPanel('b', { x: 20, y: 0, w: 10, h: 10 });
        ctx.seedPanel('c', { x: 40, y: 0, w: 10, h: 10 });

        // Engines without a stub-editor reorder API (DOM) still
        // implement z-order; its effect is observable through exportLayout
        // ordering instead of editor-primitive spies.
        ctx.engine.setZOrder('a', 'front');
        if (ctx.reorderSpies) {
          expect(ctx.reorderSpies.bringToFront).toHaveBeenCalled();
        } else {
          expect(ctx.engine.exportLayout().at(-1)?.panelId).toBe('a');
        }

        ctx.engine.setZOrder('a', 'back');
        if (ctx.reorderSpies) {
          expect(ctx.reorderSpies.sendToBack).toHaveBeenCalled();
        } else {
          expect(ctx.engine.exportLayout()[0]?.panelId).toBe('a');
        }

        if (ctx.reorderSpies) {
          ctx.reorderSpies.sendToBack.mockClear();
          ctx.engine.setZOrder('a', 1);
          expect(ctx.reorderSpies.sendToBack).toHaveBeenCalled();
          expect(ctx.reorderSpies.bringForward).toHaveBeenCalled();
        } else {
          ctx.engine.setZOrder('a', 1);
          expect(ctx.engine.exportLayout()[1]?.panelId).toBe('a');
        }
      });
    });

    describe('camera and CanvasMode', () => {
      it('translates camera state both ways', () => {
        if (!hasSpatialCamera(ctx.engine.capabilities)) {
          // camera: none: reads stay fixed and writes are a no-op.
          const fixed = ctx.engine.getCamera();
          ctx.engine.setCamera({ x: 1, y: 2, zoom: 0.5 });
          expect(ctx.engine.getCamera()).toEqual(fixed);
          return;
        }
        expect(ctx.engine.getCamera()).toEqual({ x: 10, y: 20, zoom: 2 });
        ctx.engine.setCamera({ x: 1, y: 2, zoom: 0.5 });
        expect(ctx.engine.getCamera()).toEqual({ x: 1, y: 2, zoom: 0.5 });
      });

      it('throws on camera reads without an attached editor', () => {
        if (!hasSpatialCamera(ctx.engine.capabilities)) {
          // No attach step at all: camera reads stay safe and fixed
          // instead of throwing, which is the declared-absent equivalent.
          ctx.teardown();
          const engine = harness.createContext().engine;
          engine.destroy();
          expect(() => engine.getCamera()).not.toThrow();
          expect(() => engine.getViewportInfo()).not.toThrow();
          engine.destroy();
          return;
        }
        ctx.teardown();
        const engine = harness.createContext().engine;
        engine.destroy();
        expect(() => engine.getCamera()).toThrow(/requires an attached editor/);
        expect(() => engine.getViewportInfo()).toThrow(/requires an attached editor/);
        engine.destroy();
      });

      it('ignores setCamera in fixed mode', () => {
        ctx.engine.setMode({ kind: 'fixed' });
        const before = ctx.engine.getCamera();
        ctx.engine.setCamera({ x: 99, y: 88, zoom: 0.25 });
        expect(ctx.engine.getCamera()).toEqual(before);
      });

      it('clamps setCamera for bounded mode', () => {
        ctx.engine.setMode({
          kind: 'bounded',
          bounds: { w: 1200, h: 800 },
          zoom: { min: 0.5, max: 2 },
        });
        ctx.engine.setCamera({ x: -8000, y: -8000, zoom: 5 });
        const camera = ctx.engine.getCamera();
        expect(camera.zoom).toBeLessThanOrEqual(2);
        expect(camera.x).toBeGreaterThan(-8000);
      });

      it('accepts infinite, bounded, and fixed canvas modes', () => {
        ctx.engine.setMode({ kind: 'infinite' });
        ctx.engine.setMode({
          kind: 'bounded',
          bounds: { w: 1200, h: 800 },
          behavior: 'inside',
        });
        ctx.engine.setMode({ kind: 'fixed' });
        expect(ctx.engine.isReady()).toBe(true);
      });

      it('zoomTo accepts a target rect with inset', () => {
        ctx.engine.zoomTo({ x: 0, y: 0, w: 400, h: 300 }, { inset: 32 });
        expect(ctx.engine.isReady()).toBe(true);
      });
    });

    describe('workspace layout records', () => {
      it('round-trips export and import through WorkspaceLayoutRecord', () => {
        const sample = harness.layoutModel === 'region' ? SAMPLE_LAYOUT_REGION: SAMPLE_LAYOUT;
        ctx.engine.importLayout(sample);
        expect(ctx.engine.exportLayout()).toEqual(sample);
      });

      it('returns an empty layout when no panels are placed', () => {
        expect(ctx.engine.exportLayout()).toEqual([]);
      });
    });

    describe('event contracts', () => {
      it('emits panel moved, resized, and removed events', () => {
        const moved = vi.fn();
        const resized = vi.fn();
        const removed = vi.fn();
        ctx.engine.on('panel:moved', moved);
        ctx.engine.on('panel:resized', resized);
        ctx.engine.on('panel:removed', removed);

        ctx.seedPanel('jobs', { x: 0, y: 0, w: 300, h: 200 });
        ctx.engine.resizePanel('jobs', { x: 40, y: 20, w: 500, h: 300 });
        expect(moved).toHaveBeenCalled();
        expect(resized).toHaveBeenCalled();

        ctx.engine.removePanel('jobs');
        expect(removed).toHaveBeenCalledWith({ id: 'jobs' });
      });


      it('emits camera:settled after the camera holds still', () => {
        vi.useFakeTimers();
        const settled = vi.fn();
        ctx.engine.on('camera:settled', settled);
        ctx.emitCameraMotion();
        vi.advanceTimersByTime(250);
        if (!hasSpatialCamera(ctx.engine.capabilities)) {
          // camera: none: no camera motion to settle, declared absent.
          expect(settled).not.toHaveBeenCalled();
          return;
        }
        expect(settled).toHaveBeenCalled();
        expect(settled.mock.calls[0]?.[0]).toMatchObject({
          camera: expect.objectContaining({ zoom: expect.any(Number) }),
        });
      });
    });

    describe('viewport digest', () => {
      it('reports viewport info with per-panel visibility ratios', () => {
        ctx.seedPanel('inside', { x: 100, y: 100, w: 200, h: 200 });
        ctx.seedPanel('out', { x: 5000, y: 5000, w: 100, h: 100 });
        const info = ctx.engine.getViewportInfo();
        expect(info.visibleRect).toMatchObject({
          w: expect.any(Number),
          h: expect.any(Number),
        });
        expect(info.zoom).toBeGreaterThan(0);
        expect(info.panelVisibility.inside).toBeGreaterThan(0);
        expect(info.panelVisibility.out).toBe(0);
      });
    });

    describe('capability honesty', () => {
      it('declares every EngineCapabilities flag as a boolean', () => {
        const caps = ctx.engine.capabilities;
        expect(typeof caps.frames).toBe('boolean');
        expect(typeof caps.draw).toBe('boolean');
        expect(typeof caps.minimap).toBe('boolean');
        expect(typeof caps.infinitePan).toBe('boolean');
        expect(typeof caps.nativeSnapshots).toBe('boolean');
      });

      it('demonstrates nativeSnapshots when claimed true, or layout-only restore when false', () => {
        if (!ctx.engine.capabilities.nativeSnapshots) {
          // No native snapshot format richer than layout records:
          // a host must be able to restore full workspace state from
          // exportLayout/importLayout alone, without ever touching
          // exportSnapshot/importSnapshot.
          ctx.seedPanel('conformance-honesty', { x: 0, y: 0, w: 240, h: 180 });
          const before = ctx.engine.exportLayout();
          ctx.engine.importLayout(before);
          expect(ctx.engine.exportLayout()).toEqual(before);
          return;
        }
        expect(ctx.engine.exportSnapshot()).not.toEqual({});
      });
    });
  });
}
