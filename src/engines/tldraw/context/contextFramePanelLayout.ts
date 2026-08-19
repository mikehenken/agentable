/**
 * Site context panel layout — initial site-open grid and in-context insertion.
 *
 * Arranges chat, brief, preview, and file-manager inside the blue site frame
 * on a 12-column grid without overlap. Files sit to the right of preview.
 * Chat (when docked) is placed flush-left outside the grid column flow.
 */
import type { Editor, TLShapeId } from 'tldraw';
import {
  CONTEXT_FRAME_PADDING,
  contextGroupFrameId,
  type ResolvedContextFrameGroup,
  resolveContextFrameFromSelection,
  resolveContextIdFromPanelData,
  findContextFrameGroupForShape,
} from './contextGroupApi';
import {
  GRID_SIZE,
  snapToGrid,
  type LayoutRect,
} from '../../../layout/panelLayoutEngine';
import {
  createGridSpec,
  findNextGridSlot,
  getPanelGridSpan,
  getReferenceGridSpec,
  gridPlacementToRect,
  gridSpanToSize,
  GRID_COLUMNS,
  GRID_GUTTER,
  markGridOccupancy,
  type GridCellPlacement,
  type GridSpec,
} from '../../../layout/gridLayout';
import { computeResponsiveWhiteboardPanelSize } from '../layout/responsiveWhiteboardLayout';

export const SITE_CONTEXT_PANEL_GAP = GRID_GUTTER;
export const SITE_CONTEXT_VIEWPORT_INSET = 24;

const refGrid = getReferenceGridSpec();

/** Default widths — derived from 12-column grid spans at reference width. */
export const SITE_CHAT_WIDTH = gridSpanToSize(refGrid, getPanelGridSpan('chat')).w;
export const SITE_BRIEF_WIDTH = gridSpanToSize(refGrid, getPanelGridSpan('project-brief')).w;
export const SITE_PREVIEW_WIDTH = gridSpanToSize(refGrid, getPanelGridSpan('web-preview')).w;
export const SITE_PREVIEW_HEIGHT = gridSpanToSize(refGrid, getPanelGridSpan('web-preview')).h;
export const SITE_FILE_MANAGER_WIDTH = gridSpanToSize(refGrid, getPanelGridSpan('file-manager')).w;
export const SITE_FILE_MANAGER_HEIGHT = gridSpanToSize(refGrid, getPanelGridSpan('file-manager')).h;

export type ContextFramePanelKind =
  | 'chat'
  | 'project-brief'
  | 'web-preview'
  | 'file-manager';

export interface ContextFramePanelSpec {
  panelId: ContextFramePanelKind;
  w: number;
  h: number;
}

export interface ContextFrameLayoutAnchor {
  x: number;
  y: number;
  maxWidth: number;
  maxHeight: number;
}

export interface ContextFrameLayoutOptions {
  includeChat?: boolean;
  includeBrief?: boolean;
  includePreview?: boolean;
  includeFiles?: boolean;
  /** When true, chat is docked flush-left and does not consume grid columns. */
  dockChatLeft?: boolean;
  gap?: number;
  snapGrid?: boolean;
}

