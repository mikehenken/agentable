/**

 * Panel layout engine — viewport-aware placement with guaranteed non-overlap.

 *

 * Used by layoutStore (absolute-positioned canvas) and panelShapeApi

 * (whiteboard shapes). All placement paths funnel through these helpers so

 * agent-opened panels never stack on top of each other.

 */

import type { PanelLayout } from "../types";

export interface LayoutRect {
  x: number;

  y: number;

  w: number;

  h: number;
}

export interface ViewportLayoutConfig {
  left: number;

  top: number;

  right: number;

  bottom: number;

  gap: number;
}

export interface ViewportLayoutOptions {
  viewportWidth: number;

  viewportHeight: number;

  /** Mirrors NavSidebar expanded width for content-left inset. */

  navSidebarExpanded?: boolean;

  topBarHeight?: number;

  bottomBarHeight?: number;

  sideMargin?: number;

  gap?: number;
}

export interface PlacementOptions {
  snapGrid?: boolean;
}

/** Matches the 20px dot grid in CanvasShell backgroundSize. */

export const GRID_SIZE = 20;

const DEFAULT_TOPBAR_H = 56;

const DEFAULT_BOTTOMBAR_H = 72;

const DEFAULT_SIDE_MARGIN = 12;

const DEFAULT_GAP = GRID_SIZE;

const MINIMIZED_PANEL_H = 44;

/** Breakpoints for responsive auto-organize column counts. */

const MOBILE_BP = 640;

/** Viewport width at which NavSidebar starts expanded (matches auto-organize tablet tier). */
export const TABLET_BP = 1024;

/** True when the nav sidebar should start expanded for the given container width. */
export function shouldExpandNavSidebar(viewportWidth: number): boolean {
  return viewportWidth >= TABLET_BP;
}

export function snapToGrid(
  value: number,
  gridSize: number = GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize;
}

export function snapRect(
  rect: LayoutRect,

  gridSize: number = GRID_SIZE): LayoutRect {
  return {
    x: snapToGrid(rect.x, gridSize),

    y: snapToGrid(rect.y, gridSize),

    w: Math.max(gridSize, snapToGrid(rect.w, gridSize)),

    h: Math.max(gridSize, snapToGrid(rect.h, gridSize)),
  };
}

export function clampRectToViewport(
  rect: LayoutRect,

  viewport: ViewportLayoutConfig,

  minW: number = GRID_SIZE,

  minH: number = GRID_SIZE): LayoutRect {
  const { w: clampedW, h: clampedH } = clampPanelSize(
    rect.w,

    rect.h,

    minW,

    minH,

    viewport);

  const x = Math.max(
    viewport.left,
    Math.min(rect.x, viewport.right - clampedW),
  );
  const y = Math.max(
    viewport.top,
    Math.min(rect.y, viewport.bottom - clampedH),
  );
  return { x, y, w: clampedW, h: clampedH };
}

export function getViewportLayoutConfig(
  options: ViewportLayoutOptions): ViewportLayoutConfig {
  const {
    viewportWidth,

    viewportHeight,

    navSidebarExpanded = false,

    topBarHeight = DEFAULT_TOPBAR_H,

    bottomBarHeight = DEFAULT_BOTTOMBAR_H,

    sideMargin = DEFAULT_SIDE_MARGIN,

    gap = DEFAULT_GAP,
  } = options;

  const navW = navSidebarExpanded
    ? NAV_SIDEBAR_W_EXPANDED: NAV_SIDEBAR_W_COLLAPSED;

  const contentLeft = NAV_SIDEBAR_X + navW + gap;

  return {
    left: contentLeft,

    top: topBarHeight,

    right: viewportWidth - sideMargin,

    bottom: viewportHeight - bottomBarHeight,

    gap,
  };
}

export function panelLayoutToRect(panel: PanelLayout): LayoutRect {
  const minimized = panel.minimized ?? false;

  return {
    x: panel.x ?? 0,

    y: panel.y ?? 0,

    w: panel.w ?? 400,

    h: minimized ? MINIMIZED_PANEL_H: (panel.h ?? 300),
  };
}

