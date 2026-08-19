/**
 * Deterministic shape-graph serialization from tldraw records (P8-T2).
 */
import {
  AGENT_SHAPE_PROVENANCE_META_KEY,
  type AgentDrawGeometry,
  type AgentDrawShapeKind,
} from '../../../engine/agentDrawingTypes';
import type {
  CanvasPanelGeometry,
  CanvasPerceptionRegion,
  CanvasShapeGraph,
  CanvasShapeGraphNode,
} from '../../../engine/canvasPerceptionTypes';
import type { Rect } from '../../../engine/types';
import { readPlainTextFromShapeProps } from '../tldrawTextProps';

interface ShapeLike {
  id: string;
  type: string;
  x: number;
  y: number;
  parentId?: string;
  index: string;
  meta?: Record<string, unknown>;
  props: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readPoint(value: unknown): { x: number; y: number } | undefined {
  if (!isRecord(value)) return undefined;
  const x = readFiniteNumber(value.x);
  const y = readFiniteNumber(value.y);
  if (x === undefined || y === undefined) return undefined;
  return { x, y };
}

function readAgentId(meta: unknown): string | undefined {
  if (!isRecord(meta)) return undefined;
  const value = meta[AGENT_SHAPE_PROVENANCE_META_KEY];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function rectIntersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function shapeBounds(shape: ShapeLike, pageBounds?: Rect | null): Rect | null {
  if (pageBounds) return pageBounds;
  if (shape.type === 'panel') {
    const w = readFiniteNumber(shape.props.w);
    const h = readFiniteNumber(shape.props.h);
    if (w === undefined || h === undefined) return null;
    return { x: shape.x, y: shape.y, w, h };
  }
  if (shape.type === 'geo') {
    const w = readFiniteNumber(shape.props.w);
    const h = readFiniteNumber(shape.props.h);
    if (w === undefined || h === undefined) return null;
    return { x: shape.x, y: shape.y, w, h };
  }
  if (shape.type === 'text') {
    const w = readFiniteNumber(shape.props.w) ?? 1;
    const h = readFiniteNumber(shape.props.h) ?? 24;
    return { x: shape.x, y: shape.y, w, h };
  }
  if (shape.type === 'arrow') {
    const start = readPoint(shape.props.start);
    const end = readPoint(shape.props.end);
    if (!start || !end) return null;
    const x1 = shape.x + start.x;
    const y1 = shape.y + start.y;
    const x2 = shape.x + end.x;
    const y2 = shape.y + end.y;
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    return { x: minX, y: minY, w: Math.max(1, Math.abs(x2 - x1)), h: Math.max(1, Math.abs(y2 - y1)) };
  }
  return { x: shape.x, y: shape.y, w: 1, h: 1 };
}

function geoKind(props: Record<string, unknown>): AgentDrawShapeKind | undefined {
  const geo = props.geo;
  if (geo === 'rectangle') return 'box';
  if (geo === 'ellipse') return 'ellipse';
  return undefined;
}

function extractGeoGeometry(shape: ShapeLike): AgentDrawGeometry | undefined {
  const w = readFiniteNumber(shape.props.w);
  const h = readFiniteNumber(shape.props.h);
  if (w === undefined || h === undefined) return undefined;
  return { kind: 'rect', x: shape.x, y: shape.y, w, h };
}

function extractArrowGeometry(shape: ShapeLike): AgentDrawGeometry | undefined {
  const start = readPoint(shape.props.start);
  const end = readPoint(shape.props.end);
  if (!start || !end) return undefined;
  return {
    kind: 'segment',
    from: { x: shape.x + start.x, y: shape.y + start.y },
    to: { x: shape.x + end.x, y: shape.y + end.y },
  };
}

function extractTextGeometry(
  shape: ShapeLike,
  measured?: Rect | null,
): AgentDrawGeometry | undefined {
  const maxWidth = readFiniteNumber(shape.props.w);
  const geometry: AgentDrawGeometry = { kind: 'text', x: shape.x, y: shape.y };
  if (maxWidth !== undefined && maxWidth > 0) {
    geometry.maxWidth = maxWidth;
  }
  // Attach real rendered extents when the host measured them, so lints and
  // the model can reason about where text actually sits. Never invent them:
  // autoSize text height is unknowable without measurement.
  if (measured && Number.isFinite(measured.w) && Number.isFinite(measured.h)) {
    geometry.w = measured.w;
    geometry.h = measured.h;
  }
  return geometry;
}

function extractDrawGeometry(shape: ShapeLike): AgentDrawGeometry | undefined {
  const segments = shape.props.segments;
  if (!Array.isArray(segments) || segments.length === 0) return undefined;
  const first = segments[0];
  if (!isRecord(first) || !Array.isArray(first.points)) return undefined;
  const points = first.points
    .map((entry) => readPoint(entry))
    .filter((entry): entry is { x: number; y: number } => entry !== undefined)
    .map((point) => ({ x: shape.x + point.x, y: shape.y + point.y }));
  if (points.length < 2) return undefined;
  return { kind: 'points', points };
}

function extractPanelGeometry(shape: ShapeLike): CanvasPanelGeometry | undefined {
  const w = readFiniteNumber(shape.props.w);
  const h = readFiniteNumber(shape.props.h);
  if (w === undefined || h === undefined) return undefined;
  return { kind: 'panel', x: shape.x, y: shape.y, w, h };
}

function readBindingTarget(props: Record<string, unknown>, key: 'start' | 'end'): string | undefined {
  const binding = props[key];
  if (!isRecord(binding)) return undefined;
  const boundShapeId = binding.boundShapeId;
  return typeof boundShapeId === 'string' && boundShapeId.length > 0 ? boundShapeId : undefined;
}

function indexToZOrder(index: string): number {
  let order = 0;
  for (let i = 0; i < index.length; i += 1) {
    order = order * 31 + index.charCodeAt(i);
  }
  return order;
}

function serializeShape(
  shape: ShapeLike,
  measured?: Rect | null,
): CanvasShapeGraphNode | null {
  if (shape.type === 'panel') {
    const geometry = extractPanelGeometry(shape);
    if (!geometry) return null;
    const panelId = shape.props.panelId;
    return {
      id: shape.id,
      nativeType: shape.type,
      kind: 'panel',
      geometry,
      parentId: shape.parentId ?? null,
      zOrder: indexToZOrder(shape.index),
      agentId: readAgentId(shape.meta),
      panel: {
        panelId: typeof panelId === 'string' ? panelId : '',
        minimized: shape.props.minimized === true,
      },
    };
  }

  if (shape.type === 'geo') {
    const kind = geoKind(shape.props);
    const geometry = extractGeoGeometry(shape);
    if (!kind || !geometry) return null;
    return {
      id: shape.id,
      nativeType: shape.type,
      kind,
      geometry,
      parentId: shape.parentId ?? null,
      zOrder: indexToZOrder(shape.index),
      agentId: readAgentId(shape.meta),
    };
  }

  if (shape.type === 'arrow') {
    const geometry = extractArrowGeometry(shape);
    if (!geometry) return null;
    const node: CanvasShapeGraphNode = {
      id: shape.id,
      nativeType: shape.type,
      kind: 'arrow',
      geometry,
      parentId: shape.parentId ?? null,
      zOrder: indexToZOrder(shape.index),
      agentId: readAgentId(shape.meta),
    };
    const from = readBindingTarget(shape.props, 'start');
    const to = readBindingTarget(shape.props, 'end');
    if (from !== undefined) node.from = from;
    if (to !== undefined) node.to = to;
    return node;
  }

  if (shape.type === 'text') {
    const geometry = extractTextGeometry(shape, measured);
    if (!geometry) return null;
    const text = readPlainTextFromShapeProps(shape.props);
    return {
      id: shape.id,
      nativeType: shape.type,
      kind: 'text',
      geometry,
      text,
      parentId: shape.parentId ?? null,
      zOrder: indexToZOrder(shape.index),
      agentId: readAgentId(shape.meta),
    };
  }

  if (shape.type === 'draw') {
    const geometry = extractDrawGeometry(shape);
    if (!geometry) return null;
    return {
      id: shape.id,
      nativeType: shape.type,
      kind: 'freehand',
      geometry,
      parentId: shape.parentId ?? null,
      zOrder: indexToZOrder(shape.index),
      agentId: readAgentId(shape.meta),
    };
  }

  return null;
}

export interface SerializeShapeGraphInput {
  shapes: readonly ShapeLike[];
  region: Rect;
  budget?: number;
  getPageBounds?: (shapeId: string) => Rect | null | undefined;
}

/** Build a deterministic shape graph from editor shapes intersecting the region. */
export function serializeShapeGraph(input: SerializeShapeGraphInput): CanvasShapeGraph {
  const budget = input.budget ?? 200;
  const sorted = [...input.shapes].sort((a, b) => a.index.localeCompare(b.index));

  const nodes: CanvasShapeGraphNode[] = [];
  let truncated = false;

  for (const shape of sorted) {
    if (nodes.length >= budget) {
      truncated = true;
      break;
    }
    const measured = input.getPageBounds?.(shape.id) ?? null;
    const bounds = shapeBounds(shape, measured);
    if (!bounds || !rectIntersects(bounds, input.region)) continue;
    const node = serializeShape(shape, measured);
    if (node) nodes.push(node);
  }

  nodes.sort((a, b) => a.zOrder - b.zOrder || a.id.localeCompare(b.id));

  return {
    region: input.region,
    shapes: nodes,
    ...(truncated ? { truncated: true } : {}),
  };
}

export function resolvePerceptionRegionBounds(
  region: CanvasPerceptionRegion | undefined,
  viewportBounds: Rect,
): Rect {
  if (region === undefined || region.kind === 'viewport') {
    return viewportBounds;
  }
  return region.rect;
}
