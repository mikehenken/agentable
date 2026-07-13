/** Panel ids surfaced in the site-context contextual toolbar "Add panel" menu. */
export type SiteContextToolbarPanelId =
  | 'web-preview'
  | 'file-manager'
  | 'project-brief'
  | 'chat'
  | 'settings'
  | 'assets'
  | 'snapshots';

export type SiteContextToolbarAction =
  | { type: 'open-panel'; panelId: SiteContextToolbarPanelId; siteId: string }
  | { type: 'auto-arrange'; siteId: string }
  | { type: 'publish'; siteId: string }
  | { type: 'save'; siteId: string };

export interface SiteContextToolbarEventDetail {
  action: SiteContextToolbarAction;
}

export const CANVAS_SITE_CONTEXT_TOOLBAR_EVENT = 'landi:canvas-site-context-toolbar';

export function emitSiteContextToolbarAction(action: SiteContextToolbarAction): void {
  window.dispatchEvent(
    new CustomEvent<SiteContextToolbarEventDetail>(CANVAS_SITE_CONTEXT_TOOLBAR_EVENT, {
      detail: { action },
      bubbles: true,
      composed: true,
    }),
  );
}
