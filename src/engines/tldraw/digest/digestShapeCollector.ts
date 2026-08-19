/**
 * Collect compact canvas drawing summaries for the workspace digest.
 */
import type { Editor } from 'tldraw';
import {
  AGENT_ANNOTATION_KIND_META_KEY,
  AGENT_SHAPE_PROVENANCE_META_KEY,
  type AgentDrawShapeKind,
} from '../../../engine/agentDrawingTypes';
import {
  buildDigestShapeSummary,
  type DigestShapeRecordInput,
} from '../../../agents/digestShapes';
import type { AttentionTier, DigestShapeSummary } from '../../../agents/digest';
import type { Rect } from '../../../engine/types';
import { readPlainTextFromShapeProps } from '../tldrawTextProps';

interface ShapeLike {
  id: string;
  type: string;
  x: number;
  y: number;
  parentId?: string;
  meta?: Record<string, unknown>;
  props: Record<string, unknown>;
}

const DRAWING_NATIVE_TYPES = new Set(['geo', 'arrow', 'text', 'draw']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readAgentId(meta: unknown): string | undefined {
  if (!isRecord(meta)) return undefined;
  const value = meta[AGENT_SHAPE_PROVENANCE_META_KEY];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readAnnotationKind(meta: unknown): boolean {
  if (!isRecord(meta)) return false;
  return meta[AGENT_ANNOTATION_KIND_META_KEY] === true;
}

function geoKind(props: Record<string, unknown>): AgentDrawShapeKind | undefined {
  const geo = props.geo;
  if (geo === 'ellipse') return 'ellipse';
  if (geo === 'rectangle' || geo === 'box') return 'box';
  return undefined;
}

function shapeBounds(shape: ShapeLike, editor: Editor): Rect | null {
  const pageBounds = editor.getShapePageBounds(shape.id as Parameters<Editor['getShapePageBounds']>[0]);
  if (pageBounds) {
    return { x: pageBounds.x, y: pageBounds.y, w: pageBounds.w, h: pageBounds.h };
  }
  const w = readFiniteNumber(shape.props.w) ?? 1;
  const h = readFiniteNumber(shape.props.h) ?? 1;
  return { x: shape.x, y: shape.y, w, h };
}

function rectIntersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function deriveShapeAttention(bounds: Rect | null, viewport: Rect | null): AttentionTier {
  if (bounds === null || viewport === null) return 'background';
  if (rectIntersects(bounds, viewport)) return 'visible';
  return 'background';
}

function readTextLabel(props: Record<string, unknown>): string {
  return readPlainTextFromShapeProps(props) ?? 'text';
}

function defaultLabel(nativeType: string, kind?: AgentDrawShapeKind | 'annotation'): string {
  if (kind === 'annotation') return 'panel callout';
  if (kind !== undefined) return kind;
  return nativeType;
}

function summarizeDrawingShape(
  shape: ShapeLike,
  editor: Editor,
  viewport: Rect | null,
): DigestShapeSummary | null {
  if (shape.type === 'panel') return null;
  if (!DRAWING_NATIVE_TYPES.has(shape.type) && !readAnnotationKind(shape.meta)) {
    return null;
  }

  const agentId = readAgentId(shape.meta);
  const isAnnotation = readAnnotationKind(shape.meta);
  let kind: AgentDrawShapeKind | 'annotation' | undefined;
  if (isAnnotation) {
    kind = 'annotation';
  } else if (shape.type === 'geo') {
    kind = geoKind(shape.props);
  } else if (shape.type === 'arrow') {
    kind = 'arrow';
  } else if (shape.type === 'text') {
    kind = 'text';
  } else if (shape.type === 'draw') {
    kind = 'freehand';
  }

  const bounds = shapeBounds(shape, editor);
  const label =
    shape.type === 'text' || isAnnotation
      ? readTextLabel(shape.props)
      : defaultLabel(shape.type, kind);

  const revisionPayload: Record<string, unknown> = {
    type: shape.type,
    x: shape.x,
    y: shape.y,
    props: shape.props,
    meta: shape.meta ?? {},
    parentId: shape.parentId ?? null,
  };

  const input: DigestShapeRecordInput = {
    id: String(shape.id),
    nativeType: shape.type,
    label,
    revisionPayload,
    attention: deriveShapeAttention(bounds, viewport),
  };
  if (kind !== undefined) input.kind = kind;
  if (agentId !== undefined) {
    input.agentId = agentId;
  } else {
    input.userAuthored = true;
  }
  return buildDigestShapeSummary(input);
}

export interface CollectDigestShapesOptions {
  viewport?: Rect | null;
}

/** Collect agent and user drawing summaries from the bound tldraw editor. */
export function collectDigestShapeSummaries(
  editor: Editor,
  options: CollectDigestShapesOptions = {},
): DigestShapeSummary[] {
  const viewport = options.viewport ?? null;
  const summaries: DigestShapeSummary[] = [];
  for (const shape of editor.getCurrentPageShapes()) {
    const summary = summarizeDrawingShape(shape as unknown as ShapeLike, editor, viewport);
    if (summary !== null) {
      summaries.push(summary);
    }
  }
  summaries.sort((left, right) => left.id.localeCompare(right.id));
  return summaries;
}
