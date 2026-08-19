/**
 * Imperative agent drawing driver for the tldraw whiteboard (D41, P8-T1).
 *
 * Called from agent tools (non-React). Uses the same editor binding as
 * panelShapeApi. Every created mark carries meta.agentableAgent provenance.
 */
import type { Editor, TLShape, TLShapeId, TLShapePartial } from 'tldraw';
import { createShapeId, toRichText } from 'tldraw';
// tldraw's public "draw" shape schema stores stroke segments as
// delta-encoded base64 `path` strings, not the legacy {points: {x,y,z}[]}
// array this module used to build directly. That legacy shape is exactly
// what compressLegacySegments (from tldraw's own schema package, the same
// version tldraw itself depends on) converts, so freehand shapes validate
// against the real editor instead of only against tests that stub it out.
import { compressLegacySegments } from '@tldraw/tlschema';
import {
  AGENT_ANNOTATION_KIND_META_KEY,
  AGENT_PANEL_ANCHOR_META_KEY,
  AGENT_SHAPE_PROVENANCE_META_KEY,
  type AgentAnnotatePanelResult,
  type AgentClearDrawingsResult,
  type AgentDrawDiagramRequest,
  type AgentDrawGeometry,
  type AgentDrawPoint,
  type AgentDrawPointsGeometry,
  type AgentDrawShapeInput,
  type AgentDrawShapeKind,
  type AgentDrawShapesResult,
  type AgentPanelAnchor,
} from '../../../engine/agentDrawingTypes';
import { compileDiagramToDrawShapes } from './diagramToDrawShapes';
import { getTurnCanvasShapeIds } from '../../../chat/turnCanvasContext';
import {
  batchBounds,
  relocationOffset,
  resolveTextCollisions,
  resolveUnderlineAccents,
  translateInput,
  RELOCATION_MIN_BATCH_SIZE,
  type PlacementRect,
} from './batchPlacement';
import { rerouteEdgeArrows } from './edgeReroute';
import { toShapeId } from './shapeRef';
import { sanitizeDrawStyle } from './styleSanitizer';
import { getEditor } from '../shapes/panelShapeApi';

const DEFAULT_GEO_SIZE = { w: 120, h: 80 };

function panelShapeId(panelId: string): TLShapeId {
  return createShapeId(`panel:${panelId}`);
}

function readAgentId(meta: unknown): string | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  const value = (meta as Record<string, unknown>)[AGENT_SHAPE_PROVENANCE_META_KEY];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function assertRectGeometry(
  geometry: AgentDrawGeometry,
  kind: AgentDrawShapeKind): { x: number; y: number; w: number; h: number } {
  if (geometry.kind !== 'rect') {
    throw new Error(`${kind} requires geometry.kind "rect"`);
  }
  if (
    !isFiniteNumber(geometry.x) ||
    !isFiniteNumber(geometry.y) ||
    !isFiniteNumber(geometry.w) ||
    !isFiniteNumber(geometry.h) ||
    geometry.w <= 0 ||
    geometry.h <= 0
  ) {
    throw new Error(`${kind} requires positive width and height`);
  }
  return geometry;
}

function assertSegmentGeometry(geometry: AgentDrawGeometry): {
  from: AgentDrawPoint;
  to: AgentDrawPoint;
} {
  if (geometry.kind !== 'segment') {
    throw new Error('arrow requires geometry.kind "segment"');
  }
  const { from, to } = geometry;
  if (
    !isFiniteNumber(from.x) ||
    !isFiniteNumber(from.y) ||
    !isFiniteNumber(to.x) ||
    !isFiniteNumber(to.y)
  ) {
    throw new Error('arrow requires finite from/to coordinates');
  }
  return { from, to };
}

function assertPointsGeometry(geometry: AgentDrawGeometry): AgentDrawPointsGeometry {
  if (geometry.kind !== 'points') {
    throw new Error('freehand requires geometry.kind "points"');
  }
  if (!Array.isArray(geometry.points) || geometry.points.length < 2) {
    throw new Error('freehand requires at least two points');
  }
  for (const point of geometry.points) {
    if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y)) {
      throw new Error('freehand points must be finite numbers');
    }
  }
  return geometry;
}

