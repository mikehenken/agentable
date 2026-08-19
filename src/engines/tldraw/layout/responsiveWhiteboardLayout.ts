/**
 * Viewport-aware whiteboard panel sizing helpers (pure — unit-testable).
 * Used by `defaultWhiteboardPanelSize` and layout chrome (auto-arrange reset).
 */
import { GRID_SIZE, snapToGrid } from '../../../layout/panelLayoutEngine';
import { getWhiteboardListPanelIds } from './whiteboardLayoutConfig';

/** Mobile narrow embed breakpoint (matches panelLayoutEngine MOBILE_BP spirit). */
export const WHITEBOARD_MOBILE_BP = 640;
/** Tablet breakpoint — nav may expand. */
export const WHITEBOARD_TABLET_BP = 768;
/** Desktop breakpoint. */
export const WHITEBOARD_DESKTOP_BP = 1280;

export type WhiteboardViewportTier = 'mobile' | 'tablet' | 'desktop';

export function whiteboardViewportTier(width: number): WhiteboardViewportTier {
  if (width < WHITEBOARD_MOBILE_BP) return 'mobile';
  if (width < WHITEBOARD_DESKTOP_BP) return 'tablet';
  return 'desktop';
}

/** True when TopBar toolbar should use compact chrome (icon-only labels). */
export function shouldUseCompactWhiteboardChrome(viewportWidth: number): boolean {
  return viewportWidth < WHITEBOARD_TABLET_BP;
}

/**
 * True when NavSidebar should start expanded for the given container width.
 * Tablet+ matches career bounded UX (expanded Menu by default); mobile stays rail.
 */
export function shouldExpandWhiteboardNav(viewportWidth: number): boolean {
  return viewportWidth >= WHITEBOARD_TABLET_BP;
}

/**
 * @deprecated Use {@link getWhiteboardListPanelIds} — packs register list panel ids
 * via {@link configureWhiteboardLayoutHints}.
 */
export function getLegacyCareerListPanelIds(): ReadonlySet<string> {
  return getWhiteboardListPanelIds();
}

export interface ResponsivePanelSizeInput {
  viewportWidth: number;
  viewportHeight: number;
  panelId: string;
  /** Optional fallback when panel is not a career list chat. */
  fallback?: { w: number; h: number };
}

/**
 * Scale default panel geometry with viewport bounds.
 * Narrow (~390): chat nearly full-height strip; list panels use most of width.
 * Mid (~768) desktop (~1280): list panels ~36% width, chat ~32% strip.
 */
export function computeResponsiveWhiteboardPanelSize(
  input: ResponsivePanelSizeInput): { w: number; h: number } {
  const { viewportWidth, viewportHeight, panelId, fallback } = input;
  const inset = 24;
  const availW = Math.max(GRID_SIZE * 4, viewportWidth - inset * 2);
  const availH = Math.max(GRID_SIZE * 4, viewportHeight - inset * 2);
  const tier = whiteboardViewportTier(viewportWidth);

  if (panelId === 'chat') {
    if (tier === 'mobile') {
      return {
        w: snapToGrid(Math.min(availW * 0.92, Math.max(260, availW * 0.85))),
        h: snapToGrid(Math.max(280, availH * 0.7)),
      };
    }
    return {
      w: snapToGrid(Math.min(440, Math.max(380, availW * 0.34))),
      h: snapToGrid(Math.min(680, Math.max(480, availH * 0.74))),
    };
  }

  if (getWhiteboardListPanelIds().has(panelId)) {
    if (tier === 'mobile') {
      return {
        w: snapToGrid(Math.min(availW * 0.94, Math.max(260, availW * 0.9))),
        h: snapToGrid(Math.min(Math.max(availH * 0.65, 300), availH * 0.85)),
      };
    }
    if (tier === 'tablet') {
      return {
        w: snapToGrid(Math.min(Math.max(availW * 0.46, 400), 540)),
        h: snapToGrid(Math.min(Math.max(availH * 0.76, 420), 640)),
      };
    }
    return {
      w: snapToGrid(Math.min(Math.max(availW * 0.42, 420), 560)),
      h: snapToGrid(Math.min(Math.max(availH * 0.78, 480), 680)),
    };
  }

  if (fallback) {
    return {
      w: snapToGrid(fallback.w),
      h: snapToGrid(fallback.h),
    };
  }

  if (tier === 'mobile') {
    return {
      w: snapToGrid(Math.min(availW * 0.94, Math.max(260, availW * 0.9))),
      h: snapToGrid(Math.min(Math.max(availH * 0.65, 300), availH * 0.85)),
    };
  }
  if (tier === 'tablet') {
    return {
      w: snapToGrid(Math.min(Math.max(availW * 0.46, 400), 540)),
      h: snapToGrid(Math.min(Math.max(availH * 0.76, 420), 640)),
    };
  }

  return {
    w: snapToGrid(Math.min(Math.max(availW * 0.42, 420), 560)),
    h: snapToGrid(Math.min(Math.max(availH * 0.72, 480), 680)),
  };
}

/**
 * Nav rail width reserved when placing panels (collapsed icon rail vs expanded).
 */
export function whiteboardNavReserveWidth(viewportWidth: number, expanded: boolean): number {
  if (viewportWidth < WHITEBOARD_MOBILE_BP) {
    return expanded ? 180: 48;
  }
  return expanded ? 210: 56;
}

/** Page-space padding from viewport edges into free canvas. */
export const WHITEBOARD_VIEWPORT_INSET = 24;

export interface WhiteboardChromeInsets {
  /** Offset from viewport.x into free canvas (inset + nav rail). */
  left: number;
  /** Offset from viewport.y into free canvas. */
  top: number;
  /** Reserved nav overlay width in page space. */
  navReserve: number;
  navExpanded: boolean;
}

export interface ComputeWhiteboardChromeInsetsOptions {
  viewportWidth: number;
  /** Live NavSidebar expanded state (not merely preferred-by-width). */
  navExpanded: boolean;
  /** When false, skip nav rail reserve (nav overlay not shown). Default true. */
  showNavSidebar?: boolean;
  viewportInset?: number;
}

/**
 * Compute free-canvas insets so panels open beside the Menu overlay, not under it.
 * Expanded menu uses the full rail width; collapsed uses the icon-rail reserve.
 */
export function computeWhiteboardChromeInsets(
  options: ComputeWhiteboardChromeInsetsOptions): WhiteboardChromeInsets {
  const inset = options.viewportInset ?? WHITEBOARD_VIEWPORT_INSET;
  const showNav = options.showNavSidebar ?? true;
  const navReserve = showNav
    ? whiteboardNavReserveWidth(options.viewportWidth, options.navExpanded): 0;
  return {
    left: inset + navReserve,
    top: inset,
    navReserve,
    navExpanded: options.navExpanded,
  };
}
