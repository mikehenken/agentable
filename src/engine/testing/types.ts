/**
 * Engine conformance kit harness types (panel system spec section 14).
 *
 * The kit is engine-agnostic: each implementation supplies a harness that
 * creates an attached `EngineHandle` plus engine-specific hooks for
 * driving store events and spying on reorder ops. The tldraw harness
 * and the DOM workspace harness both implement this
 * interface and call `registerEngineConformanceTests`.
 */
import type { Mock } from 'vitest';
import type { EngineHandle, Rect } from '../types';

/** Optional spies exposed by harnesses that use a stub editor for z-order tests. */
export interface EngineReorderSpies {
  bringToFront: Mock;
  sendToBack: Mock;
  bringForward: Mock;
}

/**
 * Per-test context returned by a conformance harness. The engine must be
 * attached (ready) when the context is created unless a test explicitly
 * covers the unattached state.
 */
export interface EngineConformanceContext {
  engine: EngineHandle;
  /** Re-bind or reset engine state between tests. */
  reset: () => void;
  /** Tear down listeners and editor binding after each test. */
  teardown: () => void;
  /** Pre-seed a panel shape at the given rect for geometry/event tests. */
  seedPanel: (panelId: string, rect: Rect) => void;
  /** Emit a single user-driven store mutation (for change lifecycle tests). */
  emitUserStoreChange: () => void;
  /** Emit camera motion so camera:settled can fire after debounce. */
  emitCameraMotion: () => void;
  /** Emit a selection change for the given panel id. */
  emitSelectionChange: (panelId: string) => void;
  /**
   * Spies for z-order assertions on engines whose z-order primitives are
   * observable only through an underlying editor (tldraw). Engines that
   * expose z-order through `exportLayout` ordering alone (DOM)
   * omit this; the kit falls back to an export-order assertion.
   */
  reorderSpies?: EngineReorderSpies;
}

/**
 * Layout geometry model an engine's `exportLayout` records use, per the
 * `WorkspaceLayoutRecord` SPI doc: `spatial` engines report literal
 * canvas coordinates and omit `region`; `region` engines (DOM workspace,
 *..T4) populate `{ region, tabGroup, order }` and encode `position`
 * symbolically. Defaults to `spatial` for harnesses that omit it, matching
 * every engine before P11.
 */
export type EngineLayoutModel = 'spatial' | 'region';

/** Factory for the conformance kit — one per engine implementation. */
export interface EngineConformanceHarness {
  /** Human-readable engine id (e.g. `tldraw`). */
  name: string;
  /** Geometry model of `exportLayout` records (default `spatial`). */
  layoutModel?: EngineLayoutModel;
  createContext: () => EngineConformanceContext;
}
