/**
 * Context group frames — visual tldraw `frame` shapes that group panels by
 * site or agency workspace. Uses native `fitFrameToContent` for bounds.
 */
import {
  Box,
  Vec,
  compact,
  createShapeId,
  fitFrameToContent,
  type Editor,
  type TLFrameShape,
  type TLShape,
  type TLShapeId,
  type TLShapePartial,
  type UnknownRecord,
} from 'tldraw';
import { GRID_SIZE, snapToGrid } from '../../canvas/panelLayoutEngine';
import { resolvePanelScope } from '../../panels/scope';
import { filterSiteContextPanelIds, isCanvasGlobalPanel } from './canvasGlobalPanels';

export type ContextGroupKind = 'site' | 'agency';

export interface ContextGroupRef {
  kind: ContextGroupKind;
  id: string;
  label: string;
  /** When set on a site group, nests the site frame under an agency frame. */
  agencyId?: string | null;
}

export interface AssignPanelsOptions {
  siteLabel?: string;
  agencyId?: string | null;
}

/**
 * Padding between a context frame's border and its panel content. Zero so
 * edge-docked panels (chat left, file-manager right) sit flush to the group
 * inner edges with no gap, matching the admin-shell default layout.
 */
export const CONTEXT_FRAME_PADDING = 0;

/** Minimum page-unit change before a preview resize is applied (reduces jitter). */
export const CONTEXT_FRAME_PREVIEW_MIN_DELTA = 12;

/** Maximum page-unit growth per preview tick (smooth frame expansion during drag). */
export const CONTEXT_FRAME_PREVIEW_MAX_DELTA = 56;

export type ContextGroupFitMode = 'preview' | 'final';

export interface FitContextGroupFrameOptions {
  /** `preview` = capped incremental growth while dragging; `final` = full snap fit. */
  mode?: ContextGroupFitMode;
  padding?: number;
  minDelta?: number;
  maxDeltaPerFrame?: number;
}

interface FrameContentTarget {
  w: number;
  h: number;
  dx: number;
  dy: number;
}

/** Meta key on tldraw frame shapes that group site/agency panels. */
export const CONTEXT_META_KEY = 'landiContextGroup';

export interface ContextGroupMeta {
  kind: ContextGroupKind;
  id: string;
}

export interface ResolvedSiteContextGroup {
  siteId: string;
  frameId: TLShapeId;
  label: string;
}

