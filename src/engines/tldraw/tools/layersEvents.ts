/** tldraw layers-panel tool id — toggles the shape tree overlay when selected. */
export const LAYERS_TOOL_ID = 'layers' as const;

export const CANVAS_LAYERS_PANEL_EVENT = 'landi-canvas-layers-panel';

export interface CanvasLayersPanelEventDetail {
  open: boolean;
}

/** Notify host overlays when the layers toolbar tool is selected or cleared. */
export function emitLayersPanelChange(open: boolean): void {
  window.dispatchEvent(
    new CustomEvent<CanvasLayersPanelEventDetail>(CANVAS_LAYERS_PANEL_EVENT, {
      detail: { open },
      bubbles: true,
      composed: true,
    }),
  );
}
