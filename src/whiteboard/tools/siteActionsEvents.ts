/** tldraw site-actions tool id — opens host publish/edit panel when selected. */
export const SITE_ACTIONS_TOOL_ID = 'site-actions' as const;

export const CANVAS_SITE_ACTIONS_PANEL_EVENT = 'landi-canvas-site-actions-panel';

export interface CanvasSiteActionsPanelEventDetail {
  open: boolean;
}

/** Notify host overlays when the site-actions toolbar tool is selected or cleared. */
export function emitSiteActionsPanelChange(open: boolean): void {
  window.dispatchEvent(
    new CustomEvent<CanvasSiteActionsPanelEventDetail>(CANVAS_SITE_ACTIONS_PANEL_EVENT, {
      detail: { open },
      bubbles: true,
      composed: true,
    }),
  );
}
