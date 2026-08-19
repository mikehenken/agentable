/**
 * Host chrome for career / marketing whiteboard embeds — frame sizing,
 * figure-ground border, and canvas-only expand (not document fullscreen).
 */

export type WhiteboardFullscreenMode = 'canvas-expand' | 'document';

export interface WhiteboardHostChromeConfig {
  /** Canvas frame width as % of host viewport. Career default: 98. */
  frameWidthPercent?: number;
  /** Outer margin (px) between host viewport edge and frame — not inner padding. Default 3 for career. */
  frameEdgeMargin?: number;
  /** Subtle stroke + rounded corners for figure-ground separation. */
  frameBorder?: boolean;
  /** Corner radius in px when frameBorder is true. Default 16. */
  frameBorderRadius?: number;
  /**
   * Offset from viewport top when canvas-expand is active (sticky site nav).
   * e.g. `80px` on Sandals homepage; `0` on dedicated full-viewport routes.
   */
  hostHeaderHeight?: string | null;
  /**
   * `canvas-expand` — fixed overlay below hostHeaderHeight with motion (career).
   * `document` — legacy documentElement.requestFullscreen (operator/gallery).
   */
  fullscreenMode?: WhiteboardFullscreenMode;
}

export interface ResolvedWhiteboardHostChrome {
  frameWidthPercent: number;
  frameEdgeMargin: number;
  frameBorder: boolean;
  frameBorderRadius: number;
  hostHeaderHeight: string | null;
  fullscreenMode: WhiteboardFullscreenMode;
}

export const DEFAULT_WHITEBOARD_HOST_CHROME: ResolvedWhiteboardHostChrome = {
  frameWidthPercent: 100,
  frameEdgeMargin: 0,
  frameBorder: false,
  frameBorderRadius: 0,
  hostHeaderHeight: null,
  fullscreenMode: 'document',
};

/** Career concierge defaults — 98% width, bordered frame, canvas-only expand. */
export const DEFAULT_CAREER_HOST_CHROME: ResolvedWhiteboardHostChrome = {
  frameWidthPercent: 98,
  frameEdgeMargin: 3,
  frameBorder: true,
  frameBorderRadius: 16,
  hostHeaderHeight: null,
  fullscreenMode: 'canvas-expand',
};

export function resolveWhiteboardHostChrome(
  partial?: WhiteboardHostChromeConfig | null): ResolvedWhiteboardHostChrome {
  if (partial === null || partial === undefined) {
    return DEFAULT_WHITEBOARD_HOST_CHROME;
  }
  return {
    frameWidthPercent: clampPercent(partial.frameWidthPercent ?? DEFAULT_WHITEBOARD_HOST_CHROME.frameWidthPercent),
    frameEdgeMargin: clampEdgeMargin(partial.frameEdgeMargin ?? DEFAULT_WHITEBOARD_HOST_CHROME.frameEdgeMargin),
    frameBorder: partial.frameBorder ?? DEFAULT_WHITEBOARD_HOST_CHROME.frameBorder,
    frameBorderRadius: partial.frameBorderRadius ?? DEFAULT_WHITEBOARD_HOST_CHROME.frameBorderRadius,
    hostHeaderHeight: partial.hostHeaderHeight ?? DEFAULT_WHITEBOARD_HOST_CHROME.hostHeaderHeight,
    fullscreenMode: partial.fullscreenMode ?? DEFAULT_WHITEBOARD_HOST_CHROME.fullscreenMode,
  };
}

export function resolveCareerHostChrome(
  partial?: WhiteboardHostChromeConfig | null): ResolvedWhiteboardHostChrome {
  return resolveWhiteboardHostChrome({...DEFAULT_CAREER_HOST_CHROME,...partial,
  });
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(100, Math.max(50, value));
}

function clampEdgeMargin(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(12, Math.max(0, value));
}