export function rectsOverlap(
  a: LayoutRect,
  b: LayoutRect,
  gap: number): boolean {
  return !(
    a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y
  );
}

export function clampPanelSize(
  desiredW: number,

  desiredH: number,

  minW: number,

  minH: number,

  viewport: ViewportLayoutConfig): { w: number; h: number } {
  const maxW = Math.max(minW, viewport.right - viewport.left);

  const maxH = Math.max(minH, viewport.bottom - viewport.top);

  return {
    w: Math.max(minW, Math.min(desiredW, maxW)),

    h: Math.max(minH, Math.min(desiredH, maxH)),
  };
}

function candidateFitsViewport(
  x: number,

  y: number,

  w: number,

  h: number,

  viewport: ViewportLayoutConfig): boolean {
  return (
    x >= viewport.left &&
    y >= viewport.top &&
    x + w <= viewport.right &&
    y + h <= viewport.bottom
  );
}

function hasOverlapWithObstacles(
  candidate: LayoutRect,

  obstacles: LayoutRect[],

  gap: number): boolean {
  return obstacles.some((obstacle) => rectsOverlap(candidate, obstacle, gap));
}

function computeColumnWidth(
  contentWidth: number,
  columns: number,
  gap: number,
  snapGrid: boolean): number {
  const rawColumnWidth = Math.floor(
    (contentWidth - gap * (columns - 1)) / columns);
  return snapGrid
    ? Math.max(GRID_SIZE, snapToGrid(rawColumnWidth)): Math.max(280, rawColumnWidth);
}

/**
 * Snap x/y to the grid when enabled, then verify the rect still fits and
 * does not overlap obstacles. Nudges down/right on the grid when snap would
 * collapse distinct slots onto the same cell.
 */
function snapPositionAvoidingOverlap(
  x: number,
  y: number,
  w: number,
  h: number,
  obstacles: LayoutRect[],
  viewport: ViewportLayoutConfig,
  snapGrid: boolean): { x: number; y: number } {
  if (!snapGrid) {
    return { x, y };
  }

  const maxX = viewport.right - w;
  const maxY = viewport.bottom - h;
  let candidate = snapRect({ x, y, w, h });
  let guard = 0;
  const maxIterations = 500;

  while (guard < maxIterations) {
    if (
      candidateFitsViewport(candidate.x, candidate.y, w, h, viewport) &&
      !hasOverlapWithObstacles(candidate, obstacles, viewport.gap)
    ) {
      return { x: candidate.x, y: candidate.y };
    }

    candidate = {
      x: candidate.x,
      y: candidate.y + GRID_SIZE,
      w,
      h,
    };

    if (candidate.y > maxY) {
      candidate = {
        x: candidate.x + GRID_SIZE,
        y: snapToGrid(viewport.top),
        w,
        h,
      };

      if (candidate.x > maxX) {
        candidate = {
          x: snapToGrid(viewport.left),
          y: snapToGrid(viewport.top),
          w,
          h,
        };
      }
    }

    candidate = snapRect(candidate);
    guard += 1;
  }

  return snapGrid
    ? { x: snapToGrid(x), y: snapToGrid(y) }: { x, y };
}

function tryPlacementAt(
  x: number,
  y: number,
  w: number,
  h: number,
  obstacles: LayoutRect[],
  viewport: ViewportLayoutConfig,
  snapGrid: boolean): { x: number; y: number } | null {
  const candidate: LayoutRect = { x, y, w, h };

  if (!candidateFitsViewport(x, y, w, h, viewport)) {
    return null;
  }

  if (hasOverlapWithObstacles(candidate, obstacles, viewport.gap)) {
    return null;
  }

  if (snapGrid) {
    const snapped = snapRect(candidate);
    if (
      candidateFitsViewport(snapped.x, snapped.y, w, h, viewport) &&
      !hasOverlapWithObstacles(snapped, obstacles, viewport.gap)
    ) {
      return { x: snapped.x, y: snapped.y };
    }
  }

  return { x, y };
}

