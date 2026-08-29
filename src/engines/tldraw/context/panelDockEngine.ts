/**
 * Panel dock engine — flush (gap=0) docking to context frames and sibling panels.
 *
 * Distinct from GRID_GUTTER (16px): docking uses gap=0 for admin-style shells.
 * Dock state persists on shape.meta.panelDock and cascades on resize.
 */
import { createShapeId, type Editor, type TLShape, type TLShapeId } from 'tldraw';
import { GRID_SIZE, type LayoutRect } from '../../../layout/panelLayoutEngine';
import { GRID_GUTTER } from '../../../layout/gridLayout';
import {
  CONTEXT_FRAME_PADDING,
  findContextFrameGroupForShape,
  getContextGroupMeta,
} from './contextGroupApi';
import type { ContextFramePanelKind } from './contextFramePanelLayout';
import type { PanelShape } from '../shapes/PanelShape';

export type PanelDockTarget = 'group' | 'panel' | 'canvas';
export type PanelDockEdge = 'left' | 'right' | 'top' | 'bottom';

/**
 * Type alias (not interface) on purpose: aliases get an implicit index
 * signature, so PanelDock is assignable to tldraw's JsonValue shape meta.
 */
export type PanelDock = {
  target: PanelDockTarget;
  targetId?: TLShapeId;
  edge: PanelDockEdge;
  /** Gap on docked edges — 0 for flush frame/sibling docks; GRID_GUTTER only for free grid. */
  gap: number;
  /** Stretch panel height to the site frame inner bounds (chat left-edge dock). */
  fillHeight?: boolean;
};

export const PANEL_DOCK_META_KEY = 'panelDock';
export const DOCK_HIT_THRESHOLD = 12;

export interface DockTreeNode {
  panelId: ContextFramePanelKind;
  dock: PanelDock;
  w: number;
  h: number;
}

interface DockZone {
  dock: PanelDock;
  rect: LayoutRect;
}

