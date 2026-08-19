/**
 * Deterministic pre-draw placement hygiene for explicit-geometry batches
 * (owner-reported overlap defects, iteration 6).
 *
 * Two pure passes over draw_shapes inputs before anything is created:
 *
 * 1. Batch relocation: a new multi-shape composition whose bounding box
 *    lands on existing canvas content (a previous drawing, an open panel)
 *    is translated as one unit to the nearest clear side. Models redraw a
 *    dashboard straight over the old one; the canvas is infinite, so the
 *    right fix is "beside", never "on top".
 * 2. Text de-collision: standalone text shapes whose estimated extents
 *    overlap another text shape in the same batch get nudged apart by the
 *    minimal separation vector. Models place section headers by guessing
 *    rendered widths and routinely guess short.
 *
 * Pure functions over inputs plus obstacle rects: no editor access, fully
 * unit-testable.
 */
import type { AgentDrawShapeInput } from '../../../engine/agentDrawingTypes';

export interface PlacementRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Standalone-text extent estimate. Kept in step with TEXT_CHAR_WIDTH in
 * agentDrawingApi (tldraw text font runs larger than geo labels).
 */
const TEXT_EST_CHAR_WIDTH: Record<'s' | 'm' | 'l' | 'xl', number> = {
  s: 11,
  m: 15,
  l: 22,
  xl: 27,
};
const TEXT_EST_LINE_HEIGHT: Record<'s' | 'm' | 'l' | 'xl', number> = {
  s: 26,
  m: 32,
  l: 46,
  xl: 56,
};

const RELOCATION_GAP = 48;
/** Overlap below this share of the batch area is treated as incidental. */
const RELOCATION_MIN_OVERLAP_RATIO = 0.25;
/** Batches smaller than this are additions to existing work, not new compositions. */
export const RELOCATION_MIN_BATCH_SIZE = 3;
const TEXT_NUDGE_GAP = 8;
const TEXT_NUDGE_MAX = 240;

export function estimateInputRect(input: AgentDrawShapeInput): PlacementRect | null {
  const geometry = input.geometry;
  if (geometry.kind === 'rect') {
    return { x: geometry.x, y: geometry.y, w: geometry.w, h: geometry.h };
  }
  if (geometry.kind === 'segment') {
    const x = Math.min(geometry.from.x, geometry.to.x);
    const y = Math.min(geometry.from.y, geometry.to.y);
    return {
      x,
      y,
      w: Math.max(1, Math.abs(geometry.to.x - geometry.from.x)),
      h: Math.max(1, Math.abs(geometry.to.y - geometry.from.y)),
    };
  }
  if (geometry.kind === 'points') {
    const xs = geometry.points.map((point) => point.x);
    const ys = geometry.points.map((point) => point.y);
    if (xs.length === 0) return null;
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return {
      x,
      y,
      w: Math.max(1, Math.max(...xs) - x),
      h: Math.max(1, Math.max(...ys) - y),
    };
  }
  if (geometry.kind === 'text') {
    const text = typeof input.text === 'string' ? input.text.trim() : '';
    const size = input.style?.size ?? 'm';
    const charWidth = TEXT_EST_CHAR_WIDTH[size];
    const lineHeight = TEXT_EST_LINE_HEIGHT[size];
    const fullWidth = Math.max(1, text.length) * charWidth + 16;
    const w = geometry.maxWidth !== undefined ? Math.min(geometry.maxWidth, fullWidth) : fullWidth;
    const lines = Math.max(1, Math.ceil(fullWidth / Math.max(1, w)));
    return { x: geometry.x, y: geometry.y, w, h: lines * lineHeight };
  }
  return null;
}

