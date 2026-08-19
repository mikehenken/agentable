/** tldraw context-actions tool id — opens host action bar when selected. */
export const CONTEXT_ACTIONS_TOOL_ID = 'site-actions' as const;

export const CONTEXT_ACTIONS_PANEL_EVENT = 'agentable:context-actions-panel';

/** @deprecated One-minor alias — use CONTEXT_ACTIONS_PANEL_EVENT. */
export const LEGACY_CONTEXT_ACTIONS_PANEL_EVENT = 'landi-canvas-site-actions-panel';

const CONTEXT_ACTIONS_PANEL_EVENTS = [
  CONTEXT_ACTIONS_PANEL_EVENT,
  LEGACY_CONTEXT_ACTIONS_PANEL_EVENT,
] as const;

export interface ContextActionsPanelEventDetail {
  open: boolean;
}

/** Notify host overlays when the context-actions toolbar tool is selected or cleared. */
export function emitContextActionsPanelChange(open: boolean): void {
  for (const eventName of CONTEXT_ACTIONS_PANEL_EVENTS) {
    window.dispatchEvent(
      new CustomEvent<ContextActionsPanelEventDetail>(eventName, {
        detail: { open },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

/** @deprecated One-minor alias — use emitContextActionsPanelChange. */
export const emitSiteActionsPanelChange = emitContextActionsPanelChange;