function findBesideObstaclePositions(
  w: number,
  h: number,
  obstacles: LayoutRect[],
  viewport: ViewportLayoutConfig,
  snapGrid: boolean): { x: number; y: number } | null {
  const { gap } = viewport;
  const candidates: Array<{ x: number; y: number }> = [];

  for (const obstacle of obstacles) {
    candidates.push(
      { x: obstacle.x + obstacle.w + gap, y: obstacle.y },
      { x: obstacle.x + obstacle.w + gap, y: viewport.top },
      { x: viewport.left, y: obstacle.y + obstacle.h + gap });
  }

  candidates.sort((a, b) => a.y - b.y || a.x - b.x);

  for (const candidate of candidates) {
    const placed = tryPlacementAt(
      candidate.x,
      candidate.y,
      w,
      h,
      obstacles,
      viewport,
      snapGrid);
    if (placed) {
      return placed;
    }
  }

  return null;
}

/** Diagonal step when cascading past a packed viewport (keeps origins distinct). */
const CASCADE_STEP = GRID_SIZE * 2;

/**
 * Place below/beside obstacles without requiring the rect to fit the viewport.
 * Prefer stacking under the bottommost obstacle; fall back to a diagonal cascade.
 * Off-screen is acceptable (user can pan) — overlapping is not.
 */
function findCascadePastObstacles(
  w: number,
  h: number,
  obstacles: LayoutRect[],
  viewport: ViewportLayoutConfig,
  snapGrid: boolean): { x: number; y: number } {
  const { gap, left } = viewport;

  /** Snap without rounding Y down into an obstacle (use ceil on Y when needed). */
  const tryPoint = (x: number, y: number): { x: number; y: number } | null => {
    if (!snapGrid) {
      const candidate: LayoutRect = { x, y, w, h };
      return hasOverlapWithObstacles(candidate, obstacles, gap)
        ? null: { x, y };
    }

    const snappedX = snapToGrid(x);
    const roundedY = snapToGrid(y);
    const ceilY = Math.ceil(y / GRID_SIZE) * GRID_SIZE;
    for (const snappedY of [roundedY, ceilY]) {
      const candidate: LayoutRect = { x: snappedX, y: snappedY, w, h };
      if (!hasOverlapWithObstacles(candidate, obstacles, gap)) {
        return { x: snappedX, y: snappedY };
      }
    }
    return null;
  };

  if (obstacles.length === 0) {
    return tryPoint(left, viewport.top) ?? { x: left, y: viewport.top };
  }

  const stackY = Math.max(...obstacles.map((o) => o.y + o.h)) + gap;
  const atLeft = tryPoint(left, stackY);
  if (atLeft) {
    return atLeft;
  }

   // Try right of the rightmost obstacle on a new row under the pack.
  const rightmost = obstacles.reduce((max, o) =>
    o.x + o.w > max.x + max.w ? o: max);
  const besideX = rightmost.x + rightmost.w + gap;
  const beside = tryPoint(besideX, stackY);
  if (beside) {
    return beside;
  }

  let x = left;
  let y = viewport.top;
  const maxGuard = Math.max(80, obstacles.length * 16);
  for (let i = 0; i < maxGuard; i += 1) {
    const placed = tryPoint(x, y);
    if (placed) {
      return placed;
    }
    x += CASCADE_STEP;
    y += CASCADE_STEP;
    if (x + w > viewport.right + CASCADE_STEP * 4) {
      x = left + (i % 8) * CASCADE_STEP;
      y = stackY + (Math.floor(i / 8) + 1) * CASCADE_STEP;
    }
  }

  const n = obstacles.length;
  return (
    tryPoint(left + n * CASCADE_STEP, stackY + n * CASCADE_STEP) ?? {
      x: snapGrid ? snapToGrid(left + n * CASCADE_STEP): left + n * CASCADE_STEP,
      y: snapGrid
        ? Math.ceil((stackY + n * CASCADE_STEP) / GRID_SIZE) * GRID_SIZE: stackY + n * CASCADE_STEP,
    }
  );
}

