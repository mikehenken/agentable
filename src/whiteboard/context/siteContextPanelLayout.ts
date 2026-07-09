/**
 * Site context panel layout — initial site-open grid and in-context insertion.
 *
 * Arranges chat, brief, preview, and file-manager inside the blue site frame
 * without overlap. Files uses a narrow column; primary panels flow horizontally.
 */
import type { Editor, TLShapeId } from 'tldraw';
import {
  CONTEXT_FRAME_PADDING,
  contextGroupFrameId,
  type ResolvedSiteContextGroup,
  resolveSiteContextFromSelection,
  resolveSiteIdFromPanelData,
  findSiteContextGroupForShape,
} from './contextGroupApi';
import {
  findNonOverlappingPosition,
  GRID_SIZE,
  snapRect,
  snapToGrid,
  type LayoutRect,
} from '../../canvas/panelLayoutEngine';

export const SITE_CONTEXT_PANEL_GAP = 16;
export const SITE_CONTEXT_VIEWPORT_INSET = 24;

/** Default widths — file-manager is intentionally narrow. */
export const SITE_CHAT_WIDTH = 400;
export const SITE_BRIEF_WIDTH = 380;
export const SITE_PREVIEW_WIDTH = 960;
export const SITE_PREVIEW_HEIGHT = 720;
export const SITE_FILE_MANAGER_WIDTH = 280;
export const SITE_FILE_MANAGER_HEIGHT = 480;

export type SiteContextPanelKind =
  | 'chat'
  | 'project-brief'
  | 'web-preview'
  | 'file-manager';

export interface SiteContextPanelSpec {
  panelId: SiteContextPanelKind;
  w: number;
  h: number;
}

export interface SiteContextLayoutAnchor {
  x: number;
  y: number;
  maxWidth: number;
  maxHeight: number;
}

export interface SiteContextLayoutOptions {
  includeChat?: boolean;
  includeBrief?: boolean;
  includePreview?: boolean;
  includeFiles?: boolean;
  gap?: number;
  snapGrid?: boolean;
}