/** Active dock target while dragging — drives edge highlight overlay. */
export interface DockZoneHighlight {
  edge: PanelDockEdge;
  /** Page-space segment endpoints for the glow line. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function isPanelDock(value: unknown): value is PanelDock {
  if (!value || typeof value !== 'object') return false;
  const raw = value as PanelDock;
  const validTarget = raw.target === 'group' || raw.target === 'panel' || raw.target === 'canvas';
  const validEdge =
    raw.edge === 'left' ||
    raw.edge === 'right' ||
    raw.edge === 'top' ||
    raw.edge === 'bottom';
  return validTarget && validEdge && typeof raw.gap === 'number';
}

export function getPanelDock(shape: TLShape | null | undefined): PanelDock | null {
  if (!shape?.meta) return null;
  const raw = shape.meta[PANEL_DOCK_META_KEY];
  return isPanelDock(raw) ? raw : null;
}

export function setPanelDock(editor: Editor, shapeId: TLShapeId, dock: PanelDock | null): void {
  const shape = editor.getShape(shapeId);
  if (!shape || shape.type !== 'panel') return;
  const nextMeta = { ...(shape.meta ?? {}) };
  if (dock) {
    nextMeta[PANEL_DOCK_META_KEY] = dock;
  } else {
    delete nextMeta[PANEL_DOCK_META_KEY];
  }
  editor.updateShape({
    id: shapeId,
    type: shape.type,
    meta: nextMeta,
  });
}

function frameInnerPadding(): number {
  // Matches CONTEXT_FRAME_PADDING so docked panels reach the group inner edge
  // with no gap (0 when the frame padding is 0).
  return Math.max(0, Math.floor(CONTEXT_FRAME_PADDING / 2));
}

function getShapePageRect(editor: Editor, shapeId: TLShapeId): LayoutRect | null {
  const bounds = editor.getShapePageBounds(shapeId);
  if (!bounds) return null;
  return { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h };
}

/** Page-space inner bounds of a context frame (inset by frame padding). */
export function getFrameInnerRect(editor: Editor, frameId: TLShapeId): LayoutRect | null {
  const frameRect = getShapePageRect(editor, frameId);
  if (!frameRect) return null;
  const pad = frameInnerPadding();
  return {
    x: frameRect.x + pad,
    y: frameRect.y + pad,
    w: Math.max(0, frameRect.w - pad * 2),
    h: Math.max(0, frameRect.h - pad * 2),
  };
}

function dockEdgeSegment(rect: LayoutRect, edge: PanelDockEdge): DockZoneHighlight {
  switch (edge) {
    case 'left':
      return { edge, x1: rect.x, y1: rect.y, x2: rect.x, y2: rect.y + rect.h };
    case 'right':
      return {
        edge,
        x1: rect.x + rect.w,
        y1: rect.y,
        x2: rect.x + rect.w,
        y2: rect.y + rect.h,
      };
    case 'top':
      return { edge, x1: rect.x, y1: rect.y, x2: rect.x + rect.w, y2: rect.y };
    case 'bottom':
      return {
        edge,
        x1: rect.x,
        y1: rect.y + rect.h,
        x2: rect.x + rect.w,
        y2: rect.y + rect.h,
      };
    default: {
      const _exhaustive: never = edge;
      return _exhaustive;
    }
  }
}

function distanceToRectEdge(
  point: { x: number; y: number },
  rect: LayoutRect,
  edge: PanelDockEdge,
): number {
  switch (edge) {
    case 'left':
      return Math.abs(point.x - rect.x);
    case 'right':
      return Math.abs(point.x - (rect.x + rect.w));
    case 'top':
      return Math.abs(point.y - rect.y);
    case 'bottom':
      return Math.abs(point.y - (rect.y + rect.h));
    default: {
      const _exhaustive: never = edge;
      return _exhaustive;
    }
  }
}

function isPointNearRectEdge(
  point: { x: number; y: number },
  rect: LayoutRect,
  edge: PanelDockEdge,
  threshold: number,
): boolean {
  const dist = distanceToRectEdge(point, rect, edge);
  if (dist > threshold) return false;
  if (edge === 'left' || edge === 'right') {
    return point.y >= rect.y - threshold && point.y <= rect.y + rect.h + threshold;
  }
  return point.x >= rect.x - threshold && point.x <= rect.x + rect.w + threshold;
}

function buildDockZonesForFrame(editor: Editor, frameId: TLShapeId): DockZone[] {
  const frameRect = getShapePageRect(editor, frameId);
  if (!frameRect) return [];
  const pad = frameInnerPadding();
  const inner: LayoutRect = {
    x: frameRect.x + pad,
    y: frameRect.y + pad,
    w: Math.max(0, frameRect.w - pad * 2),
    h: Math.max(0, frameRect.h - pad * 2),
  };
  return [
    { dock: { target: 'group', targetId: frameId, edge: 'left', gap: 0 }, rect: inner },
    { dock: { target: 'group', targetId: frameId, edge: 'right', gap: 0 }, rect: inner },
    { dock: { target: 'group', targetId: frameId, edge: 'top', gap: 0 }, rect: inner },
    { dock: { target: 'group', targetId: frameId, edge: 'bottom', gap: 0 }, rect: inner },
  ];
}

function buildDockZonesForSibling(
  editor: Editor,
  siblingId: TLShapeId,
): DockZone[] {
  const rect = getShapePageRect(editor, siblingId);
  if (!rect) return [];
  return [
    { dock: { target: 'panel', targetId: siblingId, edge: 'left', gap: 0 }, rect },
    { dock: { target: 'panel', targetId: siblingId, edge: 'right', gap: 0 }, rect },
    { dock: { target: 'panel', targetId: siblingId, edge: 'top', gap: 0 }, rect },
    { dock: { target: 'panel', targetId: siblingId, edge: 'bottom', gap: 0 }, rect },
  ];
}

/**
 * Hit-test dock zones (~12px) when the user drops a panel after drag.
 * Uses the dragged panel bounds (not just cursor) for edge proximity.
 * Prefers sibling panel edges over frame edges.
 */
export function hitTestPanelDock(
  editor: Editor,
  draggedShapeId: TLShapeId,
  pagePoint: { x: number; y: number },
  threshold: number = DOCK_HIT_THRESHOLD,
): PanelDock | null {
  const highlight = previewPanelDockHighlight(editor, draggedShapeId, pagePoint, threshold);
  return highlight?.dock ?? null;
}

/**
 * Preview dock target + edge highlight while dragging.
 * Returns null when the panel is not near any dock zone.
 */
export function previewPanelDockHighlight(
  editor: Editor,
  draggedShapeId: TLShapeId,
  pagePoint: { x: number; y: number },
  threshold: number = DOCK_HIT_THRESHOLD,
): { dock: PanelDock; highlight: DockZoneHighlight } | null {
  const ctx = findContextFrameGroupForShape(editor, draggedShapeId);
  if (!ctx) return null;

  const panelRect = getShapePageRect(editor, draggedShapeId);
  if (!panelRect) return null;

  const siblingZones: DockZone[] = [];
  for (const childId of editor.getSortedChildIdsForParent(ctx.frameId)) {
    if (childId === draggedShapeId) continue;
    const child = editor.getShape(childId);
    if (!child || child.type !== 'panel') continue;
    siblingZones.push(...buildDockZonesForSibling(editor, childId));
  }

  const frameZones = buildDockZonesForFrame(editor, ctx.frameId);

  type BestZone = { dock: PanelDock; dist: number; rect: LayoutRect };

  const pickBest = (zones: DockZone[], current: BestZone | null): BestZone | null => {
    let best = current;
    for (const zone of zones) {
      const nearCursor = isPointNearRectEdge(pagePoint, zone.rect, zone.dock.edge, threshold);
      const nearPanelEdge = isPanelEdgeNearDockTarget(
        panelRect,
        zone.rect,
        zone.dock.edge,
        threshold,
      );
      if (!nearCursor && !nearPanelEdge) continue;
      const dist = distanceToRectEdge(pagePoint, zone.rect, zone.dock.edge);
      if (!best || dist < best.dist) {
        best = { dock: zone.dock, dist, rect: zone.rect };
      }
    }
    return best;
  };

  let best = pickBest(siblingZones, null);
  if (!best) {
    best = pickBest(frameZones, null);
  }

  if (!best) return null;
  return {
    dock: best.dock,
    highlight: dockEdgeSegment(best.rect, best.dock.edge),
  };
}

function isPanelEdgeNearDockTarget(
  panelRect: LayoutRect,
  targetRect: LayoutRect,
  edge: PanelDockEdge,
  threshold: number,
): boolean {
  switch (edge) {
    case 'left': {
      const panelLeft = panelRect.x;
      const targetLeft = targetRect.x;
      return (
        Math.abs(panelLeft - targetLeft) <= threshold &&
        panelRect.y + panelRect.h > targetRect.y - threshold &&
        panelRect.y < targetRect.y + targetRect.h + threshold
      );
    }
    case 'right': {
      const panelRight = panelRect.x + panelRect.w;
      const targetRight = targetRect.x + targetRect.w;
      return (
        Math.abs(panelRight - targetRight) <= threshold &&
        panelRect.y + panelRect.h > targetRect.y - threshold &&
        panelRect.y < targetRect.y + targetRect.h + threshold
      );
    }
    case 'top': {
      const panelTop = panelRect.y;
      const targetTop = targetRect.y;
      return (
        Math.abs(panelTop - targetTop) <= threshold &&
        panelRect.x + panelRect.w > targetRect.x - threshold &&
        panelRect.x < targetRect.x + targetRect.w + threshold
      );
    }
    case 'bottom': {
      const panelBottom = panelRect.y + panelRect.h;
      const targetBottom = targetRect.y + targetRect.h;
      return (
        Math.abs(panelBottom - targetBottom) <= threshold &&
        panelRect.x + panelRect.w > targetRect.x - threshold &&
        panelRect.x < targetRect.x + targetRect.w + threshold
      );
    }
    default: {
      const _exhaustive: never = edge;
      return _exhaustive;
    }
  }
}

export interface ResolvedDockPlacement {
  x: number;
  y: number;
  w?: number;
  h?: number;
}

/**
 * Resolve page position for a panel with a fixed size given its dock attachment.
 */
export function resolveDock(
  editor: Editor,
  dock: PanelDock,
  size: { w: number; h: number },
  resolvedTargets: Map<TLShapeId, LayoutRect> = new Map(),
): ResolvedDockPlacement | null {
  if (dock.target === 'canvas') {
    const viewport = editor.getViewportPageBounds();
    const inset = 24;
    switch (dock.edge) {
      case 'left':
        return { x: viewport.x + inset + dock.gap, y: viewport.y + inset + dock.gap };
      case 'top':
        return { x: viewport.x + inset + dock.gap, y: viewport.y + inset + dock.gap };
      case 'right':
        return {
          x: viewport.x + viewport.w - inset - size.w - dock.gap,
          y: viewport.y + inset + dock.gap,
        };
      case 'bottom':
        return {
          x: viewport.x + inset + dock.gap,
          y: viewport.y + viewport.h - inset - size.h - dock.gap,
        };
      default: {
        const _exhaustive: never = dock.edge;
        return _exhaustive;
      }
    }
  }

  if (dock.target === 'group' && dock.targetId) {
    const inner = getFrameInnerRect(editor, dock.targetId);
    if (!inner) return null;

    const innerRight = inner.x + inner.w;
    const innerBottom = inner.y + inner.h;
    const fillHeight = dock.fillHeight === true;
    const verticalGap = dock.gap;
    const resolvedH = fillHeight ? Math.max(0, inner.h - verticalGap * 2) : size.h;

    switch (dock.edge) {
      case 'left':
        return {
          x: inner.x + dock.gap,
          y: inner.y + verticalGap,
          h: fillHeight ? resolvedH : undefined,
        };
      case 'top':
        return { x: inner.x + dock.gap, y: inner.y + dock.gap };
      case 'right':
        return {
          x: innerRight - size.w - dock.gap,
          y: inner.y + verticalGap,
          h: fillHeight ? resolvedH : undefined,
        };
      case 'bottom':
        return {
          x: inner.x + dock.gap,
          y: innerBottom - size.h - dock.gap,
        };
      default: {
        const _exhaustive: never = dock.edge;
        return _exhaustive;
      }
    }
  }

  if (dock.target === 'panel' && dock.targetId) {
    const targetRect =
      resolvedTargets.get(dock.targetId) ?? getShapePageRect(editor, dock.targetId);
    if (!targetRect) return null;

    switch (dock.edge) {
      case 'left':
        return {
          x: targetRect.x - size.w - dock.gap,
          y: targetRect.y,
        };
      case 'right':
        return {
          x: targetRect.x + targetRect.w + dock.gap,
          y: targetRect.y,
        };
      case 'top':
        return {
          x: targetRect.x,
          y: targetRect.y - size.h - dock.gap,
        };
      case 'bottom':
        return {
          x: targetRect.x,
          y: targetRect.y + targetRect.h + dock.gap,
        };
      default: {
        const _exhaustive: never = dock.edge;
        return _exhaustive;
      }
    }
  }

  return null;
}

export interface DockTreePlacement {
  panelId: ContextFramePanelKind;
  shapeId: TLShapeId;
  x: number;
  y: number;
  w: number;
  h: number;
  dock: PanelDock;
}

/**
 * Apply a dock to one panel — persists meta, resolves position/size, updates shape.
 */
export function applyPanelDock(editor: Editor, shapeId: TLShapeId, dock: PanelDock): boolean {
  const shape = editor.getShape(shapeId);
  if (!shape || shape.type !== 'panel') return false;
  const props = shape.props as { w: number; h: number };
  const resolved = resolveDock(editor, dock, { w: props.w, h: props.h });
  if (!resolved) return false;

  setPanelDock(editor, shapeId, dock);
  editor.updateShape({
    id: shapeId,
    type: 'panel',
    x: resolved.x,
    y: resolved.y,
    props: {
      ...props,
      w: resolved.w ?? props.w,
      h: resolved.h ?? props.h,
    },
  });
  return true;
}

/**
 * Resolve an ordered dock tree — later nodes can reference earlier panel targets.
 */
export function resolveDockTree(
  editor: Editor,
  frameId: TLShapeId,
  nodes: DockTreeNode[],
): DockTreePlacement[] {
  const resolvedRects = new Map<TLShapeId, LayoutRect>();
  const placements: DockTreePlacement[] = [];

  for (const node of nodes) {
    const shapeId = createShapeId(`panel:${node.panelId}`);
    const pos = resolveDock(editor, node.dock, { w: node.w, h: node.h }, resolvedRects);
    if (!pos) continue;

    const rect: LayoutRect = {
      x: pos.x,
      y: pos.y,
      w: pos.w ?? node.w,
      h: pos.h ?? node.h,
    };
    resolvedRects.set(shapeId, rect);
    placements.push({
      panelId: node.panelId,
      shapeId,
      x: pos.x,
      y: pos.y,
      w: rect.w,
      h: rect.h,
      dock: node.dock,
    });
  }

  // Unused frameId keeps API stable for callers that pass site context frame.
  void frameId;
  return placements;
}

/** Collect panels in a site frame that have dock metadata. */
export function collectDockedPanelsInFrame(
  editor: Editor,
  frameId: TLShapeId,
): Array<{ shapeId: TLShapeId; panelId: string; dock: PanelDock }> {
  const result: Array<{ shapeId: TLShapeId; panelId: string; dock: PanelDock }> = [];
  for (const childId of editor.getSortedChildIdsForParent(frameId)) {
    const shape = editor.getShape(childId);
    if (!shape || shape.type !== 'panel') continue;
    const dock = getPanelDock(shape);
    if (!dock) continue;
    const panelId = (shape.props as { panelId?: unknown }).panelId;
    if (typeof panelId !== 'string') continue;
    result.push({ shapeId: childId, panelId, dock });
  }
  return result;
}

/** Re-resolve all docked panels in a frame after a resize or dock change. */
export function cascadeDockedPanelsInFrame(editor: Editor, frameId: TLShapeId): void {
  const meta = getContextGroupMeta(editor.getShape(frameId));
  if (meta?.kind !== 'site') return;

  const docked = collectDockedPanelsInFrame(editor, frameId);
  if (docked.length === 0) return;

  const nodes: DockTreeNode[] = [];
  for (const entry of docked) {
    const shape = editor.getShape(entry.shapeId);
    if (!shape || shape.type !== 'panel') continue;
    const w = (shape.props as { w: number }).w;
    const h = (shape.props as { h: number }).h;
    if (!isSitePanelKind(entry.panelId)) continue;
    nodes.push({
      panelId: entry.panelId,
      dock: entry.dock,
      w,
      h,
    });
  }

  const ordered = sortDockNodesByDependency(nodes);
  const placements = resolveDockTree(editor, frameId, ordered);
  const frame = editor.getShape(frameId);
  for (const placement of placements) {
    const shape = editor.getShape(placement.shapeId);
    if (!shape) continue;
    const props = shape.props as { w: number; h: number };
    // resolveDock works in page space, but docked panels are children of the
    // frame, so their x/y are interpreted in the frame's local space. Convert
    // the page point into the frame's space; writing raw page coords as local
    // would offset the panel by the frame's page position (chat flying off).
    const local =
      frame && shape.parentId === frameId
        ? editor.getPointInShapeSpace(frame, { x: placement.x, y: placement.y })
        : { x: placement.x, y: placement.y };
    editor.updateShape({
      id: placement.shapeId,
      type: 'panel',
      x: local.x,
      y: local.y,
      props: {
        ...props,
        w: placement.w ?? props.w,
        h: placement.h ?? props.h,
      },
    });
  }
}

/**
 * True while a programmatic reflow is writing panel geometry. Store listeners
 * (auto-resize, dock cascade) skip reflow-driven churn to avoid redundant fits.
 * Correctness never depends on this — reflow settles at a fixed point where the
 * content bbox already equals the frame — it only reduces jitter/extra work.
 */
let reflowInProgress = false;

/** True while `reflowContextFrameRow` is applying panel geometry. */
export function isReflowInProgress(): boolean {
  return reflowInProgress;
}

/**
 * Reflow the site context row so docked panels track the frame and the centered
 * web-preview keeps SYMMETRIC gutters on both inner sides.
 *
 * 1. Edge-docked panels (chat → left, files → right) snap flush to the frame
 *    inner edges at full inner height (via `cascadeDockedPanelsInFrame`) — so
 *    they follow both horizontal and vertical GROUP resizes.
 * 2. The non-docked web-preview fills the space between the docked neighbours,
 *    inset by one `GRID_GUTTER` on each side, at full inner height. Spacing is
 *    then chat | gutter | preview | gutter | files (equal inner gutters).
 *
 * Safe to run on GROUP/frame resize: it only moves/sizes CHILD panels to match
 * the frame's current inner bounds and never resizes the frame itself, so the
 * result is a fixed point (content bbox == frame) instead of a fill↔fit runaway.
 */
export function reflowContextFrameRow(editor: Editor, frameId: TLShapeId): void {
  const frame = editor.getShape(frameId);
  if (getContextGroupMeta(frame)?.kind !== 'site') return;

  reflowInProgress = true;
  try {
    editor.run(() => {
      // Snap edge-docked panels flush + full height against the current frame.
      cascadeDockedPanelsInFrame(editor, frameId);

      const inner = getFrameInnerRect(editor, frameId);
      const frameShape = editor.getShape(frameId);
      if (!inner || !frameShape) return;

      // Gather panel rects (post-cascade, so docked panels are already flush).
      const panelRects: Array<{ panelId: string; rect: LayoutRect }> = [];
      let previewId: TLShapeId | null = null;
      let previewProps: PanelShape['props'] | null = null;
      let previewRectNow: LayoutRect | null = null;

      for (const childId of editor.getSortedChildIdsForParent(frameId)) {
        const shape = editor.getShape(childId);
        if (!shape || shape.type !== 'panel') continue;
        const rect = getShapePageRect(editor, childId);
        if (!rect) continue;
        const panelId = shape.props.panelId;
        if (panelId === 'web-preview') {
          previewId = childId;
          previewProps = shape.props;
          previewRectNow = rect;
          continue;
        }
        panelRects.push({ panelId, rect });
      }

      if (!previewId || !previewProps || !previewRectNow) return;

      // Classify every other panel as a left- or right-neighbour of the preview
      // by its horizontal centre. Preview then fills the span between the
      // nearest neighbour on each side with one GRID_GUTTER of breathing room,
      // giving equal gutters (chat|preview and preview|files) and never
      // overlapping a middle panel (e.g. brief in onboarding).
      const previewCenterX = previewRectNow.x + previewRectNow.w / 2;
      let leftBound = inner.x;
      let rightBound = inner.x + inner.w;
      let hasLeftNeighbour = false;
      let hasRightNeighbour = false;

      for (const { rect } of panelRects) {
        const centerX = rect.x + rect.w / 2;
        if (centerX <= previewCenterX) {
          hasLeftNeighbour = true;
          leftBound = Math.max(leftBound, rect.x + rect.w);
        } else {
          hasRightNeighbour = true;
          rightBound = Math.min(rightBound, rect.x);
        }
      }

      const previewX = hasLeftNeighbour ? leftBound + GRID_GUTTER : inner.x;
      const previewRight = hasRightNeighbour ? rightBound - GRID_GUTTER : inner.x + inner.w;
      const previewW = Math.max(GRID_SIZE, previewRight - previewX);

      const previewShape = editor.getShape(previewId);
      const local =
        previewShape && previewShape.parentId === frameId
          ? editor.getPointInShapeSpace(frameShape, { x: previewX, y: inner.y })
          : { x: previewX, y: inner.y };

      editor.updateShape({
        id: previewId,
        type: 'panel',
        x: local.x,
        y: local.y,
        props: { ...previewProps, w: previewW, h: inner.h },
      });
    });
  } finally {
    reflowInProgress = false;
  }
}

function sortDockNodesByDependency(nodes: DockTreeNode[]): DockTreeNode[] {
  const panelIds = new Set(nodes.map((n) => n.panelId));
  const sorted: DockTreeNode[] = [];
  const placed = new Set<ContextFramePanelKind>();

  let guard = 0;
  while (sorted.length < nodes.length && guard <= nodes.length * nodes.length) {
    guard += 1;
    for (const node of nodes) {
      if (placed.has(node.panelId)) continue;

      if (node.dock.target === 'group' || node.dock.target === 'canvas') {
        sorted.push(node);
        placed.add(node.panelId);
        continue;
      }

      if (node.dock.target === 'panel' && node.dock.targetId) {
        const targetShape = editorShapeIdToPanelId(node.dock.targetId);
        if (!targetShape || !panelIds.has(targetShape) || placed.has(targetShape)) {
          sorted.push(node);
          placed.add(node.panelId);
        }
      }
    }
  }

  return sorted.length === nodes.length ? sorted : nodes;
}

function editorShapeIdToPanelId(shapeId: TLShapeId): ContextFramePanelKind | null {
  const prefix = 'shape:panel:';
  if (!String(shapeId).startsWith(prefix)) return null;
  const panelId = String(shapeId).slice(prefix.length);
  return isSitePanelKind(panelId) ? panelId : null;
}

function isSitePanelKind(value: string): value is ContextFramePanelKind {
  return (
    value === 'chat' ||
    value === 'project-brief' ||
    value === 'web-preview' ||
    value === 'file-manager'
  );
}
