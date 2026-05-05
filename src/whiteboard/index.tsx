/**
 * Whiteboard barrel — public surface for the whiteboard prototype.
 *
 * Exports:
 *   - `WhiteboardShell` — eager export for direct consumers (tests, the
 *     CareerWhiteboard wrapper, anyone happy to bundle tldraw upfront).
 *   - `LazyWhiteboardShell` — `React.lazy()` wrapper that defers the
 *     tldraw + WhiteboardShell chunk until first render. Use this in
 *     route components so /career-canvas-whiteboard streams its tldraw
 *     bundle on demand instead of in the main app chunk.
 *   - `prefetchWhiteboardShell` — fires the same dynamic import without
 *     awaiting. Hook this to nav-link hover and to `voiceKernel.start()`
 *     so the chunk is warm by the time the user lands on the route or
 *     the agent's first tool call fires.
 *   - `panelShapeApi` re-exports — `openPanelInCanvas` etc. consumed by
 *     the shared canvasTools registry, no module-deep imports needed.
 *
 * The Lit shell embed path doesn't go through this barrel — embed bundles
 * keep the existing absolute-positioned canvas. The whiteboard is React-
 * only by design.
 */
import { lazy, type ComponentType } from 'react';
import type { WhiteboardShellProps } from './WhiteboardShell';

/** Eager export. Pulls tldraw into the consumer's bundle. */
export { WhiteboardShell } from './WhiteboardShell';
export type { WhiteboardShellProps } from './WhiteboardShell';

/**
 * Lazy WhiteboardShell. The dynamic import resolves to the same module as
 * the eager export — Vite chunk-dedupes so you can mix-and-match per
 * route.
 */
export const LazyWhiteboardShell = lazy(async () => {
  const mod = await import('./WhiteboardShell');
  return { default: mod.WhiteboardShell as ComponentType<WhiteboardShellProps> };
});

/**
 * Prefetch the tldraw + WhiteboardShell chunk. Idempotent (the import
 * cache dedupes). Returns the resolved module so callers can chain off
 * it; failure rejection is swallowed because the visible failure path is
 * the user actually navigating, where Suspense + ErrorBoundary handle it.
 *
 * Wire-up suggestions:
 *   - Hook to nav-link `onPointerEnter` / `onFocus` so hovering the
 *     whiteboard nav warms the chunk.
 *   - Hook to `voiceKernel.start()` so a tool call landing in the load
 *     window has a shorter wait — the editor is more likely to be bound
 *     by the time `panelShapeApi.openPanelInCanvas` fires.
 */
export function prefetchWhiteboardShell(): Promise<unknown> {
  return import('./WhiteboardShell').catch((err) => {
    if (
      typeof process !== 'undefined' &&
      process.env?.NODE_ENV !== 'production'
    ) {
      // eslint-disable-next-line no-console
      console.debug('[whiteboard] prefetch failed', err);
    }
  });
}

// Imperative driver — re-exported so canvasTools and tests don't need to
// reach into the `shapes/` subdirectory.
export {
  bindEditor,
  unbindEditor,
  getEditor,
  openPanelInCanvas,
  closePanelInCanvas,
  focusPanelInCanvas,
  updatePanelProps,
  __resetPanelShapeApiForTests__,
  type OpenPanelOptions,
} from './shapes/panelShapeApi';

// Registry types — consumers (tests, alternative tenants) need these
// to define their own panel registries.
export {
  DEFAULT_WHITEBOARD_PANEL_REGISTRY,
  type WhiteboardPanelRegistry,
  type WhiteboardPanelLoader,
  type WhiteboardPanelProps,
} from './shapes/whiteboardPanelRegistry';

// Shape util — re-exported so consumers wanting to register the shape
// against a custom tldraw editor instance (e.g. for tests) don't need to
// reach into `shapes/`.
export { PanelShapeUtil, createPanelShapeUtil, type PanelShape } from './shapes/PanelShape';
