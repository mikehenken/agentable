/**
 * Pure layout lints over the read_canvas shape graph (see-and-fix loop).
 *
 * After each drawing round the chat client reads the canvas, computes these
 * lints, and hands them to the model together with a screenshot so it can
 * correct overlaps, chat collisions, and cut-off work before replying.
 * Engine-agnostic: consumes only the serialized perception graph, never the
 * editor.
 */
import type {
  CanvasShapeGraph,
  CanvasShapeGraphNode,
} from '../engine/canvasPerceptionTypes';

interface RectLike {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MAX_REPORTED_OVERLAPS = 4;
/** Ignore sliver intersections below this area (page units squared). */
const MIN_OVERLAP_AREA = 64;
const LABEL_MAX_CHARS = 28;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Defensive reader for a tool-result payload that should be a shape graph.
 * The graph is produced by our own serializer, so a structural check on the
 * two load-bearing fields is enough.
 */
export function readShapeGraph(value: unknown): CanvasShapeGraph | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.shapes) || !isRecord(value.region)) return null;
  return value as unknown as CanvasShapeGraph;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value: null;
}

function nodeRect(node: CanvasShapeGraphNode): RectLike | null {
  const geometry = node.geometry;
  // Text geometry carries w/h only when the host measured the rendered
  // shape; unmeasured text has no reliable extent and is skipped.
  if (geometry.kind !== 'rect' && geometry.kind !== 'panel' && geometry.kind !== 'text') {
    return null;
  }
  const x = finite(geometry.x);
  const y = finite(geometry.y);
  const w = finite(geometry.w);
  const h = finite(geometry.h);
  if (x === null || y === null || w === null || h === null) return null;
  return { x, y, w, h };
}

function overlapArea(a: RectLike, b: RectLike): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h: 0;
}

function contains(outer: RectLike, inner: RectLike): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

function labelFor(node: CanvasShapeGraphNode): string {
  const text = typeof node.text === 'string' ? node.text.trim() : '';
  if (text.length > 0) {
    const short =
      text.length > LABEL_MAX_CHARS ? `${text.slice(0, LABEL_MAX_CHARS)}...`: text;
    return `"${short}"`;
  }
  return `the ${node.kind ?? node.nativeType} at (${Math.round(
    (node.geometry as { x?: number }).x ?? 0)}, ${Math.round((node.geometry as { y?: number }).y ?? 0)})`;
}

export interface CanvasLintOptions {
  /** Restrict "your shapes" lints to marks stamped for this agent. */
  agentId?: string;
}

const FREE_REGION_GAP = 48;
const FREE_REGION_MIN_SIZE = 280;

/**
 * Bounding box for any obstacle a redraw must avoid: panels, boxes,
 * ellipses, measured text, and arrows (via their segment endpoints).
 */
function obstacleRect(node: CanvasShapeGraphNode): RectLike | null {
  const direct = nodeRect(node);
  if (direct !== null) return direct;
  const geometry = node.geometry as {
    kind?: string;
    from?: { x?: number; y?: number };
    to?: { x?: number; y?: number };
  };
  if (geometry.kind === 'segment' && geometry.from && geometry.to) {
    const x1 = finite(geometry.from.x);
    const y1 = finite(geometry.from.y);
    const x2 = finite(geometry.to.x);
    const y2 = finite(geometry.to.y);
    if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.max(1, Math.abs(x2 - x1)),
      h: Math.max(1, Math.abs(y2 - y1)),
    };
  }
  return null;
}

/**
 * Largest rectangular area of the visible region not covered by any open
 * panel or existing agent drawing. Returned in page coordinates so a model
 * can redraw straight into it. Previously only panels counted as
 * obstacles, so this hint pointed redraws directly at the previous
 * drawing and the model piled compositions on top of each other. Null only
 * when the visible region itself is too small to hold anything.
 */
