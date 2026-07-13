/**
 * Site workspace mode — zoom the site context frame to fill the viewport
 * after auto-arrange for an admin-page feel on canvas.
 */
import type { Editor } from 'tldraw';
import { contextGroupFrameId } from './contextGroupApi';
import { autoArrangeSiteContextPanels } from './siteContextAutoArrange';

/**
 * Screen-pixel margin kept around the site group when framing it in view.
 * Small so the group fills most of the viewport (minimal wasted margin).
 */
const WORKSPACE_VIEWPORT_INSET = 24;

/**
 * Upper bound on the resolved zoom. A real site group is ~1200px wide, so its
 * fit zoom on a normal monitor is ~1.1–1.9x; this cap only prevents a tiny
 * group from being magnified absurdly (avoids the 425%-style over-zoom) while
 * still letting the group fill the screen.
 */
const WORKSPACE_MAX_ZOOM = 2;

export interface SiteWorkspaceModeOptions {
  /** Run auto-arrange before zooming. Default true. */
  arrangeFirst?: boolean;
  /** Screen-pixel inset (margin) around the frame when zooming. Default 24. */
  inset?: number;
  /** Animate camera zoom. Default true. */
  animate?: boolean;
  /**
   * Upper bound on the resolved zoom so opening a compact site group frames it
   * comfortably instead of magnifying it. Default 2 (200%).
   */
  maxZoom?: number;
}

/**
 * Enter workspace mode for a site: optionally arrange panels, then zoom the
 * site context frame to comfortably FIT the whole group in the viewport.
 *
 * The zoom is a fit-to-bounds (with a small screen-pixel inset) that is capped
 * at `maxZoom` (default 100%) so a small group is never magnified to an
 * over-zoomed state, and a large group is scaled down to fit fully in view.
 */
export function enterSiteWorkspaceMode(
  editor: Editor,
  siteId: string,
  options: SiteWorkspaceModeOptions = {},
): boolean {
  const {
    arrangeFirst = true,
    inset = WORKSPACE_VIEWPORT_INSET,
    animate = true,
    maxZoom = WORKSPACE_MAX_ZOOM,
  } = options;

  const frameId = contextGroupFrameId({ kind: 'site', id: siteId });
  const frame = editor.getShape(frameId);
  if (!frame) return false;

  if (arrangeFirst) {
    autoArrangeSiteContextPanels(editor, siteId);
  }

  const bounds = editor.getShapePageBounds(frameId);
  if (!bounds || bounds.w <= 0 || bounds.h <= 0) return false;

  // Compute the fit zoom ourselves (screen px per page unit) so we can cap it.
  const screen = editor.getViewportScreenBounds();
  const usableW = Math.max(1, screen.w - inset * 2);
  const usableH = Math.max(1, screen.h - inset * 2);
  const fitZoom = Math.min(usableW / bounds.w, usableH / bounds.h);

  const { min: minZoom, max: maxCameraZoom } = getZoomLimits(editor);
  const targetZoom = Math.max(minZoom, Math.min(fitZoom, maxZoom, maxCameraZoom));

  editor.select(frameId);
  editor.zoomToBounds(bounds, {
    targetZoom,
    inset,
    animation: animate ? { duration: 400 } : undefined,
  });
  return true;
}

/** Camera zoom limits — tolerant of tldraw versions that expose them differently. */
function getZoomLimits(editor: Editor): { min: number; max: number } {
  const fallback = { min: 0.1, max: 8 };
  try {
    const constraints = editor.getCameraOptions?.();
    const steps = constraints?.zoomSteps;
    if (Array.isArray(steps) && steps.length > 0) {
      return { min: steps[0], max: steps[steps.length - 1] };
    }
  } catch {
    // Ignore — fall back to conservative defaults below.
  }
  return fallback;
}
