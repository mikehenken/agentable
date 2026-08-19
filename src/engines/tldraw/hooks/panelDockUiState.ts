/**
 * Lightweight pub/sub for dock highlight overlay during panel drag.
 * Avoids threading editor state through tldraw component props.
 */
import type { DockZoneHighlight } from '../context/panelDockEngine';

export interface PanelDockPreviewState {
  highlight: DockZoneHighlight;
}

let activePreview: PanelDockPreviewState | null = null;
const listeners = new Set<() => void>();

export function getPanelDockPreview(): PanelDockPreviewState | null {
  return activePreview;
}

export function setPanelDockPreview(preview: PanelDockPreviewState | null): void {
  activePreview = preview;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribePanelDockPreview(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