function resolveFreehandClosed(geometry: AgentDrawPointsGeometry): boolean {
  if (geometry.closed === true) {
    return true;
  }
  if (geometry.closed === false) {
    return false;
  }
  const points = geometry.points;
  if (points.length >= 3) {
    const first = points[0];
    const last = points[points.length - 1];
    if (first !== undefined && last !== undefined && first.x === last.x && first.y === last.y) {
      return true;
    }
  }
  return false;
}

function assertTextGeometry(geometry: AgentDrawGeometry): {
  x: number;
  y: number;
  maxWidth?: number;
} {
  if (geometry.kind !== 'text') {
    throw new Error('text requires geometry.kind "text"');
  }
  if (!isFiniteNumber(geometry.x) || !isFiniteNumber(geometry.y)) {
    throw new Error('text requires finite x/y coordinates');
  }
  if (geometry.maxWidth !== undefined && (!isFiniteNumber(geometry.maxWidth) || geometry.maxWidth <= 0)) {
    throw new Error('text maxWidth must be a positive number when provided');
  }
  return geometry;
}

function baseStyle(style: AgentDrawShapeInput['style']): Record<string, string> {
  return {
    color: style?.color ?? 'blue',
    fill: style?.fill ?? 'semi',
    dash: style?.dash ?? 'draw',
    size: style?.size ?? 'm',
  };
}

/**
 * tldraw geo and arrow shapes carry their own label. Rendering node text as
 * an internal label (instead of a separately-positioned text shape) lets
 * tldraw center, wrap, and grow the shape around it, so labels never overlap
 * or overflow their box.
 */
function labelProps(text: string | undefined): Record<string, unknown> {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return {};
  }
  return {
    richText: toRichText(text),
    labelColor: 'black',
    font: 'draw',
  };
}

/**
 * Approximate per-character label widths for tldraw's draw font at each
 * label size, plus the label's horizontal padding. Used to keep a box wide
 * enough for its longest word: tldraw wraps between words, but a single
 * word wider than the box wraps mid-word ("Functio ns"), which reads as a
 * broken sketch.
 */
const LABEL_CHAR_WIDTH: Record<'s' | 'm' | 'l' | 'xl', number> = {
  s: 11,
  m: 14,
  l: 17,
  xl: 21,
};
const LABEL_HORIZONTAL_PADDING = 32;
const LABEL_MAX_WIDEN_FACTOR = 1.75;

/**
 * Fit a labeled geo shape to its own longest word: first step the label one
 * size down (preserves the caller's layout exactly), then widen the box
 * around its center up to a bounded factor. Models routinely draw boxes a
 * little too narrow for their label; this keeps every word on one line
 * without letting a wild label blow the layout apart.
 */
function fitGeoLabel(
  rect: { x: number; y: number; w: number; h: number },
  style: AgentDrawShapeInput['style'],
  text: string | undefined,
  geo: 'rectangle' | 'ellipse' = 'rectangle'): { rect: { x: number; y: number; w: number; h: number }; size: 's' | 'm' | 'l' | 'xl' | undefined } {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { rect, size: style?.size };
  }
  const longestWord = text.trim().split(/\s+/).reduce((max, word) => Math.max(max, word.length), 1);
  // An ellipse inscribes its label in roughly 70% of its bounding width,
  // so the same word needs a wider ellipse than box ("Inertia l Nav").
  const widthFactor = geo === 'ellipse' ? 1.4 : 1;
  const widthNeeded = (size: 's' | 'm' | 'l' | 'xl'): number =>
    longestWord * LABEL_CHAR_WIDTH[size] * widthFactor + LABEL_HORIZONTAL_PADDING;

  let size: 's' | 'm' | 'l' | 'xl' = style?.size ?? 'm';
  if (widthNeeded(size) > rect.w && size !== 's') {
    size = size === 'xl' ? 'l' : size === 'l' ? 'm' : 's';
  }
  if (widthNeeded(size) <= rect.w) {
    return { rect, size };
  }
  const targetW = Math.min(rect.w * LABEL_MAX_WIDEN_FACTOR, widthNeeded(size));
  if (targetW <= rect.w) {
    return { rect, size };
  }
  const dx = (targetW - rect.w) / 2;
  return { rect: { x: rect.x - dx, y: rect.y, w: targetW, h: rect.h }, size };
}