export interface ContextFramePanelPlacement {
  panelId: ContextFramePanelKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface InitialGridSlot {
  panelId: ContextFramePanelKind;
  placement: GridCellPlacement;
}

/**
 * Fixed initial layout on the 12-column grid (chat excluded when dockChatLeft):
 *   Row 0: [Brief? 3] [Preview flex] [Files 3]
 */
function buildInitialGridSlots(options: {
  includeChat: boolean;
  includeBrief: boolean;
  includePreview: boolean;
  includeFiles: boolean;
  dockChatLeft: boolean;
}): InitialGridSlot[] {
  const { includeChat, includeBrief, includePreview, includeFiles, dockChatLeft } = options;
  const slots: InitialGridSlot[] = [];

  let col = 0;

  if (includeChat && !dockChatLeft) {
    const chatSpan = getPanelGridSpan('chat');
    slots.push({
      panelId: 'chat',
      placement: { col, row: 0, colSpan: chatSpan.colSpan, rowSpan: chatSpan.rowSpan },
    });
    col += chatSpan.colSpan;
  }

  if (includeBrief) {
    const briefSpan = getPanelGridSpan('project-brief');
    slots.push({
      panelId: 'project-brief',
      placement: { col, row: 0, colSpan: briefSpan.colSpan, rowSpan: briefSpan.rowSpan },
    });
    col += briefSpan.colSpan;
  }

  const filesSpan = getPanelGridSpan('file-manager');
  const filesCol = includeFiles ? GRID_COLUMNS - filesSpan.colSpan : GRID_COLUMNS;

  if (includePreview) {
    const previewSpan = getPanelGridSpan('web-preview');
    const endCol = includeFiles ? filesCol : GRID_COLUMNS;
    const maxAvailable = endCol - col;
    const colSpan = includeFiles
      ? maxAvailable: Math.max(previewSpan.colSpan, maxAvailable);
    slots.push({
      panelId: 'web-preview',
      placement: { col, row: 0, colSpan, rowSpan: previewSpan.rowSpan },
    });
  }

  if (includeFiles) {
    slots.push({
      panelId: 'file-manager',
      placement: { col: filesCol, row: 0, colSpan: filesSpan.colSpan, rowSpan: filesSpan.rowSpan },
    });
  }

  return slots;
}

function placementFromGridSlot(
  spec: GridSpec,
  origin: { x: number; y: number },
  slot: InitialGridSlot,
  snapGrid: boolean): ContextFramePanelPlacement {
  const rect = gridPlacementToRect(spec, origin, slot.placement, snapGrid);
  return { panelId: slot.panelId, ...rect };
}

/**
 * Compute initial panel positions for a site context group open.
 *
 * All coordinates are page-space, snapped to the 20px grid when enabled.
 * Panel heights are capped by row spans — never stretched to viewport height.
 */
export function computeInitialContextFrameLayout(
  anchor: ContextFrameLayoutAnchor,
  options: ContextFrameLayoutOptions = {}): ContextFramePanelPlacement[] {
  const {
    includeChat = false,
    includeBrief = true,
    includePreview = true,
    includeFiles = true,
    dockChatLeft = false,
    gap = SITE_CONTEXT_PANEL_GAP,
    snapGrid = true,
  } = options;

  const originX = snapGrid ? snapToGrid(anchor.x) : anchor.x;
  const originY = snapGrid ? snapToGrid(anchor.y) : anchor.y;
  const placements: ContextFramePanelPlacement[] = [];

  let gridOriginX = originX;
  let gridMaxWidth = anchor.maxWidth;

  if (includeChat && dockChatLeft) {
    const fullSpec = createGridSpec(anchor.maxWidth, gap);
    const chatSpan = getPanelGridSpan('chat');
    const chatSize = gridSpanToSize(fullSpec, chatSpan, snapGrid);
    placements.push({
      panelId: 'chat',
      x: originX,
      y: originY,
      w: chatSize.w,
      h: chatSize.h,
    });
    gridOriginX = originX + chatSize.w + gap;
    gridMaxWidth = Math.max(GRID_COLUMNS * GRID_SIZE, anchor.maxWidth - chatSize.w - gap);
  }

  const spec = createGridSpec(gridMaxWidth, gap);
  const gridOrigin = { x: gridOriginX, y: originY };

  const slots = buildInitialGridSlots({
    includeChat,
    includeBrief,
    includePreview,
    includeFiles,
    dockChatLeft,
  });

  for (const slot of slots) {
    placements.push(placementFromGridSlot(spec, gridOrigin, slot, snapGrid));
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
export function resolveInsertionContextFrame(
  editor: Editor,
  panelProps?: Record<string, unknown>): ResolvedContextFrameGroup | null {
  const siteIdFromProps = resolveContextIdFromPanelData(panelProps);
  if (siteIdFromProps) {
    const frameId = contextGroupFrameId({ kind: 'site', id: siteIdFromProps });
    const frame = editor.getShape(frameId);
    const fromSelection = resolveContextFrameFromSelection(editor);
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

  const fromSelection = resolveContextFrameFromSelection(editor);
  if (fromSelection) return fromSelection;

  for (const shapeId of editor.getSelectedShapeIds()) {
    const ctx = findContextFrameGroupForShape(editor, shapeId);
    if (ctx) return ctx;
  }

  return null;
}

/** Default size hints per panel kind — from grid spans, not viewport height. */
export function defaultSitePanelSize(panelId: string): { w: number; h: number } {
  const spec = getReferenceGridSpec();
  const span = getPanelGridSpan(panelId);
  return gridSpanToSize(spec, span);
}

/**
 * Viewport-aware default panel size for career / Archipelago whiteboard embeds.
 * Scales with viewport tier (mobile / tablet / desktop) via
 * `computeResponsiveWhiteboardPanelSize`.
 */
export function defaultWhiteboardPanelSize(
  editor: Editor,
  panelId: string): { w: number; h: number } {
  const viewport = editor.getViewportPageBounds();
  return computeResponsiveWhiteboardPanelSize({
    viewportWidth: viewport.w,
    viewportHeight: viewport.h,
    panelId,
  });
}

/**
 * Find a non-overlapping page position for a panel inside a site context frame
 * using the 12-column grid.
 */
export function computePanelPlacementInContextFrame(
  editor: Editor,
  context: ResolvedContextFrameGroup,
  size: { w: number; h: number },
  options: { snapGrid?: boolean; panelId?: string } = {}): { x: number; y: number } {
  const snapGrid = options.snapGrid ?? true;
  const frameBounds = editor.getShapePageBounds(context.frameId);
  const innerPadding = Math.max(GRID_SIZE, Math.floor(CONTEXT_FRAME_PADDING / 2));

  if (!frameBounds) {
    const viewport = editor.getViewportPageBounds();
    const origin = {
      x: viewport.x + SITE_CONTEXT_VIEWPORT_INSET,
      y: viewport.y + SITE_CONTEXT_VIEWPORT_INSET,
    };
    const spec = createGridSpec(viewport.w - SITE_CONTEXT_VIEWPORT_INSET * 2);
    const span = options.panelId
      ? getPanelGridSpan(options.panelId): inferSpanFromSize(spec, size);
    const slot = findNextGridSlot(spec, new Set(), span.colSpan, span.rowSpan);
    if (!slot) {
      return snapGrid
        ? { x: snapToGrid(origin.x), y: snapToGrid(origin.y) }: origin;
    }
    const rect = gridPlacementToRect(spec, origin, slot, snapGrid);
    return { x: rect.x, y: rect.y };
  }

  const innerLeft = frameBounds.x + innerPadding;
  const innerTop = frameBounds.y + innerPadding;
  const innerWidth = Math.max(
    GRID_COLUMNS * GRID_SIZE,
    frameBounds.w - innerPadding * 2);
  const origin = {
    x: snapGrid ? snapToGrid(innerLeft) : innerLeft,
    y: snapGrid ? snapToGrid(innerTop) : innerTop,
  };

  const spec = createGridSpec(innerWidth);
  const obstacles = getPanelObstaclesInFrame(editor, context.frameId);
  const occupied = new Set<string>();
  for (const obstacle of obstacles) {
    markGridOccupancy(occupied, spec, origin, obstacle);
  }

  const span = options.panelId
    ? getPanelGridSpan(options.panelId): inferSpanFromSize(spec, size);

  const slot =
    findNextGridSlot(spec, occupied, span.colSpan, span.rowSpan) ??
    findNextGridSlot(spec, occupied, span.colSpan, span.rowSpan, 96);

  if (!slot) {
    return origin;
  }

  const rect = gridPlacementToRect(spec, origin, slot, snapGrid);
  return { x: rect.x, y: rect.y };
}

/** Infer nearest grid span from a pixel size (for unknown panel kinds). */
function inferSpanFromSize(
  spec: GridSpec,
  size: { w: number; h: number }): { colSpan: number; rowSpan: number } {
  const cellStrideX = spec.colWidth + spec.gutter;
  const cellStrideY = spec.rowHeight + spec.gutter;
  const colSpan = Math.min(
    GRID_COLUMNS,
    Math.max(1, Math.round(size.w / cellStrideX)));
  const rowSpan = Math.max(1, Math.round(size.h / cellStrideY));
  return { colSpan, rowSpan };
}

export {
  GRID_COLUMNS,
  GRID_ROW_HEIGHT,
  GRID_GUTTER,
  getPanelGridSpan,
  createGridSpec,
} from '../../../layout/gridLayout';
