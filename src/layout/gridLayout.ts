/**
 * 12-column grid layout for site context panels.
 *
 * Panels snap to column spans and row spans within a context frame.
 * Row height and gutter align with the whiteboard 20px snap grid.
 */
import { GRID_SIZE, snapRect, snapToGrid, type LayoutRect } from './panelLayoutEngine';

/** Standard column count for site context layouts. */
export const GRID_COLUMNS = 12;

/** Vertical grid unit — two 20px snap cells per row. */
export const GRID_ROW_HEIGHT = 40;

/** Horizontal/vertical gap between grid cells (matches site context panel gap). */
export const GRID_GUTTER = 16;

/** Reference container width for deriving default panel pixel sizes. */
export const GRID_REFERENCE_WIDTH = 1200;

export interface GridSpec {
  columns: number;
  rowHeight: number;
  gutter: number;
  colWidth: number;
}

export interface GridCellPlacement {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

export interface GridPanelSpan {
  colSpan: number;
  rowSpan: number;
}

/** Default column/row spans per site context panel kind. */
export const SITE_PANEL_GRID_SPANS: Record<string, GridPanelSpan> = {
  chat: { colSpan: 3, rowSpan: 6 },
  'project-brief': { colSpan: 3, rowSpan: 7 },
  // Preview drives the uniform row height. A taller span (≈720px) gives the
  // site group an aspect ratio close to the viewport so zoom-to-fit fills the
  // screen vertically too (not just horizontally) and the preview is readable.
  'web-preview': { colSpan: 6, rowSpan: 13 },
  'file-manager': { colSpan: 3, rowSpan: 4 },
  settings: { colSpan: 3, rowSpan: 6 },
  assets: { colSpan: 3, rowSpan: 6 },
};

const DEFAULT_PANEL_SPAN: GridPanelSpan = { colSpan: 3, rowSpan: 6 };

/**
 * Build a grid spec from the inner width of a site context frame.
 * Column width is fractional; pixel rects are snapped to GRID_SIZE.
 */
export function createGridSpec(
  containerWidth: number,
  gutter: number = GRID_GUTTER,
  columns: number = GRID_COLUMNS): GridSpec {
  const safeWidth = Math.max(columns * GRID_SIZE, containerWidth);
  const totalGutter = gutter * (columns - 1);
  const colWidth = (safeWidth - totalGutter) / columns;
  return {
    columns,
    rowHeight: GRID_ROW_HEIGHT,
    gutter,
    colWidth,
  };
}

/** Reference grid used for default panel width/height constants. */
export function getReferenceGridSpec(
  gutter: number = GRID_GUTTER): GridSpec {
  return createGridSpec(GRID_REFERENCE_WIDTH, gutter);
}

export function getPanelGridSpan(panelId: string): GridPanelSpan {
  return SITE_PANEL_GRID_SPANS[panelId] ?? DEFAULT_PANEL_SPAN;
}

/** Pixel width/height for a grid cell placement. */
export function gridSpanToSize(
  spec: GridSpec,
  span: GridPanelSpan,
  snapGrid: boolean = true): { w: number; h: number } {
  const w =
    span.colSpan * spec.colWidth + (span.colSpan - 1) * spec.gutter;
  const h =
    span.rowSpan * spec.rowHeight + (span.rowSpan - 1) * spec.gutter;
  if (!snapGrid) {
    return { w, h };
  }
  return {
    w: Math.max(GRID_SIZE, snapToGrid(w)),
    h: Math.max(GRID_SIZE, snapToGrid(h)),
  };
}

/** Page-space rect for a grid placement relative to an origin. */
export function gridPlacementToRect(
  spec: GridSpec,
  origin: { x: number; y: number },
  placement: GridCellPlacement,
  snapGrid: boolean = true): LayoutRect {
  const w =
    placement.colSpan * spec.colWidth + (placement.colSpan - 1) * spec.gutter;
  const h =
    placement.rowSpan * spec.rowHeight + (placement.rowSpan - 1) * spec.gutter;
  const x = origin.x + placement.col * (spec.colWidth + spec.gutter);
  const y = origin.y + placement.row * (spec.rowHeight + spec.gutter);
  const rect: LayoutRect = { x, y, w, h };
  return snapGrid ? snapRect(rect): rect;
}

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

/** Mark grid cells occupied by a page-space rect (relative to origin). */
export function markGridOccupancy(
  occupied: Set<string>,
  spec: GridSpec,
  origin: { x: number; y: number },
  rect: LayoutRect): void {
  const relX = rect.x - origin.x;
  const relY = rect.y - origin.y;
  const cellStrideX = spec.colWidth + spec.gutter;
  const cellStrideY = spec.rowHeight + spec.gutter;

  const startCol = Math.max(
    0,
    Math.floor(relX / cellStrideX));
  const endCol = Math.min(
    spec.columns - 1,
    Math.ceil((relX + rect.w) / cellStrideX));
  const startRow = Math.max(0, Math.floor(relY / cellStrideY));
  const endRow = Math.ceil((relY + rect.h) / cellStrideY);

  for (let row = startRow; row < endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      occupied.add(cellKey(col, row));
    }
  }
}

function placementFits(
  occupied: Set<string>,
  col: number,
  row: number,
  colSpan: number,
  rowSpan: number,
  maxColumns: number): boolean {
  if (col < 0 || col + colSpan > maxColumns) return false;
  for (let r = row; r < row + rowSpan; r += 1) {
    for (let c = col; c < col + colSpan; c += 1) {
      if (occupied.has(cellKey(c, r))) return false;
    }
  }
  return true;
}

/**
 * Find the first grid slot (scan row-major) that fits colSpan × rowSpan
 * without overlapping occupied cells.
 */
export function findNextGridSlot(
  spec: GridSpec,
  occupied: Set<string>,
  colSpan: number,
  rowSpan: number,
  maxRows: number = 48): GridCellPlacement | null {
  const maxCol = spec.columns - colSpan;
  if (maxCol < 0) return null;

  for (let row = 0; row < maxRows; row += 1) {
    for (let col = 0; col <= maxCol; col += 1) {
      if (placementFits(occupied, col, row, colSpan, rowSpan, spec.columns)) {
        return { col, row, colSpan, rowSpan };
      }
    }
  }
  return null;
}

/** Bounding box of all rects plus padding. */
export function boundingBoxOfRects(
  rects: LayoutRect[],
  padding: number = 0): LayoutRect | null {
  if (rects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const rect of rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.w);
    maxY = Math.max(maxY, rect.y + rect.h);
  }

  return {
    x: minX - padding,
    y: minY - padding,
    w: maxX - minX + 2 * padding,
    h: maxY - minY + 2 * padding,
  };
}

export function rectsOverlapWithGap(
  a: LayoutRect,
  b: LayoutRect,
  gap: number = GRID_GUTTER): boolean {
  return !(
    a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y
  );
}
