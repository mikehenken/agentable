/**
 * useLazyPanel — resolves a panelId to a `React.lazy()` component using the
 * active whiteboard registry.
 *
 * Why a hook (not a plain util): we memoise the lazy wrapping by `(registry,
 * panelId)` so a re-render of the shape doesn't keep recreating lazy
 * components (which would re-fetch chunks and remount panel state).
 *
 * Returns `null` when the id isn't in the registry — the caller renders a
 * placeholder. We don't throw because the agent could (in principle) call
 * a tool with a panel id we haven't shipped yet; surfacing a friendly
 * placeholder is cheaper than a full error boundary trip.
 */
import { lazy, useMemo, type ComponentType, type LazyExoticComponent } from 'react';
import type {
  WhiteboardPanelProps,
  WhiteboardPanelRegistry,
} from './whiteboardPanelRegistry';

/** Cache shared across hook calls so any two consumers asking for the same
 * `(registry, panelId)` share one lazy() wrapper. tldraw can ask for the
 * same panel multiple times across re-renders — without this, each render
 * resets the lazy component's cache and we'd re-fetch the chunk. */
const lazyCache = new WeakMap<
  WhiteboardPanelRegistry,
  Map<string, LazyExoticComponent<ComponentType<WhiteboardPanelProps>>>
>();

export function useLazyPanel(
  registry: WhiteboardPanelRegistry,
  panelId: string,
): LazyExoticComponent<ComponentType<WhiteboardPanelProps>> | null {
  return useMemo(() => {
    const loader = registry[panelId];
    if (!loader) return null;
    let perRegistry = lazyCache.get(registry);
    if (!perRegistry) {
      perRegistry = new Map();
      lazyCache.set(registry, perRegistry);
    }
    let cached = perRegistry.get(panelId);
    if (!cached) {
      cached = lazy(loader);
      perRegistry.set(panelId, cached);
    }
    return cached;
  }, [registry, panelId]);
}
