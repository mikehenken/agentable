/** Panel ids surfaced in the context-frame contextual toolbar "Add panel" menu. */
export type ContextFrameToolbarPanelId =
  | 'web-preview'
  | 'file-manager'
  | 'project-brief'
  | 'chat'
  | 'settings'
  | 'assets'
  | 'snapshots';

export type ContextFrameToolbarAction =
  | { type: 'open-panel'; panelId: ContextFrameToolbarPanelId; contextId: string }
  | { type: 'auto-arrange'; contextId: string }
  | { type: 'publish'; contextId: string }
  | { type: 'save'; contextId: string };

export interface ContextFrameToolbarEventDetail {
  action: ContextFrameToolbarAction;
}

/** Canonical embed transport event (A1). */
export const CONTEXT_FRAME_TOOLBAR_EVENT = 'agentable:context-toolbar';

/** @deprecated One-minor alias — use CONTEXT_FRAME_TOOLBAR_EVENT. */
export const LEGACY_CONTEXT_FRAME_TOOLBAR_EVENT = 'landi:canvas-site-context-toolbar';

const CONTEXT_FRAME_TOOLBAR_EVENTS = [
  CONTEXT_FRAME_TOOLBAR_EVENT,
  LEGACY_CONTEXT_FRAME_TOOLBAR_EVENT,
] as const;

export function emitContextFrameToolbarAction(action: ContextFrameToolbarAction): void {
  for (const eventName of CONTEXT_FRAME_TOOLBAR_EVENTS) {
    window.dispatchEvent(
      new CustomEvent<ContextFrameToolbarEventDetail>(eventName, {
        detail: { action },
        bubbles: true,
        composed: true,
      }));
  }
}