/**
 * Place below existing panels within the viewport. Scans row-by-row so a tall
 * panel beside shorter obstacles still lands in the first open slot.
 * When the free canvas is packed, cascades past obstacles (may be off-screen)
 * instead of stacking multiple panels on the same origin.
 */
function findStackBelowPosition(
  w: number,

  h: number,

  obstacles: LayoutRect[],

  viewport: ViewportLayoutConfig,

  snapGrid: boolean): { x: number; y: number } {
  const { gap, left } = viewport;

  const maxX = viewport.right - w;
  const maxY = viewport.bottom - h;

  const startY =
    obstacles.length === 0
      ? viewport.top: Math.max(...obstacles.map((o) => o.y + o.h + gap));

  const scanStep = snapGrid ? GRID_SIZE: gap;

  if (maxX >= left && maxY >= viewport.top) {
    for (let y = Math.min(startY, maxY); y <= maxY; y += scanStep) {
      for (let x = left; x <= maxX; x += scanStep) {
        const placed = tryPlacementAt(x, y, w, h, obstacles, viewport, snapGrid);
        if (placed) {
          return placed;
        }
      }
    }

    for (let y = viewport.top; y <= maxY; y += scanStep) {
      for (let x = left; x <= maxX; x += scanStep) {
        const placed = tryPlacementAt(x, y, w, h, obstacles, viewport, snapGrid);
        if (placed) {
          return placed;
        }
      }
    }

    const fallbackX = Math.max(left, viewport.right - w);
    const fallbackY = Math.max(viewport.top, maxY);

    const nudged = snapPositionAvoidingOverlap(
      fallbackX,
      fallbackY,
      w,
      h,
      obstacles,
      viewport,
      snapGrid);
    const nudgedRect: LayoutRect = { x: nudged.x, y: nudged.y, w, h };
    if (
      candidateFitsViewport(nudged.x, nudged.y, w, h, viewport) &&
      !hasOverlapWithObstacles(nudgedRect, obstacles, gap)
    ) {
      return nudged;
    }
  }

  return findCascadePastObstacles(w, h, obstacles, viewport, snapGrid);
}

/**

 * Find the first non-overlapping position for a panel.

 * Prefers on-screen slots (top-left scan), then stacks below visible panels.

 */

export function findNonOverlappingPosition(
  panelW: number,

  panelH: number,

  obstacles: LayoutRect[],

  viewport: ViewportLayoutConfig,

  options: PlacementOptions = {}): { x: number; y: number } {
  const snapGrid = options.snapGrid ?? false;

  const { gap } = viewport;

  const scanStep = snapGrid ? GRID_SIZE: gap;

  const maxX = viewport.right - panelW;

  const maxY = viewport.bottom - panelH;

  if (maxX >= viewport.left && maxY >= viewport.top) {
    for (let y = viewport.top; y <= maxY; y += scanStep) {
      for (let x = viewport.left; x <= maxX; x += scanStep) {
        const candidate: LayoutRect = { x, y, w: panelW, h: panelH };

        if (
          candidateFitsViewport(x, y, panelW, panelH, viewport) &&
          !hasOverlapWithObstacles(candidate, obstacles, gap)
        ) {
          const placed = tryPlacementAt(
            x,
            y,
            panelW,
            panelH,
            obstacles,
            viewport,
            snapGrid);
          if (placed) {
            return placed;
          }
        }
      }
    }
  }

  const beside = findBesideObstaclePositions(
    panelW,
    panelH,
    obstacles,
    viewport,
    snapGrid);
  if (beside) {
    return beside;
  }

  return findStackBelowPosition(panelW, panelH, obstacles, viewport, snapGrid);
}

export interface OrganizePanelInput {
  id: string;

  w: number;

  h: number;

  minW: number;

  minH: number;

  priority: number;
}

export interface OrganizedPanelLayout {
  x: number;

  y: number;

  w: number;

  h: number;
}

export interface OrganizeOptions {
  /** When true, align columns, positions, and row heights to GRID_SIZE. */

