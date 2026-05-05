/**
 * Lazy-panel dynamic-import registry.
 *
 * `CanvasShell` wraps each loader via `React.lazy()` for code-splitting;
 * `prefetchPanel` / `prefetchAllPanelsIdle` re-use the SAME loaders for
 * warm-ahead prefetching (idle + hover). Vite chunk-dedupes — the same
 * `import()` from `lazy()` and from prefetch resolves to one network fetch.
 *
 * Stable-reference contract: define a registry at module scope (NOT inline
 * in JSX). `CanvasShell` memoizes lazy wrapping on registry identity — a
 * fresh object every render forces re-creation of every lazy component,
 * triggers chunk re-fetch, and remounts panel state.
 *
 * The default registry below currently points at career-domain panels
 * colocated in this package — vestigial from the pre-split monolith.
 * Tenant wrappers override via `<CanvasShell panels={...}>` until the
 * physical move lands.
 */
import type { ComponentType } from 'react';

/** A `React.lazy()`-compatible loader. */
export type PanelLoader = () => Promise<{ default: ComponentType<unknown> }>;

/** Map of panel id → loader. See module header for the stable-reference contract. */
export type PanelRegistry = Record<string, PanelLoader>;

export const DEFAULT_PANEL_REGISTRY = {
  positions: () =>
    import('./OpenPositionsPanel').then((m) => ({ default: m.OpenPositionsPanel })),
  applications: () =>
    import('./ApplicationsPanel').then((m) => ({ default: m.ApplicationsPanel })),
  resources: () =>
    import('./ResourcesPanel').then((m) => ({ default: m.ResourcesPanel })),
  tools: () =>
    import('./CareerToolsPanel').then((m) => ({ default: m.CareerToolsPanel })),
  trajectories: () =>
    import('./GrowthPathsPanel').then((m) => ({ default: m.GrowthPathsPanel })),
  journey: () =>
    import('./JourneyPanel').then((m) => ({ default: m.JourneyPanel })),
  settings: () =>
    import('./SettingsPanel').then((m) => ({ default: m.SettingsPanel })),
} satisfies PanelRegistry;

/**
 * @deprecated Renamed to `DEFAULT_PANEL_REGISTRY`. Remove by 2026-05-15
 *  (one-loop rename window). All in-tree consumers already migrated;
 *  external callers (none today) get one cycle.
 */
export const panelImports = DEFAULT_PANEL_REGISTRY;

/**
 * Keys of `DEFAULT_PANEL_REGISTRY` only. Tenant-supplied registries are NOT
 * narrowed by this type — it exists for `NavSidebar`'s default-set hover
 * prefetch path. Renamed from `PanelImportKey` to make scope explicit.
 * The old name is kept as a deprecated alias.
 */
export type DefaultPanelKey = keyof typeof DEFAULT_PANEL_REGISTRY;
/** @deprecated Use `DefaultPanelKey`. */
export type PanelImportKey = DefaultPanelKey;

/**
 * Trigger one panel's import without waiting. Idempotent (chunk cache
 * dedupes). Rejection swallow is intentional — `ChunkErrorBoundary` owns
 * the visible failure path when the user actually clicks. In dev, surface
 * via `console.debug` so silent CDN/network issues are at least loggable.
 */
export function prefetchPanel(
  key: string,
  registry: PanelRegistry = DEFAULT_PANEL_REGISTRY,
): void {
  const loader = registry[key];
  if (!loader) return;
  loader().catch((err) => {
    if (
      typeof process !== 'undefined' &&
      process.env?.NODE_ENV !== 'production'
    ) {
      // eslint-disable-next-line no-console
      console.debug(`[panelImports] prefetch failed for "${key}":`, err);
    }
  });
}

/**
 * Idle-warm every panel chunk in `registry` after first paint. Returns a
 * cancel fn for React's effect-cleanup path. Falls back to `setTimeout`
 * on browsers without `requestIdleCallback`.
 */
export function prefetchAllPanelsIdle(
  registry: PanelRegistry = DEFAULT_PANEL_REGISTRY,
): () => void {
  const fire = () => {
    for (const key of Object.keys(registry)) {
      prefetchPanel(key, registry);
    }
  };

  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(fire, { timeout: 4000 });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(fire, 1500);
  return () => clearTimeout(handle);
}
