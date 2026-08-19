/**
 * Re-route diagram edge arrows after their endpoint nodes move
 * (iteration 6).
 *
 * Diagram edges are unbound segment arrows stamped with endpoint ids in
 * meta (AGENT_EDGE_FROM/TO_META_KEY). Anything that moves nodes, arrange
 * or a model redrawing ids at new coordinates, must re-clip every touching
 * arrow to the new borders or the connectors stay stranded at the old
 * positions (the owner-screenshotted "arcs pointing at nothing").
 */
import type { Editor, TLShapeId, TLShapePartial } from 'tldraw';
import {
  AGENT_EDGE_FROM_META_KEY,
  AGENT_EDGE_LABEL_META_KEY,
  AGENT_EDGE_LABEL_TEXT_META_KEY,
  AGENT_EDGE_TO_META_KEY,
} from '../../../engine/agentDrawingTypes';
import { edgeLabelAnchor, routeEdge, type LayoutRect } from './communicativeVisualLayout';
import { toShapeId } from './shapeRef';

export function readEdgeMeta(
  meta: unknown): { from: string; to: string; label?: string } | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  const record = meta as Record<string, unknown>;
  const from = record[AGENT_EDGE_FROM_META_KEY];
  const to = record[AGENT_EDGE_TO_META_KEY];
  if (typeof from !== 'string' || from.length === 0) return undefined;
  if (typeof to !== 'string' || to.length === 0) return undefined;
  const label = record[AGENT_EDGE_LABEL_META_KEY];
  if (typeof label === 'string' && label.length > 0) {
    return { from, to, label };
  }
  return { from, to };
}

function endpointRect(
  editor: Editor,
  movedRects: ReadonlyMap<string, LayoutRect>,
  shapeId: TLShapeId): LayoutRect | undefined {
  const moved = movedRects.get(String(shapeId));
  if (moved !== undefined) return moved;
  const bounds = editor.getShapePageBounds(shapeId);
  if (!bounds) return undefined;
  return { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h };
}

export interface RerouteOptions {
  /** Node ids in layout order; enables skip-edge arc recomputation. */
  order?: readonly string[];
  /** Sequential layout axis for skip-edge arcs; null keeps edges straight. */
  axis?: 'x' | 'y' | null;
}

/**
 * Re-clip every agent edge arrow that touches a moved node. Returns the
 * number of arrows updated.
 */
export function rerouteEdgeArrows(
  editor: Editor,
  movedRects: ReadonlyMap<string, LayoutRect>,
  options: RerouteOptions = {}): number {
  if (movedRects.size === 0) return 0;
  const getShapes = (
    editor as Editor & {
      getCurrentPageShapes?: () => ReadonlyArray<{
        id: TLShapeId;
        type: string;
        meta?: Record<string, unknown>;
      }>;
    }
  ).getCurrentPageShapes;
  if (typeof getShapes !== 'function') return 0;

  const order = options.order ?? [];
  const axis = options.axis ?? null;
  const orderIndex = new Map(order.map((id, index) => [id, index]));

  // Edge label text shapes keyed by their edge pair, so a re-clipped
  // arrow carries its label to the new midpoint.
  const pageShapes = getShapes.call(editor);
  const labelsByPair = new Map<
    string,
    Array<{ id: TLShapeId; w: number; h: number }>
  >();
  for (const shape of pageShapes) {
    if (shape.type !== 'text') continue;
    const meta = shape.meta as Record<string, unknown> | undefined;
    if (meta?.[AGENT_EDGE_LABEL_TEXT_META_KEY] !== '1') continue;
    const edge = readEdgeMeta(meta);
    if (edge === undefined) continue;
    const bounds = editor.getShapePageBounds(shape.id);
    const key = `${edge.from}->${edge.to}`;
    const list = labelsByPair.get(key) ?? [];
    list.push({ id: shape.id, w: bounds?.w ?? 80, h: bounds?.h ?? 26 });
    labelsByPair.set(key, list);
  }

  const updates: TLShapePartial[] = [];
  for (const shape of pageShapes) {
    if (shape.type !== 'arrow') continue;
    const edge = readEdgeMeta(shape.meta);
    if (edge === undefined) continue;
    const fromShapeId = toShapeId(edge.from);
    const toShapeIdResolved = toShapeId(edge.to);
    if (!movedRects.has(String(fromShapeId)) && !movedRects.has(String(toShapeIdResolved))) {
      continue;
    }
    const fromRect = endpointRect(editor, movedRects, fromShapeId);
    const toRect = endpointRect(editor, movedRects, toShapeIdResolved);
    if (fromRect === undefined || toRect === undefined) continue;

    const intermediates: LayoutRect[] = [];
    const fromIndex = orderIndex.get(String(fromShapeId));
    const toIndex = orderIndex.get(String(toShapeIdResolved));
    if (axis !== null && fromIndex !== undefined && toIndex !== undefined) {
      const lo = Math.min(fromIndex, toIndex);
      const hi = Math.max(fromIndex, toIndex);
      for (let index = lo + 1; index < hi; index += 1) {
        const rect = movedRects.get(order[index]!);
        if (rect !== undefined) intermediates.push(rect);
      }
    }
    const routed = routeEdge(fromRect, toRect, intermediates, axis);
    const arrowMinX = Math.min(routed.from.x, routed.to.x);
    const arrowMinY = Math.min(routed.from.y, routed.to.y);
    updates.push({
      id: shape.id,
      type: 'arrow',
      x: arrowMinX,
      y: arrowMinY,
      props: {
        start: { x: routed.from.x - arrowMinX, y: routed.from.y - arrowMinY },
        end: { x: routed.to.x - arrowMinX, y: routed.to.y - arrowMinY },
        bend: routed.bend,
      },
    } as TLShapePartial);

    const labels = labelsByPair.get(`${edge.from}->${edge.to}`);
    if (labels !== undefined) {
      const anchor = edgeLabelAnchor(routed.from, routed.to, routed.bend);
      for (const label of labels) {
        updates.push({
          id: label.id,
          type: 'text',
          x: anchor.x - label.w / 2,
          y: anchor.y - label.h / 2,
        } as TLShapePartial);
      }
    }
  }
  if (updates.length > 0) {
    editor.updateShapes(updates);
  }
  return updates.length;
}