export function getContextGroupMeta(
  shape: { meta?: Record<string, unknown>; type?: string; props?: unknown } | null | undefined,
): ContextGroupMeta | null {
  if (!shape?.meta) return null;
  const raw = shape.meta[CONTEXT_META_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const kind = (raw as { kind?: unknown }).kind;
  const id = (raw as { id?: unknown }).id;
  if ((kind !== 'site' && kind !== 'agency') || typeof id !== 'string') return null;
  const trimmed = id.trim();
  if (!trimmed) return null;
  return { kind, id: trimmed };
}

function frameLabelFromShape(
  shape: { type: string; props: unknown } | null | undefined,
  fallback: string,
): string {
  if (!shape || shape.type !== 'frame') return fallback;
  const name = (shape.props as { name?: unknown }).name;
  return typeof name === 'string' && name.trim() ? name.trim() : fallback;
}

/** Walk parent chain (or panel data) to find the enclosing site context group. */
export function findSiteContextGroupForShape(
  editor: Editor,
  shapeId: TLShapeId,
): ResolvedSiteContextGroup | null {
  let currentId: TLShapeId | undefined = shapeId;

  while (currentId) {
    const shape = editor.getShape(currentId);
    if (!shape) break;

    const meta = getContextGroupMeta(shape);
    if (meta?.kind === 'site') {
      return {
        siteId: meta.id,
        frameId: shape.id,
        label: frameLabelFromShape(shape, `Site ${meta.id.slice(0, 8)}`),
      };
    }

    if (shape.type === 'panel') {
      const siteId = resolveSiteIdFromPanelData(
        (shape.props as { data?: Record<string, unknown> }).data,
      );
      if (siteId) {
        const frameId = contextGroupFrameId({ kind: 'site', id: siteId });
        const frame = editor.getShape(frameId);
        return {
          siteId,
          frameId,
          label: frameLabelFromShape(frame, `Site ${siteId.slice(0, 8)}`),
        };
      }
    }

    currentId = shape.parentId as TLShapeId | undefined;
  }

  return null;
}

/**
 * When every selected shape belongs to the same site context group, return that
 * group (toolbar anchors to the site frame bounds).
 */
export function resolveSiteContextFromSelection(editor: Editor): ResolvedSiteContextGroup | null {
  const selectedIds = editor.getSelectedShapeIds();
  if (selectedIds.length === 0) return null;

  const siteIds = new Set<string>();
  let resolved: ResolvedSiteContextGroup | null = null;

  for (const shapeId of selectedIds) {
    const ctx = findSiteContextGroupForShape(editor, shapeId);
    if (!ctx) return null;
    siteIds.add(ctx.siteId);
    resolved = ctx;
  }

  if (siteIds.size !== 1 || !resolved) return null;
  return resolved;
}

export function contextGroupFrameId(ref: Pick<ContextGroupRef, 'kind' | 'id'>): TLShapeId {
  return createShapeId(`context:${ref.kind}:${ref.id}`);
}

export function resolveSiteIdFromPanelData(
  data: Record<string, unknown> | undefined,
): string | null {
  if (!data) return null;
  // Typed scope first (contextId is the siteId on landi hosts), then the
  // plain siteId key host panels have always passed in panelProps.
  const siteId = resolvePanelScope(data).contextId ?? data.siteId;
  return typeof siteId === 'string' && siteId.trim().length > 0 ? siteId.trim() : null;
}

function inferCommonSiteId(editor: Editor, panelIds: string[]): string | null {
  const siteIds = new Set<string>();
  for (const panelId of panelIds) {
    const shape = editor.getShape(createShapeId(`panel:${panelId}`));
    if (!shape) continue;
    const data = (shape.props as { data?: Record<string, unknown> }).data;
    const siteId = resolveSiteIdFromPanelData(data);
    if (siteId) siteIds.add(siteId);
  }
  return siteIds.size === 1 ? [...siteIds][0] ?? null : null;
}

function snapFrameOrigin(editor: Editor, frameId: TLShapeId): void {
  const frame = editor.getShape(frameId);
  if (!frame || frame.type !== 'frame') return;
  editor.updateShape({
    id: frameId,
    type: 'frame',
    x: snapToGrid(frame.x),
    y: snapToGrid(frame.y),
  });
}

function isContextGroupFrame(
  editor: Editor,
  frameId: TLShapeId,
): ContextGroupMeta | null {
  const frame = editor.getShape(frameId);
  if (!frame || frame.type !== 'frame') return null;
  return getContextGroupMeta(frame);
}

/** Reparent a site-scoped panel into its site context frame when it drifted to the page. */
export function ensurePanelInSiteContextFrame(
  editor: Editor,
  panelShapeId: TLShapeId,
  frameId: TLShapeId,
): void {
  const panel = editor.getShape(panelShapeId);
  if (!panel || panel.type !== 'panel') return;
  const panelId = (panel.props as { panelId?: unknown }).panelId;
  if (typeof panelId === 'string' && isCanvasGlobalPanel(panelId)) return;
  if (panel.parentId === frameId) return;
  editor.reparentShapes([panelShapeId], frameId);
}

function computeFrameContentTarget(
  editor: Editor,
  frameId: TLShapeId,
  padding: number,
): FrameContentTarget | null {
  const frame = editor.getShape<TLFrameShape>(frameId);
  if (!frame || frame.type !== 'frame') return null;

  const childIds = editor.getSortedChildIdsForParent(frame.id);
  const children = compact(childIds.map((id) => editor.getShape(id)));
  if (children.length === 0) return null;

  const bounds = Box.FromPoints(
    children.flatMap((shape) => {
      const geometry = editor.getShapeGeometry(shape.id);
      const transform = editor.getShapeLocalTransform(shape);
      return transform?.applyToPoints(geometry.vertices) ?? [];
    }),
  );

  return {
    w: bounds.w + 2 * padding,
    h: bounds.h + 2 * padding,
    dx: padding - bounds.minX,
    dy: padding - bounds.minY,
  };
}

function clampAxisDelta(delta: number, maxDelta: number): number {
  if (Math.abs(delta) <= maxDelta) return delta;
  return delta > 0 ? maxDelta : -maxDelta;
}

function applyPreviewFrameFit(
  editor: Editor,
  frameId: TLShapeId,
  target: FrameContentTarget,
  childIds: TLShapeId[],
  options: Required<Pick<FitContextGroupFrameOptions, 'minDelta' | 'maxDeltaPerFrame'>>,
): boolean {
  const frame = editor.getShape<TLFrameShape>(frameId);
  if (!frame || frame.type !== 'frame') return false;

  const currentW = frame.props.w;
  const currentH = frame.props.h;
  const dw = target.w - currentW;
  const dh = target.h - currentH;

  // During drag preview, only grow the frame — final fit handles shrink.
  const growW = dw > 0 ? clampAxisDelta(dw, options.maxDeltaPerFrame) : 0;
  const growH = dh > 0 ? clampAxisDelta(dh, options.maxDeltaPerFrame) : 0;
  const shiftX = growW > 0 || growH > 0 ? clampAxisDelta(target.dx, options.maxDeltaPerFrame) : 0;
  const shiftY = growW > 0 || growH > 0 ? clampAxisDelta(target.dy, options.maxDeltaPerFrame) : 0;

  if (
    growW < options.minDelta &&
    growH < options.minDelta &&
    Math.abs(shiftX) < options.minDelta &&
    Math.abs(shiftY) < options.minDelta
  ) {
    return false;
  }

  const nextW = currentW + growW;
  const nextH = currentH + growH;
  const diff = new Vec(shiftX, shiftY).rot(frame.rotation);

  editor.run(() => {
    const changes: TLShapePartial[] = compact(
      childIds.map((childId) => {
        const shape = editor.getShape(childId);
        if (!shape) return undefined;
        return {
          id: shape.id,
          type: shape.type,
          x: shape.x + shiftX,
          y: shape.y + shiftY,
        };
      }),
    );

    changes.push({
      id: frame.id,
      type: frame.type,
      x: frame.x - diff.x,
      y: frame.y - diff.y,
      props: {
        w: nextW,
        h: nextH,
      },
    });

    editor.updateShapes(changes);
  });

  return true;
}

function fitContextGroupFrameImmediate(
  editor: Editor,
  frameId: TLShapeId,
  padding: number,
): void {
  fitFrameToContent(editor, frameId, { padding });
  snapFrameOrigin(editor, frameId);
}

/**
 * Resize a site/agency context frame to encompass all child shapes plus padding.
 * When a site frame is nested under an agency frame, the agency frame is fitted too.
 *
 * Use `mode: 'preview'` during panel drag for capped incremental growth; use
 * `mode: 'final'` (default) on pointer-up for a full snap fit.
 */
export function fitContextGroupFrameToContent(
  editor: Editor,
  frameId: TLShapeId,
  options: FitContextGroupFrameOptions = {},
): boolean {
  const meta = isContextGroupFrame(editor, frameId);
  if (!meta) return false;

  const padding = options.padding ?? CONTEXT_FRAME_PADDING;
  const mode = options.mode ?? 'final';
  const minDelta = options.minDelta ?? CONTEXT_FRAME_PREVIEW_MIN_DELTA;
  const maxDeltaPerFrame = options.maxDeltaPerFrame ?? CONTEXT_FRAME_PREVIEW_MAX_DELTA;

  if (mode === 'final') {
    fitContextGroupFrameImmediate(editor, frameId, padding);
  } else {
    const frame = editor.getShape<TLFrameShape>(frameId);
    if (!frame) return false;
    const childIds = editor.getSortedChildIdsForParent(frame.id);
    const target = computeFrameContentTarget(editor, frameId, padding);
    if (!target || childIds.length === 0) return false;
    const changed = applyPreviewFrameFit(editor, frameId, target, childIds, {
      minDelta,
      maxDeltaPerFrame,
    });
    if (!changed) return true;
    snapFrameOrigin(editor, frameId);
  }

  const frame = editor.getShape(frameId);
  if (frame?.parentId) {
    const parentMeta = isContextGroupFrame(editor, frame.parentId as TLShapeId);
    if (parentMeta?.kind === 'agency') {
      if (mode === 'final') {
        fitContextGroupFrameImmediate(editor, frame.parentId as TLShapeId, padding);
      } else {
        const agencyFrameId = frame.parentId as TLShapeId;
        const agencyFrame = editor.getShape<TLFrameShape>(agencyFrameId);
        if (agencyFrame) {
          const agencyChildIds = editor.getSortedChildIdsForParent(agencyFrame.id);
          const agencyTarget = computeFrameContentTarget(editor, agencyFrameId, padding);
          if (agencyTarget && agencyChildIds.length > 0) {
            applyPreviewFrameFit(editor, agencyFrameId, agencyTarget, agencyChildIds, {
              minDelta,
              maxDeltaPerFrame,
            });
            snapFrameOrigin(editor, agencyFrameId);
          }
        }
      }
    }
  }

  return true;
}

/** Fit the site context frame that contains (or owns) the given shape. */
export function fitSiteContextGroupForShape(
  editor: Editor,
  shapeId: TLShapeId,
): boolean {
  const ctx = findSiteContextGroupForShape(editor, shapeId);
  if (!ctx) return false;

  const shape = editor.getShape(shapeId);
  if (shape?.type === 'panel') {
    ensurePanelInSiteContextFrame(editor, shapeId, ctx.frameId);
  }

  return fitContextGroupFrameToContent(editor, ctx.frameId);
}

interface RecordsDiffLike {
  added: Record<string, UnknownRecord>;
  updated: Record<string, [UnknownRecord, UnknownRecord]>;
}

function isPanelShapeRecord(record: UnknownRecord): record is TLShape {
  return record.typeName === 'shape' && (record as TLShape).type === 'panel';
}

/**
 * True when a panel update changed its geometry (position/size/parent) rather
 * than only its content props (e.g. a new chat message, preview refreshKey).
 *
 * Content-only updates must NOT trigger a group refit — otherwise sending a
 * chat message would resize the whole site group and reload the preview.
 */
function panelGeometryChanged(prev: TLShape, next: TLShape): boolean {
  if (prev.x !== next.x || prev.y !== next.y) return true;
  if (prev.parentId !== next.parentId) return true;
  const prevProps = (prev.props ?? {}) as { w?: number; h?: number };
  const nextProps = (next.props ?? {}) as { w?: number; h?: number };
  return prevProps.w !== nextProps.w || prevProps.h !== nextProps.h;
}

/**
 * Collect panel shape ids from a tldraw store diff for auto-resize.
 *
 * Includes newly added panels and panels whose geometry changed; skips
 * content-only updates so chat/preview content changes don't refit the group.
 */
export function collectPanelShapeIdsFromStoreDiff(diff: RecordsDiffLike): TLShapeId[] {
  const ids = new Set<TLShapeId>();

  for (const record of Object.values(diff.added)) {
    if (isPanelShapeRecord(record)) {
      ids.add(record.id);
    }
  }

  for (const pair of Object.values(diff.updated)) {
    const prev = pair[0];
    const next = pair[1];
    if (!isPanelShapeRecord(next)) continue;
    // Treat panel→panel updates as fit-worthy only on geometry change. When the
    // previous record wasn't a panel (type change), fall back to refitting.
    if (isPanelShapeRecord(prev) && !panelGeometryChanged(prev, next)) continue;
    ids.add(next.id);
  }

  return [...ids];
}

function isContextGroupFrameRecord(record: UnknownRecord): record is TLShape {
  if (record.typeName !== 'shape') return false;
  const shape = record as TLShape;
  if (shape.type !== 'frame') return false;
  return getContextGroupMeta(shape) !== null;
}

/**
 * True when a frame update changed its inner size (w/h). Pure translations
 * (x/y only) are ignored: child panels move with the frame, so no reflow is
 * needed — only a size change alters the inner bounds docked panels track.
 */
function frameGeometryChanged(prev: TLShape, next: TLShape): boolean {
  const prevProps = (prev.props ?? {}) as { w?: number; h?: number };
  const nextProps = (next.props ?? {}) as { w?: number; h?: number };
  return prevProps.w !== nextProps.w || prevProps.h !== nextProps.h;
}

/**
 * Collect context-group frame ids whose inner size (w/h) changed in a store
 * diff — used to reflow docked panels + centered preview when the GROUP itself
 * is resized (not just when a panel is resized).
 */
export function collectContextGroupFrameIdsFromStoreDiff(
  diff: RecordsDiffLike,
): TLShapeId[] {
  const ids = new Set<TLShapeId>();

  for (const pair of Object.values(diff.updated)) {
    const prev = pair[0];
    const next = pair[1];
    if (!isContextGroupFrameRecord(next)) continue;
    // Only refit on an actual size change; ignore pure moves and no-op writes
    // (e.g. a fit that re-writes the same w/h) so we never loop.
    if (isContextGroupFrameRecord(prev) && !frameGeometryChanged(prev, next)) continue;
    ids.add(next.id);
  }

  return [...ids];
}

/** Create or update a labeled context frame (site or agency). */
export function ensureContextGroupFrame(editor: Editor, ref: ContextGroupRef): TLShapeId {
  const frameId = contextGroupFrameId(ref);
  const existing = editor.getShape(frameId);

  if (!existing) {
    editor.createShape({
      id: frameId,
      type: 'frame',
      x: snapToGrid(0),
      y: snapToGrid(0),
      props: {
        w: GRID_SIZE * 40,
        h: GRID_SIZE * 30,
        name: ref.label,
        color: ref.kind === 'agency' ? 'violet' : 'blue',
      },
      meta: {
        [CONTEXT_META_KEY]: { kind: ref.kind, id: ref.id },
        ...(ref.agencyId ? { agencyId: ref.agencyId } : {}),
      },
    });
  } else if (existing.type === 'frame') {
    editor.updateShape({
      id: frameId,
      type: 'frame',
      props: { name: ref.label },
    });
  }

  if (ref.kind === 'site' && ref.agencyId) {
    const agencyRef: ContextGroupRef = {
      kind: 'agency',
      id: ref.agencyId,
      label: `Agency ${ref.agencyId.slice(0, 8)}`,
    };
    const agencyFrameId = ensureContextGroupFrame(editor, agencyRef);
    const siteFrame = editor.getShape(frameId);
    if (siteFrame && siteFrame.parentId !== agencyFrameId) {
      editor.reparentShapes([frameId], agencyFrameId);
    }
  }

  return frameId;
}

/** Reparent panel shapes into a context frame and fit the frame to content. */
export function assignPanelsToContextGroup(
  editor: Editor,
  panelIds: string[],
  ref: ContextGroupRef,
): boolean {
  const scopedIds = filterSiteContextPanelIds(panelIds);
  if (scopedIds.length === 0) return false;

  const panelShapeIds = scopedIds
    .map((panelId) => createShapeId(`panel:${panelId}`))
    .filter((id) => Boolean(editor.getShape(id)));

  if (panelShapeIds.length === 0) return false;

  const frameId = ensureContextGroupFrame(editor, ref);
  editor.reparentShapes(panelShapeIds, frameId);
  fitContextGroupFrameToContent(editor, frameId);
  return true;
}

/** Site-scoped helper — groups chat, brief, preview, file manager under one frame. */
export function assignPanelsToSiteGroup(
  editor: Editor,
  panelIds: string[],
  siteId: string,
  options: AssignPanelsOptions = {},
): boolean {
  return assignPanelsToContextGroup(editor, panelIds, {
    kind: 'site',
    id: siteId,
    label: options.siteLabel ?? `Site ${siteId.slice(0, 8)}`,
    agencyId: options.agencyId,
  });
}

export function panelsAlreadyInContextFrame(
  editor: Editor,
  panelShapeIds: TLShapeId[],
): boolean {
  if (panelShapeIds.length < 2) return false;
  const parentIds = panelShapeIds.map((id) => editor.getShape(id)?.parentId);
  const firstParent = parentIds[0];
  if (!firstParent) return false;
  const parentShape = editor.getShape(firstParent);
  if (!parentShape || parentShape.type !== 'frame') return false;
  const siblings = editor.getSortedChildIdsForParent(firstParent);
  return panelShapeIds.every((id) => siblings.includes(id));
}

export function groupPanelsWithContext(
  editor: Editor,
  panelIds: string[],
  options: AssignPanelsOptions & { siteId?: string } = {},
): boolean {
  if (panelIds.length === 0) return false;

  const shapeIds = panelIds.map((panelId) => createShapeId(`panel:${panelId}`));
  const existing = shapeIds.filter((id) => Boolean(editor.getShape(id)));
  if (existing.length === 0) return false;

  if (existing.length === 1) {
    const siteId = options.siteId ?? inferCommonSiteId(editor, panelIds);
    if (siteId) {
      return assignPanelsToSiteGroup(editor, panelIds, siteId, options);
    }
    return false;
  }

  if (panelsAlreadyInContextFrame(editor, existing)) {
    const siteId = options.siteId ?? inferCommonSiteId(editor, panelIds);
    if (siteId) {
      return assignPanelsToSiteGroup(editor, panelIds, siteId, options);
    }
    return true;
  }

  const siteId = options.siteId ?? inferCommonSiteId(editor, panelIds);
  if (siteId) {
    return assignPanelsToSiteGroup(editor, panelIds, siteId, options);
  }

  for (const shapeId of existing) {
    const parentId = editor.getShape(shapeId)?.parentId;
    if (!parentId) continue;
    const parentType = editor.getShape(parentId)?.type;
    if (parentType === 'group' || parentType === 'frame') {
      const siblings = editor.getSortedChildIdsForParent(parentId);
      if (existing.every((id) => siblings.includes(id))) {
        return true;
      }
    }
  }

  editor.setCurrentTool('select');
  editor.groupShapes(existing);
  return true;
}