/**
 * Approximate per-character widths for standalone text shapes (tldraw's
 * text font sizes run larger than geo label sizes). Same purpose as
 * LABEL_CHAR_WIDTH: a fixed-width text shape narrower than its longest word
 * wraps mid-word ("38" over "0"), which reads as a broken sketch.
 */
const TEXT_CHAR_WIDTH: Record<'s' | 'm' | 'l' | 'xl', number> = {
  s: 11,
  m: 15,
  l: 22,
  xl: 27,
};
const TEXT_HORIZONTAL_PADDING = 16;

function textShapeProps(
  text: string,
  geometry: { maxWidth?: number },
  style: AgentDrawShapeInput['style']): Record<string, string | number | boolean | ReturnType<typeof toRichText>> {
  const size: 's' | 'm' | 'l' | 'xl' = style?.size ?? 'm';
  let maxWidth = geometry.maxWidth;
  if (maxWidth !== undefined) {
    const longestWord = text.trim().split(/\s+/).reduce((max, word) => Math.max(max, word.length), 1);
    const floor = longestWord * TEXT_CHAR_WIDTH[size] + TEXT_HORIZONTAL_PADDING;
    maxWidth = Math.max(maxWidth, floor);
  }
  return {
    richText: toRichText(text),
    color: style?.color ?? 'blue',
    size,
    font: 'draw',
    autoSize: maxWidth === undefined,...(maxWidth !== undefined ? { w: maxWidth }: {}),
  };
}

function provenanceMeta(
  agentId: string,
  extra?: Readonly<Record<string, string>>): Record<string, string> {
  return { ...extra, [AGENT_SHAPE_PROVENANCE_META_KEY]: agentId };
}

function isShapeOnCurrentPage(editor: Editor, shapeId: TLShapeId): boolean {
  const shape = editor.getShape(shapeId);
  if (shape === undefined) {
    return false;
  }
  return shape.parentId === editor.getCurrentPageId();
}

function recordCreatedShape(
  editor: Editor,
  createdShapeIds: string[],
  shapeId: TLShapeId): void {
  if (isShapeOnCurrentPage(editor, shapeId)) {
    createdShapeIds.push(String(shapeId));
  }
}

function createGeoShape(
  editor: Editor,
  agentId: string,
  geo: 'rectangle' | 'ellipse',
  rect: { x: number; y: number; w: number; h: number },
  style: AgentDrawShapeInput['style'],
  text?: string,
  meta?: Readonly<Record<string, string>>,
  providedId?: TLShapeId): TLShapeId {
  const id = providedId ?? createShapeId();
  editor.createShape({
    id,
    type: 'geo',
    parentId: editor.getCurrentPageId(),
    x: rect.x,
    y: rect.y,
    meta: provenanceMeta(agentId, meta),
    props: {
      geo,
      w: rect.w,
      h: rect.h,...baseStyle(style),...labelProps(text),
    },
  });
  return id;
}

function createTextShape(
  editor: Editor,
  agentId: string,
  text: string,
  geometry: { x: number; y: number; maxWidth?: number },
  style: AgentDrawShapeInput['style'],
  meta?: Readonly<Record<string, string>>,
  providedId?: TLShapeId): TLShapeId {
  const id = providedId ?? createShapeId();
  editor.createShape({
    id,
    type: 'text',
    x: geometry.x,
    y: geometry.y,
    meta: provenanceMeta(agentId, meta),
    props: textShapeProps(text, geometry, style),
  });
  return id;
}

