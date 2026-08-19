/** Layout chrome action tool ids — auto-arrange / reset canvas. */

export const AUTO_ARRANGE_TOOL_ID = 'auto-arrange' as const;
export const RESET_CANVAS_TOOL_ID = 'reset' as const;

export const WHITEBOARD_AUTO_ARRANGE_EVENT = 'landi-whiteboard-auto-arrange';
export const WHITEBOARD_RESET_CANVAS_EVENT = 'landi-whiteboard-reset-canvas';

export function emitWhiteboardAutoArrange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(WHITEBOARD_AUTO_ARRANGE_EVENT, {
      bubbles: true,
      composed: true,
    }),
  );
}

export function emitWhiteboardResetCanvas(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(WHITEBOARD_RESET_CANVAS_EVENT, {
      bubbles: true,
      composed: true,
    }),
  );
}