export function batchBounds(inputs: readonly AgentDrawShapeInput[]): PlacementRect | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const input of inputs) {
    const rect = estimateInputRect(input);
    if (rect === null) continue;
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.w);
    maxY = Math.max(maxY, rect.y + rect.h);
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function overlapArea(a: PlacementRect, b: PlacementRect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Offset that moves a batch clear of existing content, or null when the
 * batch already sits in the clear. Obstacles merge into one box (exact for
 * the dominant one-previous-drawing case, conservative otherwise); the
 * batch slides to whichever side needs the smallest move.
 */
export function relocationOffset(
  batch: PlacementRect,
  obstacles: readonly PlacementRect[],
  gap: number = RELOCATION_GAP,
): { dx: number; dy: number } | null {
  const hits = obstacles.filter((rect) => overlapArea(batch, rect) > 0);
  if (hits.length === 0) return null;
  const minX = Math.min(...hits.map((rect) => rect.x));
  const minY = Math.min(...hits.map((rect) => rect.y));
  const maxX = Math.max(...hits.map((rect) => rect.x + rect.w));
  const maxY = Math.max(...hits.map((rect) => rect.y + rect.h));
  const union: PlacementRect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

  const overlapRatio = overlapArea(batch, union) / Math.max(1, batch.w * batch.h);
  if (overlapRatio < RELOCATION_MIN_OVERLAP_RATIO) return null;

  const candidates = [
    { dx: maxX + gap - batch.x, dy: 0 },
    { dx: minX - gap - (batch.x + batch.w), dy: 0 },
    { dx: 0, dy: maxY + gap - batch.y },
    { dx: 0, dy: minY - gap - (batch.y + batch.h) },
  ];
  let best = candidates[0]!;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = candidate.dx * candidate.dx + candidate.dy * candidate.dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

export function translateInput(
  input: AgentDrawShapeInput,
  dx: number,
  dy: number,
): AgentDrawShapeInput {
  const geometry = input.geometry;
  if (geometry.kind === 'rect') {
    return { ...input, geometry: { ...geometry, x: geometry.x + dx, y: geometry.y + dy } };
  }
  if (geometry.kind === 'segment') {
    return {
      ...input,
      geometry: {
        ...geometry,
        from: { x: geometry.from.x + dx, y: geometry.from.y + dy },
        to: { x: geometry.to.x + dx, y: geometry.to.y + dy },
      },
    };
  }
  if (geometry.kind === 'points') {
    return {
      ...input,
      geometry: {
        ...geometry,
        points: geometry.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
      },
    };
  }
  if (geometry.kind === 'text') {
    return { ...input, geometry: { ...geometry, x: geometry.x + dx, y: geometry.y + dy } };
  }
  return input;
}

/**
 * Nudge standalone text shapes apart when their estimated extents collide
 * with an earlier text shape in the same batch. Text only: boxes may hold
 * text deliberately (containers, section frames), so box collisions stay
 * the model's call, but text over text is always a defect.
 */
export function resolveTextCollisions(
  inputs: readonly AgentDrawShapeInput[],
): AgentDrawShapeInput[] {
  const out: AgentDrawShapeInput[] = [];
  const placedTextRects: PlacementRect[] = [];
  for (const input of inputs) {
    if (input.kind !== 'text' || input.geometry.kind !== 'text') {
      out.push(input);
      continue;
    }
    let current = input;
    let rect = estimateInputRect(current);
    if (rect === null) {
      out.push(current);
      continue;
    }
    for (const placed of placedTextRects) {
      if (overlapArea(rect!, placed) === 0) continue;
      // Minimal separation vector: push along whichever axis clears the
      // collision with the smaller move, away from the placed text.
      const pushRight = placed.x + placed.w + TEXT_NUDGE_GAP - rect!.x;
      const pushLeft = rect!.x + rect!.w + TEXT_NUDGE_GAP - placed.x;
      const pushDown = placed.y + placed.h + TEXT_NUDGE_GAP - rect!.y;
      const pushUp = rect!.y + rect!.h + TEXT_NUDGE_GAP - placed.y;
      const moves: Array<{ dx: number; dy: number; cost: number }> = [
        { dx: pushRight, dy: 0, cost: Math.abs(pushRight) },
        { dx: -pushLeft, dy: 0, cost: Math.abs(pushLeft) },
        { dx: 0, dy: pushDown, cost: Math.abs(pushDown) },
        { dx: 0, dy: -pushUp, cost: Math.abs(pushUp) },
      ];
      moves.sort((a, b) => a.cost - b.cost);
      const move = moves[0]!;
      if (move.cost > TEXT_NUDGE_MAX) continue;
      current = translateInput(current, move.dx, move.dy);
      rect = estimateInputRect(current);
      if (rect === null) break;
    }
    if (rect !== null) placedTextRects.push(rect);
    out.push(current);
  }
  return out;
}

/** Strokes flatter than this are treated as underline accents. */
const UNDERLINE_MAX_HEIGHT = 24;
const UNDERLINE_GAP = 6;

/**
 * Drop flat freehand accents below any batch text they cross. Models draw
 * title underlines by guessing the rendered glyph height and routinely land
 * the stroke mid-glyph, which reads as a strikethrough (the "Zephyr-9"
 * defect). A flat stroke overlapping a text estimate slides straight down
 * to just under that text. Tall strokes (circles, arcs, emphasis loops)
 * overlap content deliberately and stay put.
 */
export function resolveUnderlineAccents(
  inputs: readonly AgentDrawShapeInput[],
): AgentDrawShapeInput[] {
  const textRects: PlacementRect[] = [];
  for (const input of inputs) {
    if (input.kind !== 'text' || input.geometry.kind !== 'text') continue;
    const rect = estimateInputRect(input);
    if (rect !== null) textRects.push(rect);
  }
  if (textRects.length === 0) return [...inputs];
  return inputs.map((input) => {
    if (input.kind !== 'freehand' || input.geometry.kind !== 'points') return input;
    const rect = estimateInputRect(input);
    if (rect === null || rect.h > UNDERLINE_MAX_HEIGHT) return input;
    let dy = 0;
    for (const text of textRects) {
      const shifted = { ...rect, y: rect.y + dy };
      if (overlapArea(shifted, text) === 0) continue;
      dy += text.y + text.h + UNDERLINE_GAP - shifted.y;
    }
    return dy > 0 ? translateInput(input, 0, dy) : input;
  });
}