export function suggestFreeRegion(graph: CanvasShapeGraph): RectLike | null {
  const region = graph.region;
  const inset: RectLike = {
    x: region.x + FREE_REGION_GAP,
    y: region.y + FREE_REGION_GAP,
    w: region.w - FREE_REGION_GAP * 2,
    h: region.h - FREE_REGION_GAP * 2,
  };
  if (inset.w < FREE_REGION_MIN_SIZE || inset.h < FREE_REGION_MIN_SIZE) {
    return null;
  }

  const obstacleRects = graph.shapes.filter((node) => node.kind === 'panel' || typeof node.agentId === 'string').map((node) => obstacleRect(node)).filter((rect): rect is RectLike => rect !== null).filter((rect) => overlapArea(rect, inset) > 0);
  if (obstacleRects.length === 0) {
    return inset;
  }

  // One obstacle box covering everything keeps the search simple and is
  // exact for the dominant one-panel-one-drawing case.
  const minX = Math.min(...obstacleRects.map((rect) => rect.x));
  const minY = Math.min(...obstacleRects.map((rect) => rect.y));
  const maxX = Math.max(...obstacleRects.map((rect) => rect.x + rect.w));
  const maxY = Math.max(...obstacleRects.map((rect) => rect.y + rect.h));

  const candidates: RectLike[] = [
    { x: inset.x, y: inset.y, w: minX - FREE_REGION_GAP - inset.x, h: inset.h },
    {
      x: maxX + FREE_REGION_GAP,
      y: inset.y,
      w: inset.x + inset.w - (maxX + FREE_REGION_GAP),
      h: inset.h,
    },
    { x: inset.x, y: inset.y, w: inset.w, h: minY - FREE_REGION_GAP - inset.y },
    {
      x: inset.x,
      y: maxY + FREE_REGION_GAP,
      w: inset.w,
      h: inset.y + inset.h - (maxY + FREE_REGION_GAP),
    },
  ];
  let best: RectLike | null = null;
  for (const candidate of candidates) {
    if (candidate.w < FREE_REGION_MIN_SIZE || candidate.h < FREE_REGION_MIN_SIZE) {
      continue;
    }
    if (best === null || candidate.w * candidate.h > best.w * best.h) {
      best = candidate;
    }
  }
  if (best !== null) {
    return best;
  }
  // Everything visible is occupied. The canvas is infinite: the open space
  // just right of the obstacles is always available, and the camera
  // follows the drawing there.
  return {
    x: maxX + FREE_REGION_GAP,
    y: inset.y,
    w: Math.max(inset.w, FREE_REGION_MIN_SIZE * 2),
    h: inset.h,
  };
}

/**
 * Human-readable layout problems the model should fix before replying.
 * Returns an empty array when the layout passes every check.
 */