function createArrowShape(
  editor: Editor,
  agentId: string,
  segment: { from: AgentDrawPoint; to: AgentDrawPoint },
  style: AgentDrawShapeInput['style'],
  text?: string,
  meta?: Readonly<Record<string, string>>,
  providedId?: TLShapeId,
  bend?: number): TLShapeId {
  const id = providedId ?? createShapeId();
  const minX = Math.min(segment.from.x, segment.to.x);
  const minY = Math.min(segment.from.y, segment.to.y);
  editor.createShape({
    id,
    type: 'arrow',
    x: minX,
    y: minY,
    meta: provenanceMeta(agentId, meta),
    props: {
      start: { x: segment.from.x - minX, y: segment.from.y - minY },
      end: { x: segment.to.x - minX, y: segment.to.y - minY },...baseStyle(style),...labelProps(text),
      // Skip edges arc over the nodes between their endpoints.
      ...(bend !== undefined && bend !== 0 ? { bend } : {}),
    },
  });
  return id;
}

function createFreehandShape(
  editor: Editor,
  agentId: string,
  points: readonly AgentDrawPoint[],
  style: AgentDrawShapeInput['style'],
  meta?: Readonly<Record<string, string>>,
  providedId?: TLShapeId,
  closed = false): TLShapeId {
  const id = providedId ?? createShapeId();
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const normalized = points.map((point) => ({
    x: point.x - minX,
    y: point.y - minY,
    z: 0.5,
  }));
  const segments = compressLegacySegments([{ type: 'free', points: normalized }]);
  editor.createShape({
    id,
    type: 'draw',
    x: minX,
    y: minY,
    meta: provenanceMeta(agentId, meta),
    props: {
      segments,
      isComplete: true,
      isClosed: closed,
      isPen: false,...baseStyle(style),
    },
  });
  return id;
}

function createShapeForInput(editor: Editor, agentId: string, input: AgentDrawShapeInput): TLShapeId {
  const extraMeta = input.meta;
  // Honor a caller/model-assigned id so later tools can reference this shape.
  const explicitId = input.id !== undefined ? toShapeId(input.id): undefined;
  switch (input.kind) {
    case 'box': {
      const rect = assertRectGeometry(input.geometry, 'box');
      const fitted = fitGeoLabel(rect, input.style, input.text);
      return createGeoShape(
        editor,
        agentId,
        'rectangle',
        fitted.rect,
        fitted.size !== undefined ? { ...input.style, size: fitted.size } : input.style,
        input.text,
        extraMeta,
        explicitId);
    }
    case 'ellipse': {
      const rect = assertRectGeometry(input.geometry, 'ellipse');
      const fitted = fitGeoLabel(rect, input.style, input.text, 'ellipse');
      return createGeoShape(
        editor,
        agentId,
        'ellipse',
        fitted.rect,
        fitted.size !== undefined ? { ...input.style, size: fitted.size } : input.style,
        input.text,
        extraMeta,
        explicitId);
    }
    case 'text': {
      // Empty text is filtered upstream in drawAgentShapes; guard here too so
      // direct callers never render a placeholder label.
      if (typeof input.text !== 'string' || input.text.trim().length === 0) {
        throw new Error('text shape requires non-empty text');
      }
      const geometry = assertTextGeometry(input.geometry);
      return createTextShape(editor, agentId, input.text, geometry, input.style, extraMeta, explicitId);
    }
    case 'arrow': {
      const segment = assertSegmentGeometry(input.geometry);
      return createArrowShape(
        editor,
        agentId,
        segment,
        input.style,
        input.text,
        extraMeta,
        explicitId,
        input.bend);
    }
    case 'freehand': {
      const pointsGeometry = assertPointsGeometry(input.geometry);
      const closed = resolveFreehandClosed(pointsGeometry);
      return createFreehandShape(
        editor,
        agentId,
        pointsGeometry.points,
        input.style,
        extraMeta,
        explicitId,
        closed);
    }
    default: {
      const exhaustive: never = input.kind;
      throw new Error(`unsupported shape kind: ${String(exhaustive)}`);
    }
  }
}

/**
 * In-place update for a redraw of an existing id: position, size, and
 * geo label. Models move shapes by redrawing the same id at new
 * coordinates. Returns the new page rect for edge re-routing (rect
 * geometry only). Segment and points redraws never reach this function:
 * the upsert loop replaces those shapes outright, since strokes have no
 * in-place geometry update.
 */