export interface SiteContextPanelPlacement {
  panelId: SiteContextPanelKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

function panelHeightsForViewport(maxHeight: number): {
  chatH: number;
  briefH: number;
} {
  const tall = Math.max(480, maxHeight);
  const briefH = Math.max(520, maxHeight);
  return {
    chatH: snapToGrid(tall),
    briefH: snapToGrid(briefH),
  };
}

/**
 * Compute initial panel positions for a site context group open.
 *
 * Layout:
 *   Row 1 (horizontal): [Chat?] [Brief] [Preview]
 *   Row 2 (vertical stack under brief): [Files narrow]
 *
 * All coordinates are page-space, grid-snapped when enabled.
 */
export function computeInitialSiteContextLayout(
  anchor: SiteContextLayoutAnchor,
  options: SiteContextLayoutOptions = {},
): SiteContextPanelPlacement[] {
  const {
    includeChat = false,
    includeBrief = true,
    includePreview = true,
    includeFiles = true,
    gap = SITE_CONTEXT_PANEL_GAP,
    snapGrid = true,
  } = options;

  const { chatH, briefH } = panelHeightsForViewport(anchor.maxHeight);
  const originX = snapGrid ? snapToGrid(anchor.x) : anchor.x;
  const originY = snapGrid ? snapToGrid(anchor.y) : anchor.y;

  const placements: SiteContextPanelPlacement[] = [];
  let cursorX = originX;
  let briefX = originX;
  let briefY = originY;
  let briefPlaced = false;

  if (includeChat) {
    const rect = snapGrid
      ? snapRect({ x: cursorX, y: originY, w: SITE_CHAT_WIDTH, h: chatH })
      : { x: cursorX, y: originY, w: SITE_CHAT_WIDTH, h: chatH };
    placements.push({ panelId: 'chat', ...rect });
    cursorX += rect.w + gap;
  }

  if (includeBrief) {
    const rect = snapGrid
      ? snapRect({ x: cursorX, y: originY, w: SITE_BRIEF_WIDTH, h: briefH })
      : { x: cursorX, y: originY, w: SITE_BRIEF_WIDTH, h: briefH };
    placements.push({ panelId: 'project-brief', ...rect });
    briefX = rect.x;
    briefY = rect.y;
    briefPlaced = true;
    cursorX += rect.w + gap;
  }

  if (includePreview) {
    const previewH = snapGrid ? snapToGrid(SITE_PREVIEW_HEIGHT) : SITE_PREVIEW_HEIGHT;
    const rect = snapGrid
      ? snapRect({ x: cursorX, y: originY, w: SITE_PREVIEW_WIDTH, h: previewH })
      : { x: cursorX, y: originY, w: SITE_PREVIEW_WIDTH, h: previewH };
    placements.push({ panelId: 'web-preview', ...rect });
    cursorX += rect.w + gap;
  }

  if (includeFiles) {
    const filesY = briefPlaced
      ? briefY + (snapGrid ? snapToGrid(briefH) : briefH) + gap
      : originY;
    const filesX = briefPlaced ? briefX : cursorX;
    const rect = snapGrid
      ? snapRect({
          x: filesX,
          y: filesY,
          w: SITE_FILE_MANAGER_WIDTH,
          h: SITE_FILE_MANAGER_HEIGHT,
        })
      : {
          x: filesX,
          y: filesY,
          w: SITE_FILE_MANAGER_WIDTH,
          h: SITE_FILE_MANAGER_HEIGHT,
        };
    placements.push({ panelId: 'file-manager', ...rect });
  }

  return placements;
}

function getPanelObstaclesInFrame(editor: Editor, frameId: TLShapeId): LayoutRect[] {
  const obstacles: LayoutRect[] = [];
  const childIds = editor.getSortedChildIdsForParent(frameId);
  for (const childId of childIds) {
    const shape = editor.getShape(childId);
    if (!shape || shape.type !== 'panel') continue;
    const bounds = editor.getShapePageBounds(childId);
    if (!bounds) continue;
    obstacles.push({ x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h });
  }
  return obstacles;
}

/**
 * Resolve the site context group a new panel should join.
 * Priority: explicit siteId on panel props → unified selection → any selected shape's site.
 */
export function resolveInsertionSiteContext(
  editor: Editor,
  panelProps?: Record<string, unknown>,
): ResolvedSiteContextGroup | null {
  const siteIdFromProps = resolveSiteIdFromPanelData(panelProps);
  if (siteIdFromProps) {
    const frameId = contextGroupFrameId({ kind: 'site', id: siteIdFromProps });
    const frame = editor.getShape(frameId);
    const fromSelection = resolveSiteContextFromSelection(editor);
    if (fromSelection?.siteId === siteIdFromProps) {
      return fromSelection;
    }
    if (frame) {
      const name = (frame.props as { name?: unknown }).name;
      const label =
        typeof name === 'string' && name.trim() ? name.trim() : `Site ${siteIdFromProps.slice(0, 8)}`;
      return { siteId: siteIdFromProps, frameId, label };
    }
    return {
      siteId: siteIdFromProps,
      frameId,
      label: `Site ${siteIdFromProps.slice(0, 8)}`,
    };
  }

  const fromSelection = resolveSiteContextFromSelection(editor);
  if (fromSelection) return fromSelection;

  for (const shapeId of editor.getSelectedShapeIds()) {
    const ctx = findSiteContextGroupForShape(editor, shapeId);
    if (ctx) return ctx;
  }

  return null;
}

/** Default size hints per panel kind for in-context insertion. */
export function defaultSitePanelSize(panelId: string): { w: number; h: number } {
  switch (panelId) {
    case 'chat':
      return { w: SITE_CHAT_WIDTH, h: 520 };
    case 'project-brief':
      return { w: SITE_BRIEF_WIDTH, h: 560 };
    case 'web-preview':
      return { w: SITE_PREVIEW_WIDTH, h: SITE_PREVIEW_HEIGHT };
    case 'file-manager':
      return { w: SITE_FILE_MANAGER_WIDTH, h: SITE_FILE_MANAGER_HEIGHT };
    default:
      return { w: 480, h: 540 };
  }
}

/**
 * Find a non-overlapping page position for a panel inside (or beside) a site context frame.
 */
export function computePanelPlacementInSiteContext(
  editor: Editor,
  context: ResolvedSiteContextGroup,
  size: { w: number; h: number },
  options: { snapGrid?: boolean } = {},
): { x: number; y: number } {
  const snapGrid = options.snapGrid ?? true;
  const frameBounds = editor.getShapePageBounds(context.frameId);
  const innerPadding = Math.max(GRID_SIZE, Math.floor(CONTEXT_FRAME_PADDING / 2));

  if (!frameBounds) {
    const viewport = editor.getViewportPageBounds();
    return findNonOverlappingPosition(size.w, size.h, [], {
      left: viewport.x + SITE_CONTEXT_VIEWPORT_INSET,
      top: viewport.y + SITE_CONTEXT_VIEWPORT_INSET,
      right: viewport.x + viewport.w - SITE_CONTEXT_VIEWPORT_INSET,
      bottom: viewport.y + viewport.h - SITE_CONTEXT_VIEWPORT_INSET,
      gap: SITE_CONTEXT_PANEL_GAP,
    }, { snapGrid });
  }

  const obstacles = getPanelObstaclesInFrame(editor, context.frameId);
  const viewport = {
    left: frameBounds.x + innerPadding,
    top: frameBounds.y + innerPadding,
    right: frameBounds.x + frameBounds.w - innerPadding,
    bottom: frameBounds.y + frameBounds.h - innerPadding,
    gap: SITE_CONTEXT_PANEL_GAP,
  };

  if (obstacles.length === 0) {
    const origin = snapGrid
      ? { x: snapToGrid(viewport.left), y: snapToGrid(viewport.top) }
      : { x: viewport.left, y: viewport.top };
    return origin;
  }

  return findNonOverlappingPosition(size.w, size.h, obstacles, viewport, { snapGrid });
}
