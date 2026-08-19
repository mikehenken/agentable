/**
 * Lazy panel loader registry types and prefetch helpers (framework-neutral).
 * Career demo loaders were removed in P7-T2; hosts register panels via
 * createCanvasHost or WhiteboardShell panels prop.
 */
import type { ComponentType } from 'react';

export type PanelLoader = () => Promise<{ default: ComponentType<unknown> }>;
export type PanelRegistry = Record<string, PanelLoader>;

/** Example-only default — empty; tenants and packs supply registries. */
export const DEFAULT_PANEL_REGISTRY = {} satisfies PanelRegistry;

/** @deprecated Use DEFAULT_PANEL_REGISTRY */
export const panelImports = DEFAULT_PANEL_REGISTRY;

export type DefaultPanelKey = keyof typeof DEFAULT_PANEL_REGISTRY;
/** @deprecated Use DefaultPanelKey */
export type PanelImportKey = DefaultPanelKey;

export function prefetchPanel(
  key: string,
  registry: PanelRegistry = DEFAULT_PANEL_REGISTRY,
): void {
  const loader = registry[key];
  if (!loader) return;
  loader().catch(() => undefined);
}

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