  snapGrid?: boolean;
}

function getResponsiveColumnCount(
  contentWidth: number,
  panels: OrganizePanelInput[],
  gap: number,
  snapGrid: boolean): number {
  let columns = 3;
  if (contentWidth < MOBILE_BP) columns = 1;
  else if (contentWidth < TABLET_BP) columns = 2;

  const maxMinW =
    panels.length > 0 ? Math.max(...panels.map((p) => p.minW)): 280;

  while (columns > 1) {
    const columnWidth = computeColumnWidth(contentWidth, columns, gap, snapGrid);
    if (columnWidth >= maxMinW) break;
    columns -= 1;
  }

  return columns;
}

/**

 * Flow visible panels into a responsive grid within the content viewport.

 * Positions are assigned sequentially so panels never overlap.

 */

export function organizePanelsResponsive(
  panels: OrganizePanelInput[],

  viewport: ViewportLayoutConfig,

  options: OrganizeOptions = {}): Record<string, OrganizedPanelLayout> {
  const snapGrid = options.snapGrid ?? false;

  const gap = snapGrid ? GRID_SIZE: viewport.gap;

  const { left, right, top, bottom } = viewport;

  const contentWidth = Math.max(gap, right - left);

  const maxColumns = getResponsiveColumnCount(contentWidth, panels, gap, snapGrid);

  const sorted = [...panels].sort((a, b) => a.priority - b.priority);

  const result: Record<string, OrganizedPanelLayout> = {};

  let rowY = snapGrid ? snapToGrid(top): top;

  let rowMaxH = 0;

  let colX = snapGrid ? snapToGrid(left): left;

  let colCount = 0;

  const maxContentH = bottom - top;

  for (const panel of sorted) {
    const rawW = Math.max(
      panel.minW,
      Math.min(panel.w, contentWidth),
    );
    const rawH = Math.max(
      panel.minH,
      Math.min(panel.h, maxContentH),
    );
    let w = snapGrid ? Math.max(GRID_SIZE, snapToGrid(rawW)): rawW;
    w = Math.min(w, contentWidth);

    let h = snapGrid ? Math.max(GRID_SIZE, snapToGrid(rawH)): rawH;
    h = Math.min(h, maxContentH);

    const wrapRow = (): void => {
      colCount = 0;
      rowY += rowMaxH + gap;
      if (snapGrid) rowY = snapToGrid(rowY);
      rowMaxH = 0;
      colX = snapGrid ? snapToGrid(left): left;
    };

    let candidateX = snapGrid ? snapToGrid(colX): colX;

    if (colCount > 0 && candidateX + w > right) {
      wrapRow();
      candidateX = snapGrid ? snapToGrid(colX): colX;
    }

    if (colCount >= maxColumns) {
      wrapRow();
      candidateX = snapGrid ? snapToGrid(colX): colX;
    }

    const remainingRowW = right - candidateX;
    if (w > remainingRowW) {
      if (remainingRowW < panel.minW) {
        wrapRow();
        candidateX = snapGrid ? snapToGrid(colX): colX;
      }
      w = Math.min(w, right - candidateX);
      if (snapGrid) w = Math.max(GRID_SIZE, snapToGrid(w));
      w = Math.max(panel.minW, w);
      w = Math.min(w, right - candidateX);
    }

    const x = snapGrid ? snapToGrid(colX): colX;

    const y = snapGrid ? snapToGrid(rowY): rowY;

    const availableH = Math.max(GRID_SIZE, bottom - y);
    let placedH = Math.min(h, availableH);
    if (snapGrid) {
      placedH = Math.max(GRID_SIZE, snapToGrid(placedH));
      placedH = Math.min(placedH, availableH);
    }

    result[panel.id] = { x, y, w, h: placedH };

    rowMaxH = Math.max(rowMaxH, placedH);

    colX += w + gap;

    colCount += 1;
  }

  return result;
}