function updateShapeForInput(
  editor: Editor,
  existing: TLShape,
  input: AgentDrawShapeInput): PlacementRect | null {
  if (input.geometry.kind === 'rect') {
    const rect = input.geometry;
    const isGeo = existing.type === 'geo';
    editor.updateShapes([
      {
        id: existing.id,
        type: existing.type,
        x: rect.x,
        y: rect.y,
        props: {...(isGeo ? { w: rect.w, h: rect.h }: {}),...(isGeo && typeof input.text === 'string' && input.text.trim().length > 0
            ? labelProps(input.text): {}),
        },
      } as TLShapePartial,
    ]);
    return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  }
  if (input.geometry.kind === 'text') {
    editor.updateShapes([
      {
        id: existing.id,
        type: existing.type,
        x: input.geometry.x,
        y: input.geometry.y,
        // Carry new wording too: models shorten or rephrase a label when they
        // reposition it, and keeping the old rich text renders stale copy.
        ...(typeof input.text === 'string' && input.text.trim().length > 0
          ? { props: { richText: toRichText(input.text) } }: {}),
      } as TLShapePartial,
    ]);
    return null;
  }
  return null;
}

function anchorOffset(
  anchor: AgentPanelAnchor,
  panelBounds: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
  const padding = 16;
  switch (anchor) {
    case 'top':
      return { x: panelBounds.x + panelBounds.w / 2, y: panelBounds.y - padding };
    case 'bottom':
      return { x: panelBounds.x + panelBounds.w / 2, y: panelBounds.y + panelBounds.h + padding };
    case 'left':
      return { x: panelBounds.x - padding, y: panelBounds.y + panelBounds.h / 2 };
    case 'right':
      return { x: panelBounds.x + panelBounds.w + padding, y: panelBounds.y + panelBounds.h / 2 };
    case 'center':
      return { x: panelBounds.x + panelBounds.w / 2, y: panelBounds.y + panelBounds.h / 2 };
  }
}

function resolvePanelBounds(
  editor: Editor,
  panelId: string): { shapeId: TLShapeId; x: number; y: number; w: number; h: number } | null {
  const shapeId = panelShapeId(panelId);
  const shape = editor.getShape(shapeId);
  // The panel shape util is host-registered, so its type string sits outside
  // tldraw's built-in TLShape union.
  if (!shape || (shape.type as string) !== 'panel') return null;
  const bounds = editor.getShapePageBounds(shapeId);
  if (!bounds) return null;
  return { shapeId, x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h };
}

/**
 * Existing content a new composition must not land on: any agent's marks
 * plus open panels. User-drawn strokes stay out of it deliberately, so an
 * agent can still sketch beside or around what the user drew by hand.
 */
function collectObstacleRects(editor: Editor): PlacementRect[] {
  const getShapes = (
    editor as Editor & {
      getCurrentPageShapes?: () => ReadonlyArray<{
        id: TLShapeId;
        type: string;
        meta?: Record<string, unknown>;
      }>;
    }
  ).getCurrentPageShapes;
  if (typeof getShapes !== 'function') return [];
  const rects: PlacementRect[] = [];
  for (const shape of getShapes.call(editor)) {
    const isAgentMark = readAgentId(shape.meta) !== undefined;
    const isPanel = (shape.type as string) === 'panel';
    if (!isAgentMark && !isPanel) continue;
    const bounds = editor.getShapePageBounds(shape.id);
    if (!bounds) continue;
    rects.push({ x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h });
  }
  return rects;
}

