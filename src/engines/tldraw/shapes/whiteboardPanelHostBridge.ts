/**
 * Module bridge for whiteboard PanelShape host wiring.
 * tldraw shape components may render outside React context providers;
 * WhiteboardShell binds the active CanvasHost here on mount.
 */
import { useSyncExternalStore } from 'react';
import type { CanvasHost } from '../../../panels/host';

let hostRef: CanvasHost | null = null;
let adapterSourcesRef: readonly string[] = [];
const listeners = new Set<() => void>;

function emitHostChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function bindWhiteboardPanelHost(
  host: CanvasHost | null,
  adapterSources: readonly string[] = []): void {
  hostRef = host;
  adapterSourcesRef = adapterSources;
  emitHostChange();
}

export function getWhiteboardPanelHost(): CanvasHost | null {
  return hostRef;
}

export function getWhiteboardPanelAdapterSources(): readonly string[] {
  return adapterSourcesRef;
}

/** Subscribe to host bind/unbind — PanelShapes re-render when wiring arrives. */
export function subscribeWhiteboardPanelHost(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** React hook for PanelShape bodies outside embed providers. */
export function useWhiteboardPanelHost(): CanvasHost | null {
  return useSyncExternalStore(
    subscribeWhiteboardPanelHost,
    getWhiteboardPanelHost, () => null);
}

/** @internal Test reset */
export function resetWhiteboardPanelHostBridgeForTests(): void {
  hostRef = null;
  adapterSourcesRef = [];
  emitHostChange();
}