export function getNavLayout(navSidebarExpanded: boolean): {
  x: number;
  y: number;
  w: number;
} {
  return {
    x: NAV_SIDEBAR_X,

    y: NAV_SIDEBAR_TOP,

    w: navSidebarExpanded ? NAV_SIDEBAR_W_EXPANDED: NAV_SIDEBAR_W_COLLAPSED,
  };
}

/** Chrome NavSidebar geometry (matches NavSidebar.tsx Tailwind classes). */

export const NAV_SIDEBAR_X = 12;

export const NAV_SIDEBAR_TOP = 64;

export const NAV_SIDEBAR_W_COLLAPSED = 44;

export const NAV_SIDEBAR_W_EXPANDED = 210;

/** Default nav item count when tenant count is unknown (matches DEFAULT_NAV_ITEMS). */
export const NAV_SIDEBAR_DEFAULT_ITEM_COUNT = 7;

/** Collapsed rail chrome (py-1.5 + expand btn + divider + py-1.5). */
const NAV_SIDEBAR_COLLAPSED_CHROME_H = 55;

/** Expanded header row + border (py-2.5 + border-b). */
const NAV_SIDEBAR_EXPANDED_HEADER_H = 37;

/** Per-item row height (py-2 + 18px icon). */
const NAV_SIDEBAR_ITEM_ROW_H = 34;

export const VOICE_DOCK_PANEL_H = 188;

export const VOICE_DOCK_PANEL_H_COLLAPSED = 168;

export interface VoiceDockOptions {
  navSidebarExpanded?: boolean;

  sidebarItemCount?: number;
}

export interface SidebarColumnOptions extends VoiceDockOptions {
  /** When true, include docked voice panel height in the column stack. */
  voiceVisible?: boolean;
}

/** Default width for the Assistant chat panel (compact beside sidebar column). */
export const DEFAULT_CHAT_WIDTH = 400;

export const DEFAULT_CHAT_MIN_WIDTH = 320;

export const DEFAULT_CHAT_MIN_HEIGHT = 280;

/**

 * Estimate remaining unobstructed canvas area after visible panels.

 * Used to decide whether voice should dock under the sidebar.

 */

export function computeFreeCanvasArea(
  panels: Record<string, PanelLayout>,

  viewport: ViewportLayoutConfig): number {
  const viewportArea =
    Math.max(0, viewport.right - viewport.left) *
    Math.max(0, viewport.bottom - viewport.top);
  let used = 0;

  for (const [id, panel] of Object.entries(panels)) {
    if (id === "nav" || !panel.visible) continue;

    const rect = panelLayoutToRect(panel);

    used += rect.w * rect.h;
  }

  return Math.max(0, viewportArea - used);
}

/**
 * Pixel height of NavSidebar chrome (matches NavSidebar.tsx Tailwind).
 */
export function computeNavSidebarHeight(
  navSidebarExpanded: boolean,
  itemCount: number = NAV_SIDEBAR_DEFAULT_ITEM_COUNT): number {
  const items = Math.max(0, itemCount);
  if (navSidebarExpanded) {
    return NAV_SIDEBAR_EXPANDED_HEADER_H + items * NAV_SIDEBAR_ITEM_ROW_H;
  }
  return NAV_SIDEBAR_COLLAPSED_CHROME_H + items * NAV_SIDEBAR_ITEM_ROW_H;
}

/** Dock voice whenever the panel is visible (sidebar footer slot geometry). */
export function shouldDockVoicePanel(
  _freeArea: number,
  voiceVisible: boolean): boolean {
  return voiceVisible;
}

/**
 * Layout rect for voice panel docked flush below the left NavSidebar chrome.
 */
export function getVoiceDockLayout(options: VoiceDockOptions = {}): LayoutRect {
  const expanded = options.navSidebarExpanded ?? false;
  const itemCount = options.sidebarItemCount ?? NAV_SIDEBAR_DEFAULT_ITEM_COUNT;
  const w = expanded ? NAV_SIDEBAR_W_EXPANDED: NAV_SIDEBAR_W_COLLAPSED;
  const sidebarH = computeNavSidebarHeight(expanded, itemCount);
  const y = NAV_SIDEBAR_TOP + sidebarH;

  return {
    x: NAV_SIDEBAR_X,
    y,
    w,
    h: expanded ? VOICE_DOCK_PANEL_H: VOICE_DOCK_PANEL_H_COLLAPSED,
  };
}

