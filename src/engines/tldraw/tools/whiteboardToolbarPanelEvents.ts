/** Cross-context whiteboard panel + screenshot intents (toolbar, career-pack, voice). */

export const WHITEBOARD_OPEN_PANEL_EVENT = 'landi-whiteboard-open-panel' as const;
export const WHITEBOARD_SCREENSHOT_CANVAS_EVENT =
  'landi-whiteboard-screenshot-canvas' as const;

export interface WhiteboardOpenPanelEventDetail {
  panelId: string;
  focus?: boolean;
  preserveZoom?: boolean;
  reposition?: boolean;
}

export function emitWhiteboardOpenPanel(
  panelId: string,
  options: Omit<WhiteboardOpenPanelEventDetail, 'panelId'> = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<WhiteboardOpenPanelEventDetail>(WHITEBOARD_OPEN_PANEL_EVENT, {
      detail: {
        panelId,
        focus: options.focus ?? true,
        preserveZoom: options.preserveZoom ?? true,
        reposition: options.reposition ?? true,
      },
      bubbles: true,
      composed: true,
    }));
}

export function emitWhiteboardScreenshotCanvas(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(WHITEBOARD_SCREENSHOT_CANVAS_EVENT, {
      bubbles: true,
      composed: true,
    }));
}