export function computeCanvasLints(
  graph: CanvasShapeGraph,
  options: CanvasLintOptions = {}): string[] {
  const lints: string[] = [];
  const region = graph.region;

  const solids = graph.shapes.filter(
    (node) => (node.kind === 'box' || node.kind === 'ellipse') && nodeRect(node) !== null);
  // Text joins the visibility checks (under a panel, cut off) but not the
  // overlap checks: labels legitimately sit close to other shapes.
  const content = graph.shapes.filter(
    (node) =>
      (node.kind === 'box' || node.kind === 'ellipse' || node.kind === 'text') &&
      nodeRect(node) !== null);
  const panels = graph.shapes.filter(
    (node) => node.kind === 'panel' && nodeRect(node) !== null);

  // 1. Partial overlaps between solid shapes. Full containment is allowed:
  // a container box holding smaller boxes is a deliberate grouping pattern.
  let reported = 0;
  let unreported = 0;
  for (let i = 0; i < solids.length; i += 1) {
    for (let j = i + 1; j < solids.length; j += 1) {
      const a = nodeRect(solids[i]!)!;
      const b = nodeRect(solids[j]!)!;
      const area = overlapArea(a, b);
      if (area < MIN_OVERLAP_AREA) continue;
      if (contains(a, b) || contains(b, a)) continue;
      if (reported < MAX_REPORTED_OVERLAPS) {
        lints.push(
          `${labelFor(solids[i]!)} and ${labelFor(solids[j]!)} overlap; separate them.`);
        reported += 1;
      } else {
        unreported += 1;
      }
    }
  }
  if (unreported > 0) {
    lints.push(`${unreported} more shape pairs also overlap.`);
  }

  // 1b. Shapes butted edge-to-edge read as one subdivided slab, not a
  // sketch. Flag near-touching pairs (not already reported as overlaps).
  const TOUCH_GAP = 10;
  let touchesReported = 0;
  for (let i = 0; i < solids.length && touchesReported < 3; i += 1) {
    for (let j = i + 1; j < solids.length && touchesReported < 3; j += 1) {
      const a = nodeRect(solids[i]!)!;
      const b = nodeRect(solids[j]!)!;
      if (contains(a, b) || contains(b, a)) continue;
      if (overlapArea(a, b) >= MIN_OVERLAP_AREA) continue;
      const grown: RectLike = {
        x: a.x - TOUCH_GAP,
        y: a.y - TOUCH_GAP,
        w: a.w + TOUCH_GAP * 2,
        h: a.h + TOUCH_GAP * 2,
      };
      if (overlapArea(grown, b) > 0) {
        lints.push(
          `${labelFor(solids[i]!)} and ${labelFor(solids[j]!)} touch; add breathing room between them.`);
        touchesReported += 1;
      }
    }
  }

  // 2. Drawing content sitting under an open panel (the chat panel above all).
  let anyUnderPanel = false;
  for (const panel of panels) {
    const panelRect = nodeRect(panel)!;
    const covered = content.filter((node) => {
      if (options.agentId !== undefined && node.agentId !== options.agentId) {
        return false;
      }
      return overlapArea(nodeRect(node)!, panelRect) >= MIN_OVERLAP_AREA;
    });
    if (covered.length === 0) continue;
    anyUnderPanel = true;
    const panelName = panel.panel?.panelId ? `"${panel.panel.panelId}"`: 'an open';
    lints.push(
      `${covered.length} of your shapes sit under the ${panelName} panel (for example ${labelFor(covered[0]!)}); move them clear of it.`);
  }
  // Actionable follow-up: the model draws in page coordinates, so telling it
  // WHERE the clear space is lets one redraw converge instead of guessing.
  if (anyUnderPanel) {
    const free = suggestFreeRegion(graph);
    if (free !== null) {
      lints.push(
        `Clear canvas space runs from x ${Math.round(free.x)} to ${Math.round(
          free.x + free.w)}, y ${Math.round(free.y)} to ${Math.round(
          free.y + free.h)}; place every shape inside that area.`);
    }
  }

  // 3. Shapes cut off by the edge of the current view. The graph only holds
  // shapes intersecting the region, so an edge-crossing rect means the user
  // sees it clipped.
  const cutOff = content.filter((node) => {
    if (options.agentId !== undefined && node.agentId !== options.agentId) {
      return false;
    }
    const rect = nodeRect(node)!;
    return (
      rect.x < region.x ||
      rect.y < region.y ||
      rect.x + rect.w > region.x + region.w ||
      rect.y + rect.h > region.y + region.h
    );
  });
  if (cutOff.length > 0) {
    lints.push(
      `${cutOff.length} of your shapes extend past the visible view (for example ${labelFor(cutOff[0]!)}).`);
  }

  // 4. A multi-node sketch with no connectors usually means the model drew
  // the boxes and forgot the relationships the user asked about.
  const agentSolids = solids.filter(
    (node) => options.agentId === undefined || node.agentId === options.agentId);
  const agentConnectors = graph.shapes.filter(
    (node) =>
      (node.kind === 'arrow' || node.kind === 'freehand') &&
      (options.agentId === undefined || node.agentId === options.agentId));
  if (agentSolids.length >= 3 && agentConnectors.length === 0) {
    lints.push(
      'Your sketch has no connecting arrows; if the request involves flow, sequence, or connections, add arrows between the related shapes.');
  }

  if (graph.truncated === true) {
    lints.push('The canvas holds more shapes than the read budget returned.');
  }

  return lints;
}