export function drawAgentShapes(
  agentId: string,
  shapes: readonly AgentDrawShapeInput[],
  meta?: Pick<AgentDrawShapesResult, 'layout' | 'progressiveStep'>): AgentDrawShapesResult {
  const editor = getEditor();
  if (!editor) {
    throw new Error('canvas editor not bound');
  }
  if (shapes.length === 0) {
    return { createdShapeIds: [], agentId, ...meta };
  }

  // Style tokens first: one invalid enum ("lightBlue") reaching tldraw's
  // store validator crashed the whole canvas in a live run. Normalize what
  // the model meant before anything estimates sizes or touches the editor.
  shapes = shapes.map((input) => {
    const sanitized = sanitizeDrawStyle(input.style);
    return sanitized === input.style ? input : { ...input, style: sanitized };
  });

  // Placement hygiene: a new multi-shape composition never
  // lands on existing content, and batch text never lands on batch text.
  // Batches that extend existing work are exempt: connector refs, panel
  // annotations, and redraws of ids already on the canvas (progressive
  // steps) all stay exactly where the caller put them.
  let batch: readonly AgentDrawShapeInput[] = shapes;
  let placementNote: string | undefined;
  const extendsExistingWork =
    shapes.some((input) => input.from !== undefined || input.to !== undefined) ||
    shapes.some((input) => input.meta?.[AGENT_PANEL_ANCHOR_META_KEY] !== undefined) ||
    shapes.some(
      (input) =>
        input.id !== undefined && isShapeOnCurrentPage(editor, toShapeId(input.id)));
  if (shapes.length >= RELOCATION_MIN_BATCH_SIZE && !extendsExistingWork) {
    const bbox = batchBounds(shapes);
    if (bbox !== null) {
      const offset = relocationOffset(bbox, collectObstacleRects(editor));
      if (offset !== null) {
        batch = shapes.map((input) => translateInput(input, offset.dx, offset.dy));
        placementNote = `The batch overlapped existing canvas content, so it was moved as one unit by (${Math.round(
          offset.dx)}, ${Math.round(offset.dy)}) into clear space.`;
      }
    }
  }
  batch = resolveTextCollisions(batch);
  batch = resolveUnderlineAccents(batch);

  const createdShapeIds: string[] = [];
  // Ids the batch re-drew at new coordinates: models move shapes by
  // redrawing the same id, so an existing id is an update, never a
  // duplicate-create (which tldraw rejects, silently stranding the move).
  const movedRects = new Map<string, PlacementRect>();
  for (const input of batch) {
    // Skip an empty text shape rather than drawing the literal "Text"
    // placeholder a model sometimes emits with no content.
    if (
      input.kind === 'text' &&
      (typeof input.text !== 'string' || input.text.trim().length === 0)
    ) {
      continue;
    }
    try {
      const explicitId = input.id !== undefined ? toShapeId(input.id): undefined;
      const existing = explicitId !== undefined ? editor.getShape(explicitId) : undefined;
      if (existing !== undefined && explicitId !== undefined) {
        if (!isShapeOnCurrentPage(editor, explicitId)) {
          // IndexedDB can retain ids from prior sessions on another page; updating
          // those records reports success but nothing appears on the live page.
          editor.deleteShapes([existing.id]);
          const id = createShapeForInput(editor, agentId, input);
          recordCreatedShape(editor, createdShapeIds, id);
          continue;
        }
        if (input.geometry.kind === 'segment' || input.geometry.kind === 'points') {
          // Strokes and raw arrows have no in-place geometry update, so a
          // redraw must replace the old shape. Keeping the stale mark leaves
          // orphaned accents behind after the rest of the batch moves.
          editor.deleteShapes([existing.id]);
          const id = createShapeForInput(editor, agentId, input);
          recordCreatedShape(editor, createdShapeIds, id);
          continue;
        }
        const movedRect = updateShapeForInput(editor, existing, input);
        recordCreatedShape(editor, createdShapeIds, explicitId);
        if (movedRect !== null) {
          movedRects.set(String(explicitId), movedRect);
        }
        continue;
      }
      const id = createShapeForInput(editor, agentId, input);
      recordCreatedShape(editor, createdShapeIds, id);
    } catch {
      // A single shape an LLM malformed (an unsupported prop, an out-of-range
      // value, a shape tldraw's schema rejects) must not abort the whole batch
      // or bubble an uncaught error: skip it and keep drawing the rest, so the
      // sketch still renders instead of collapsing to a blank canvas.
      continue;
    }
  }
  // Connectors follow their nodes: a moved node re-clips every edge arrow
  // that touches it, so redrawn layouts never leave arrows stranded.
  rerouteEdgeArrows(editor, movedRects);
  return {
    createdShapeIds,
    agentId,...meta,...(placementNote !== undefined ? { placementNote }: {}),
  };
}