/**
 * Combined NavSidebar + optional docked voice column (x, y, w, h).
 * Reflects actual left chrome stack height (voice included only when visible).
 */
export function getSidebarColumnLayout(
  options: SidebarColumnOptions = {}): LayoutRect {
  const expanded = options.navSidebarExpanded ?? false;
  const itemCount = options.sidebarItemCount ?? NAV_SIDEBAR_DEFAULT_ITEM_COUNT;
  const voiceVisible = options.voiceVisible ?? false;
  const w = expanded ? NAV_SIDEBAR_W_EXPANDED: NAV_SIDEBAR_W_COLLAPSED;
  const sidebarH = computeNavSidebarHeight(expanded, itemCount);
  const voiceH = voiceVisible
    ? expanded
      ? VOICE_DOCK_PANEL_H: VOICE_DOCK_PANEL_H_COLLAPSED: 0;

  return {
    x: NAV_SIDEBAR_X,
    y: NAV_SIDEBAR_TOP,
    w,
    h: sidebarH + voiceH,
  };
}

/**
 * Target chat panel height: NavSidebar + voice dock column, always.
 * Used for default chat layout regardless of whether voice is currently visible.
 */
export function getChatColumnTargetHeight(
  navSidebarExpanded: boolean = false,
  itemCount: number = NAV_SIDEBAR_DEFAULT_ITEM_COUNT): number {
  const sidebarH = computeNavSidebarHeight(navSidebarExpanded, itemCount);
  const voiceH = navSidebarExpanded
    ? VOICE_DOCK_PANEL_H: VOICE_DOCK_PANEL_H_COLLAPSED;

  return sidebarH + voiceH;
}

export interface DefaultChatLayoutOptions {
  viewport: ViewportLayoutConfig;
  navSidebarExpanded?: boolean;
  sidebarItemCount?: number;
  snapGrid?: boolean;
}

/**
 * Default Assistant chat rect: content-left x, fixed sidebar+voice column height, compact width.
 */
export function getDefaultChatLayout(
  options: DefaultChatLayoutOptions): LayoutRect {
  const expanded = options.navSidebarExpanded ?? false;
  const itemCount = options.sidebarItemCount ?? NAV_SIDEBAR_DEFAULT_ITEM_COUNT;
  const targetH = getChatColumnTargetHeight(expanded, itemCount);

  let rect: LayoutRect = {
    x: options.viewport.left,
    y: NAV_SIDEBAR_TOP,
    w: DEFAULT_CHAT_WIDTH,
    h: targetH,
  };

  if (options.snapGrid) {
    rect = snapRect(rect);
  }

  return rect;
}

/**

 * Adjust pan so a panel's screen-space bounds fall within the viewport chrome.

 */

export function ensurePanelVisible(
  panelRect: LayoutRect,

  pan: { x: number; y: number },

  viewport: ViewportLayoutConfig): { x: number; y: number } {
  let panX = pan.x;

  let panY = pan.y;

  const screenLeft = panelRect.x + panX;

  const screenRight = panelRect.x + panelRect.w + panX;

  const screenTop = panelRect.y + panY;

  const screenBottom = panelRect.y + panelRect.h + panY;

  if (screenRight > viewport.right) {
    panX -= screenRight - viewport.right;
  }

  if (screenLeft < viewport.left) {
    panX += viewport.left - screenLeft;
  }

  if (screenBottom > viewport.bottom) {
    panY -= screenBottom - viewport.bottom;
  }

  if (screenTop < viewport.top) {
    panY += viewport.top - screenTop;
  }

  return { x: panX, y: panY };
}

export {
  DEFAULT_TOPBAR_H,
  DEFAULT_BOTTOMBAR_H,
  DEFAULT_GAP,
  MINIMIZED_PANEL_H,
};