export function drawAgentDiagram(
  agentId: string,
  request: AgentDrawDiagramRequest): AgentDrawShapesResult {
  const editor = getEditor();
  if (!editor) {
    throw new Error('canvas editor not bound');
  }
  const shapes = compileDiagramToDrawShapes(editor, request);
  return drawAgentShapes(agentId, shapes, {
    layout: request.layout,
    progressiveStep: request.progressive?.step,
  });
}

export function annotateAgentPanel(
  agentId: string,
  panelId: string,
  text: string,
  anchor: AgentPanelAnchor): AgentAnnotatePanelResult {
  const editor = getEditor();
  if (!editor) {
    throw new Error('canvas editor not bound');
  }
  const panel = resolvePanelBounds(editor, panelId);
  if (!panel) {
    throw new Error(`panel "${panelId}" is not open on the canvas`);
  }

  const anchorPoint = anchorOffset(anchor, panel);
  const calloutId = createShapeId();
  editor.createShape({
    id: calloutId,
    type: 'text',
    parentId: panel.shapeId,
    x: anchorPoint.x - panel.x,
    y: anchorPoint.y - panel.y,
    meta: {...provenanceMeta(agentId),
      [AGENT_PANEL_ANCHOR_META_KEY]: panelId,
      [AGENT_ANNOTATION_KIND_META_KEY]: 'panel-callout',
    },
    props: textShapeProps(text, {}, undefined),
  });

  return { calloutShapeId: String(calloutId), panelId, agentId };
}

export interface ClearAgentDrawingsOptions {
  scope?: 'currentTurn' | 'all';
  shapeIds?: readonly string[];
  groupId?: string;
}

function collectGroupDescendantIds(editor: Editor, groupId: string): string[] {
  const root = groupId as TLShapeId;
  if (editor.getShape(root) === undefined) {
    return [];
  }
  const out: string[] = [];
  const queue: TLShapeId[] = [root];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) continue;
    for (const child of editor.getSortedChildIdsForParent(current)) {
      out.push(String(child));
      queue.push(child);
    }
  }
  return out;
}

export function clearAgentDrawings(
  agentId: string,
  options: ClearAgentDrawingsOptions = {}): AgentClearDrawingsResult {
  const editor = getEditor();
  if (!editor) {
    throw new Error('canvas editor not bound');
  }

  const scope = options.scope ?? 'currentTurn';
  const removedShapeIds: string[] = [];
  const toRemove: TLShapeId[] = [];

  let candidateIds: string[] | undefined;
  if (options.groupId !== undefined) {
    candidateIds = collectGroupDescendantIds(editor, options.groupId);
  } else if (options.shapeIds !== undefined && options.shapeIds.length > 0) {
    candidateIds = [...options.shapeIds];
  } else if (scope === 'currentTurn') {
    candidateIds = [...getTurnCanvasShapeIds()];
  }

  if (candidateIds !== undefined) {
    for (const shapeId of candidateIds) {
      const shape = editor.getShape(shapeId as TLShapeId);
      if (shape === undefined) continue;
      const stampedAgent = readAgentId(shape.meta);
      if (stampedAgent !== agentId) continue;
      toRemove.push(shape.id);
      removedShapeIds.push(String(shape.id));
    }
  } else {
    for (const shape of editor.getCurrentPageShapes()) {
      const stampedAgent = readAgentId(shape.meta);
      if (stampedAgent === agentId) {
        toRemove.push(shape.id);
        removedShapeIds.push(String(shape.id));
      }
    }
  }

  if (toRemove.length > 0) {
    editor.deleteShapes(toRemove);
  }

  return { removedShapeIds, agentId };
}

/** Test helper: read provenance from a shape record. */
export function readShapeProvenance(shape: Pick<TLShape, 'meta'>): string | undefined {
  return readAgentId(shape.meta);
}

/** Default geometry used when tests omit explicit sizes. */
export const DEFAULT_AGENT_DRAW_GEO = DEFAULT_GEO_SIZE;
