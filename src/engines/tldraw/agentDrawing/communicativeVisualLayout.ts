/**
 * Deterministic auto-layout for agent communicative visuals.
 *
 * Pure functions: identical diagram + mode + bounds always yield the same
 * node positions. Agents supply logical structure only.
 */
import type {
  AgentDiagramEdge,
  AgentDiagramLayoutMode,
  AgentDiagramNode,
  AgentDiagramStructure,
} from '../../../engine/agentDrawingTypes';

export interface LayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PositionedDiagramNode {
  node: AgentDiagramNode;
  rect: LayoutRect;
}

export interface DiagramLayoutResult {
  nodes: readonly PositionedDiagramNode[];
  /** Bounding box of all positioned nodes before origin offset. */
  contentBounds: LayoutBounds;
}

/**
 * Fallback / minimum node footprint. Individual nodes size themselves to
 * their own label via `estimateNodeSize` below; these constants remain the
 * floor for very short labels and the baseline other layout math (gaps,
 * radial radius) scales from.
 */
export const DIAGRAM_NODE_WIDTH = 160;
export const DIAGRAM_NODE_HEIGHT = 64;
export const DIAGRAM_NODE_GAP_X = 48;
export const DIAGRAM_NODE_GAP_Y = 64;
export const DIAGRAM_RADIAL_RADIUS = 180;
export const DIAGRAM_PADDING = 24;
/** Inner padding for container nodes in nested layout. */
export const NESTED_PADDING = 32;
/** Horizontal gap between top-level regions (e.g. AWS | peering | GCP). */
export const NESTED_TOP_LEVEL_GAP = 96;

const TWO_PI = Math.PI * 2;

/**
 * Label-fitted node sizing (follow-up).
 *
 * Every layout mode used to place every node at the same fixed
 * `DIAGRAM_NODE_WIDTH` x `DIAGRAM_NODE_HEIGHT` box regardless of label
 * length, so anything longer than a couple of words overflowed its box
 * (the node text is a separate shape drawn on top, sized to
 * `rect.w - 16`, so an undersized rect directly overflows the label). This
 * estimates a per-node width from the label's character count, wraps to a
 * second line and grows the height when a label would still overflow the
 * max single-line width, and enforces a sensible minimum so short labels
 * ("Lead") do not shrink to an unreadably small box.
 * Calibrated for tldraw's internal geo label at size "m" (~22px draw font),
 * which is what diagram nodes render since labels moved inside the shape.
 */
const NODE_CHAR_WIDTH_ESTIMATE = 11;
const NODE_HORIZONTAL_PADDING = 36;
/** Wider floor so cloud provider names ("Amazon Web Services") stay on one line. */
const NODE_MIN_WIDTH = 192;
const NODE_MAX_WIDTH = 280;
const NODE_LINE_HEIGHT = 28;
const NODE_VERTICAL_PADDING = 24;
const NODE_MIN_HEIGHT = DIAGRAM_NODE_HEIGHT;

export interface EstimatedNodeSize {
  w: number;
  h: number;
}

/**
 * How a layout learns each node's footprint. Defaults to the label-based
 * estimate; `arrange` passes real measured shape bounds instead, so
 * re-layout of existing shapes spaces them by what is actually on the
 * canvas rather than by a guess (a radial ring sized for guessed boxes
 * piles real 200px-wide ellipses on top of each other).
 */
export type NodeMeasure = (node: AgentDiagramNode) => EstimatedNodeSize;

const measureByLabel: NodeMeasure = (node) => estimateNodeSize(node.label, node.kind ?? 'box');

/**
 * An ellipse inscribes its label in roughly 70% of its bounding width, so
 * ellipse nodes need wider footprints than boxes for the same label or the
 * longest word wraps mid-word ("Inertia l Nav").
 */
export const ELLIPSE_LABEL_WIDTH_FACTOR = 1.4;

export function estimateNodeSize(
  label: string,
  kind: 'box' | 'ellipse' | 'container' = 'box'): EstimatedNodeSize {
  const widthFactor = kind === 'ellipse' ? ELLIPSE_LABEL_WIDTH_FACTOR : 1;
  const length = Math.max(1, label.trim().length || 1);
  const singleLineWidth = length * NODE_CHAR_WIDTH_ESTIMATE * widthFactor + NODE_HORIZONTAL_PADDING;
  // The box must hold its longest word on one line: tldraw wraps between
  // words, but a word wider than the box wraps mid-word ("Functio ns").
  const longestWord = label.trim().split(/[\s/]+/).filter((word) => word.length > 0).reduce((max, word) => Math.max(max, word.length), 1);
  const longestWordWidth =
    longestWord * NODE_CHAR_WIDTH_ESTIMATE * widthFactor + NODE_HORIZONTAL_PADDING;
  const capped = Math.min(NODE_MAX_WIDTH, Math.max(NODE_MIN_WIDTH, Math.ceil(singleLineWidth)));
  const w = Math.max(capped, Math.ceil(longestWordWidth));

  const usableWidth = Math.max(1, (w - NODE_HORIZONTAL_PADDING) / widthFactor);
  const charsPerLine = Math.max(1, Math.floor(usableWidth / NODE_CHAR_WIDTH_ESTIMATE));
  const lineCount = Math.max(1, Math.ceil(length / charsPerLine));
  const h = Math.max(NODE_MIN_HEIGHT, lineCount * NODE_LINE_HEIGHT + NODE_VERTICAL_PADDING);

  return { w, h };
}

/**
 * Edge-label-aware gap sizing (owner-reported defect, iteration 5).
 *
 * tldraw renders an arrow's label as a pill whose maximum width tracks the
 * arrow's length. A labeled edge squeezed into the default node gap wraps
 * mid-word ("IMU/G PS Data") and the pill spills over the boxes it links.
 * These helpers compute the gap an edge needs for its pill to render whole
 * and stay between the boxes.
 * Arrow labels render at the small label size; keep in step with
 * LABEL_CHAR_WIDTH.s in agentDrawingApi.
 */
const EDGE_LABEL_CHAR_WIDTH = 11;
// Labels longer than this wrap at word boundaries into two lines instead
// of stretching the whole row apart.
const EDGE_LABEL_MAX_LINE_WIDTH = 220;
// Pill padding plus anchor gaps at both ends of the arrow.
const EDGE_LABEL_CLEARANCE = 36;
const EDGE_LABEL_LINE_HEIGHT = 26;

function labelMetrics(label: string): { longestWordWidth: number; fullWidth: number } {
  const longestWord = label.split(/\s+/).reduce((max, word) => Math.max(max, word.length), 1);
  return {
    longestWordWidth: longestWord * EDGE_LABEL_CHAR_WIDTH,
    fullWidth: label.length * EDGE_LABEL_CHAR_WIDTH,
  };
}

/**
 * Fixed render width for an edge label text shape: the whole label on one
 * line up to the max, never narrower than its longest word. Rendering
 * labels as fixed-width text (instead of arrow label pills) keeps them
 * whole no matter how short the arrow gets.
 */
export function edgeLabelTextWidth(label: string): number {
  const trimmed = label.trim();
  if (trimmed.length === 0) return 0;
  const { longestWordWidth, fullWidth } = labelMetrics(trimmed);
  return Math.max(longestWordWidth, Math.min(fullWidth, EDGE_LABEL_MAX_LINE_WIDTH)) + 8;
}

/** Estimated rendered height for an edge label at its fixed width. */
export function edgeLabelTextHeight(label: string): number {
  const trimmed = label.trim();
  if (trimmed.length === 0) return 0;
  const { fullWidth } = labelMetrics(trimmed);
  const width = Math.max(1, edgeLabelTextWidth(trimmed) - 8);
  const lines = Math.max(1, Math.ceil(fullWidth / width));
  return lines * EDGE_LABEL_LINE_HEIGHT;
}

/** Clearance between an edge and its label text. */
export const EDGE_LABEL_TEXT_OFFSET = 16;

/**
 * Center point for an edge's label: the arrow midpoint (arc apex when the
 * edge is bent; tldraw offsets a bent midpoint by (uy, -ux) * -bend),
 * pushed off the line so the text never reads as struck through. Prefers
 * above for horizontal edges and right for vertical ones.
 */
export function edgeLabelAnchor(
  from: { x: number; y: number },
  to: { x: number; y: number },
  bend = 0): { x: number; y: number } {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  let nx = -uy;
  let ny = ux;
  if (ny > 0 || (ny === 0 && nx < 0)) {
    nx = -nx;
    ny = -ny;
  }
  return {
    x: midX - bend * uy + nx * EDGE_LABEL_TEXT_OFFSET,
    y: midY + bend * ux + ny * EDGE_LABEL_TEXT_OFFSET,
  };
}

/** Horizontal gap a labeled edge needs between flow neighbors. */
export function edgeLabelFlowGap(label: string | undefined): number {
  const trimmed = label?.trim() ?? '';
  if (trimmed.length === 0) return 0;
  const { longestWordWidth, fullWidth } = labelMetrics(trimmed);
  const lineWidth = Math.max(longestWordWidth, Math.min(fullWidth, EDGE_LABEL_MAX_LINE_WIDTH));
  return lineWidth + EDGE_LABEL_CLEARANCE;
}

/**
 * Vertical gap a labeled edge needs between timeline neighbors: the pill
 * must fit its longest word across the arrow (the pill's max width tracks
 * arrow length even for vertical arrows) and its wrapped lines along it.
 */
export function edgeLabelTimelineGap(label: string | undefined): number {
  const trimmed = label?.trim() ?? '';
  if (trimmed.length === 0) return 0;
  const { longestWordWidth, fullWidth } = labelMetrics(trimmed);
  const lines = Math.max(1, Math.ceil(fullWidth / Math.max(1, longestWordWidth)));
  return Math.max(
    longestWordWidth + EDGE_LABEL_CLEARANCE,
    lines * EDGE_LABEL_LINE_HEIGHT + EDGE_LABEL_CLEARANCE);
}

/**
 * Per-pair gaps for a sequential layout: the base gap, widened wherever a
 * labeled edge joins two neighbors so its pill has room. Edges that skip
 * over nodes do not widen gaps; they arc over the row instead (routeEdge).
 */
function sequentialGaps(
  ordered: readonly AgentDiagramNode[],
  edges: readonly AgentDiagramEdge[] | undefined,
  baseGap: number,
  gapForLabel: (label: string | undefined) => number): number[] {
  const gaps: number[] = new Array(Math.max(0, ordered.length - 1)).fill(baseGap);
  if (edges === undefined || edges.length === 0) {
    return gaps;
  }
  const indexById = new Map(ordered.map((node, index) => [node.id, index]));
  for (const edge of edges) {
    const from = indexById.get(edge.from);
    const to = indexById.get(edge.to);
    if (from === undefined || to === undefined) continue;
    if (Math.abs(from - to) !== 1) continue;
    const required = gapForLabel(edge.label);
    const gapIndex = Math.min(from, to);
    if (required > gaps[gapIndex]!) {
      gaps[gapIndex] = required;
    }
  }
  return gaps;
}

function resolveNodeOrder(diagram: AgentDiagramStructure): readonly AgentDiagramNode[] {
  const byId = new Map(diagram.nodes.map((node) => [node.id, node]));
  if (diagram.order !== undefined && diagram.order.length > 0) {
    const ordered: AgentDiagramNode[] = [];
    for (const id of diagram.order) {
      const node = byId.get(id);
      if (node !== undefined) {
        ordered.push(node);
      }
    }
    for (const node of diagram.nodes) {
      if (!ordered.some((entry) => entry.id === node.id)) {
        ordered.push(node);
      }
    }
    return ordered;
  }
  return diagram.nodes;
}

function mergeBounds(a: LayoutBounds, b: LayoutBounds): LayoutBounds {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.w, b.x + b.w);
  const maxY = Math.max(a.y + a.h, b.y + b.h);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function boundsFromRects(rects: readonly LayoutRect[]): LayoutBounds {
  if (rects.length === 0) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  let merged = { x: rects[0]!.x, y: rects[0]!.y, w: rects[0]!.w, h: rects[0]!.h };
  for (let index = 1; index < rects.length; index += 1) {
    merged = mergeBounds(merged, rects[index]!);
  }
  return merged;
}

function layoutFlow(
  nodes: readonly AgentDiagramNode[],
  gaps: readonly number[],
  measure: NodeMeasure): DiagramLayoutResult {
  const positioned: PositionedDiagramNode[] = [];
  let cursorX = 0;
  let rowHeight = DIAGRAM_NODE_HEIGHT;
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!;
    const size = measure(node);
    positioned.push({ node, rect: { x: cursorX, y: 0, w: size.w, h: size.h } });
    cursorX += size.w + (gaps[index] ?? DIAGRAM_NODE_GAP_X);
    rowHeight = Math.max(rowHeight, size.h);
  }
  // Re-center every box vertically against the tallest box in the row (a
  // wrapped, two-line label) so a short "Lead" box and a wrapped
  // "Regional Director" box still line up on the same visual row instead
  // of the short one sitting flush to the top.
  for (const entry of positioned) {
    entry.rect.y = (rowHeight - entry.rect.h) / 2;
  }
  return {
    nodes: positioned,
    contentBounds: boundsFromRects(positioned.map((entry) => entry.rect)),
  };
}

function layoutTimeline(
  nodes: readonly AgentDiagramNode[],
  gaps: readonly number[],
  measure: NodeMeasure): DiagramLayoutResult {
  const sizes = nodes.map((node) => measure(node));
  // A vertical column reads as one list, so every box shares the widest
  // node's width (uniform column) while each box keeps its own height (a
  // wrapped label grows its own row without stretching every other row).
  const columnWidth = Math.max(DIAGRAM_NODE_WIDTH, ...sizes.map((size) => size.w));
  const positioned: PositionedDiagramNode[] = [];
  let cursorY = 0;
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!;
    const size = sizes[index]!;
    positioned.push({ node, rect: { x: 0, y: cursorY, w: columnWidth, h: size.h } });
    cursorY += size.h + (gaps[index] ?? DIAGRAM_NODE_GAP_Y);
  }
  return {
    nodes: positioned,
    contentBounds: boundsFromRects(positioned.map((entry) => entry.rect)),
  };
}

function layoutRadial(
  nodes: readonly AgentDiagramNode[],
  edges: readonly AgentDiagramEdge[] | undefined,
  measure: NodeMeasure): DiagramLayoutResult {
  if (nodes.length === 0) {
    return { nodes: [], contentBounds: { x: 0, y: 0, w: 0, h: 0 } };
  }

  const positioned: PositionedDiagramNode[] = [];
  const centerNode = nodes[0]!;
  const centerSize = measure(centerNode);
  positioned.push({
    node: centerNode,
    rect: {
      x: -centerSize.w / 2,
      y: -centerSize.h / 2,
      w: centerSize.w,
      h: centerSize.h,
    },
  });

  const orbitNodes = nodes.slice(1);
  const orbitSizes = orbitNodes.map((node) => measure(node));
  const orbitCount = orbitNodes.length;
  // Scale the orbit radius up only by however much the largest orbiting
  // box exceeds the default node footprint, so the default (short-label)
  // case keeps exactly DIAGRAM_RADIAL_RADIUS, while nodes with longer
  // labels - which are wider or taller than default - push the ring out
  // far enough that evenly-angle-spaced boxes still clear each other
  // instead of overlapping at a radius sized for the old constant boxes.
  const maxOrbitDim = orbitSizes.reduce(
    (max, size) => Math.max(max, size.w, size.h),
    DIAGRAM_NODE_WIDTH);
  const sizeExcess = Math.max(0, maxOrbitDim - DIAGRAM_NODE_WIDTH);
  const circumferenceFloor = orbitCount > 1 ? (maxOrbitDim * 1.4 * orbitCount) / TWO_PI : 0;
  // A labeled spoke needs enough open run between the hub border and the
  // orbit border for its label pill; otherwise the pill lands on a box.
  // Half-diagonals, not half-widths: on a diagonal spoke a box eats into
  // the run by up to half its diagonal, and an under-measured run wraps
  // the pill mid-word ("downl ink").
  const maxSpokeLabel = (edges ?? []).reduce(
    (max, edge) => Math.max(max, edgeLabelFlowGap(edge.label)),
    0);
  const centerHalfDiagonal = Math.hypot(centerSize.w, centerSize.h) / 2;
  const orbitHalfDiagonal =
    orbitSizes.reduce((max, size) => Math.max(max, Math.hypot(size.w, size.h)), 0) / 2;
  const labelFloor =
    maxSpokeLabel > 0 ? centerHalfDiagonal + orbitHalfDiagonal + maxSpokeLabel + 16 : 0;
  const radius = Math.max(
    DIAGRAM_RADIAL_RADIUS + sizeExcess * 1.2,
    circumferenceFloor,
    labelFloor);

  for (let index = 0; index < orbitNodes.length; index += 1) {
    const node = orbitNodes[index]!;
    const size = orbitSizes[index]!;
    const angle = orbitCount <= 1 ? -Math.PI / 2 : (TWO_PI * index) / orbitCount - Math.PI / 2;
    const cx = radius * Math.cos(angle);
    const cy = radius * Math.sin(angle);
    positioned.push({
      node,
      rect: { x: cx - size.w / 2, y: cy - size.h / 2, w: size.w, h: size.h },
    });
  }

  return {
    nodes: positioned,
    contentBounds: boundsFromRects(positioned.map((entry) => entry.rect)),
  };
}

interface NestedSubtreeLayout {
  w: number;
  h: number;
  /** Container node plus all descendants, coordinates relative to subtree origin. */
  nodes: PositionedDiagramNode[];
}

/**
 * Recursively layout one node and its descendants. Leaf nodes use measured
 * size; containers stack children vertically with NESTED_PADDING and grow to
 * fit the widest/tallest subtree.
 */
function layoutNestedSubtree(
  node: AgentDiagramNode,
  childrenByParent: ReadonlyMap<string, readonly AgentDiagramNode[]>,
  measure: NodeMeasure): NestedSubtreeLayout {
  const children = childrenByParent.get(node.id) ?? [];

  if (children.length === 0) {
    const size = measure(node);
    return {
      w: size.w,
      h: size.h,
      nodes: [{ node, rect: { x: 0, y: 0, w: size.w, h: size.h } }],
    };
  }

  const childSubtrees: NestedSubtreeLayout[] = [];
  let cursorY = NESTED_PADDING;
  let innerMaxW = 0;

  for (const child of children) {
    const subtree = layoutNestedSubtree(child, childrenByParent, measure);
    childSubtrees.push(subtree);
    innerMaxW = Math.max(innerMaxW, subtree.w);
    cursorY += subtree.h + DIAGRAM_NODE_GAP_Y;
  }

  const innerH = cursorY - DIAGRAM_NODE_GAP_Y + NESTED_PADDING;
  const parentSize = measure(node);
  const w = Math.max(parentSize.w, innerMaxW + NESTED_PADDING * 2);
  const h = Math.max(parentSize.h, innerH);

  const nodes: PositionedDiagramNode[] = [
    { node, rect: { x: 0, y: 0, w, h } },
  ];

  cursorY = NESTED_PADDING;
  for (const subtree of childSubtrees) {
    for (const entry of subtree.nodes) {
      nodes.push({
        node: entry.node,
        rect: {
          x: NESTED_PADDING + entry.rect.x,
          y: cursorY + entry.rect.y,
          w: entry.rect.w,
          h: entry.rect.h,
        },
      });
    }
    cursorY += subtree.h + DIAGRAM_NODE_GAP_Y;
  }

  return { w, h, nodes };
}

function offsetNestedNodes(
  nodes: readonly PositionedDiagramNode[],
  offsetX: number,
  offsetY: number): PositionedDiagramNode[] {
  return nodes.map((entry) => ({
    node: entry.node,
    rect: {
      x: entry.rect.x + offsetX,
      y: entry.rect.y + offsetY,
      w: entry.rect.w,
      h: entry.rect.h,
    },
  }));
}

/**
 * Nested / layered layout for VPC, cloud, and architecture diagrams.
 * Top-level nodes (no parentId) form horizontal columns; container nodes
 * auto-size recursively to fit vertically stacked children with NESTED_PADDING.
 */
export function layoutNested(
  nodes: readonly AgentDiagramNode[],
  measure: NodeMeasure = measureByLabel): DiagramLayoutResult {
  if (nodes.length === 0) {
    return { nodes: [], contentBounds: { x: 0, y: 0, w: 0, h: 0 } };
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, AgentDiagramNode[]>();
  const topLevel: AgentDiagramNode[] = [];

  for (const node of nodes) {
    const parentId = node.parentId;
    if (parentId !== undefined && nodeById.has(parentId)) {
      const bucket = childrenByParent.get(parentId) ?? [];
      bucket.push(node);
      childrenByParent.set(parentId, bucket);
    } else {
      topLevel.push(node);
    }
  }

  const topLevelEntries = topLevel.map((node) =>
    layoutNestedSubtree(node, childrenByParent, measure));

  const rowHeight = Math.max(
    DIAGRAM_NODE_HEIGHT,...topLevelEntries.map((entry) => entry.h));
  const positioned: PositionedDiagramNode[] = [];
  let cursorX = 0;

  for (const entry of topLevelEntries) {
    const topY = (rowHeight - entry.h) / 2;
    positioned.push(...offsetNestedNodes(entry.nodes, cursorX, topY));
    cursorX += entry.w + NESTED_TOP_LEVEL_GAP;
  }

  return {
    nodes: positioned,
    contentBounds: boundsFromRects(positioned.map((entry) => entry.rect)),
  };
}

export function layoutDiagramNodes(
  mode: Exclude<AgentDiagramLayoutMode, 'none'>,
  diagram: AgentDiagramStructure,
  measure: NodeMeasure = measureByLabel): DiagramLayoutResult {
  const ordered = resolveNodeOrder(diagram);
  switch (mode) {
    case 'flow':
      return layoutFlow(
        ordered,
        sequentialGaps(ordered, diagram.edges, DIAGRAM_NODE_GAP_X, edgeLabelFlowGap),
        measure);
    case 'timeline':
      return layoutTimeline(
        ordered,
        sequentialGaps(ordered, diagram.edges, DIAGRAM_NODE_GAP_Y, edgeLabelTimelineGap),
        measure);
    case 'radial':
      return layoutRadial(ordered, diagram.edges, measure);
    case 'nested':
      return layoutNested(diagram.nodes, measure);
    default: {
      const exhaustive: never = mode;
      throw new Error(`unsupported layout mode: ${String(exhaustive)}`);
    }
  }
}

/** Shift layout so content is centered within the placement bounds. */
export function fitLayoutInBounds(
  layout: DiagramLayoutResult,
  bounds: LayoutBounds): DiagramLayoutResult {
  if (layout.nodes.length === 0) {
    return layout;
  }

  const content = layout.contentBounds;
  const availableW = Math.max(bounds.w - DIAGRAM_PADDING * 2, DIAGRAM_NODE_WIDTH);
  const availableH = Math.max(bounds.h - DIAGRAM_PADDING * 2, DIAGRAM_NODE_HEIGHT);
  const offsetX = bounds.x + DIAGRAM_PADDING + Math.max(0, (availableW - content.w) / 2) - content.x;
  const offsetY = bounds.y + DIAGRAM_PADDING + Math.max(0, (availableH - content.h) / 2) - content.y;

  const nodes = layout.nodes.map((entry) => ({
    node: entry.node,
    rect: {
      x: entry.rect.x + offsetX,
      y: entry.rect.y + offsetY,
      w: entry.rect.w,
      h: entry.rect.h,
    },
  }));

  return {
    nodes,
    contentBounds: boundsFromRects(nodes.map((entry) => entry.rect)),
  };
}

export function rectCenter(rect: LayoutRect): { x: number; y: number } {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

/** Breathing room between an arrow tip and the node border it points at. */
export const EDGE_ANCHOR_GAP = 6;

/**
 * Walk from a rect's center toward a target point and return where the
 * segment crosses the rect's boundary, pushed out by a small gap. Keeps
 * connectors between nodes instead of running straight through them: a
 * center-to-center arrow in a vertical stack crosses every box it links.
 */
export function rectEdgeAnchor(
  rect: LayoutRect,
  toward: { x: number; y: number }): { x: number; y: number } {
  const center = rectCenter(rect);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  if (dx === 0 && dy === 0) {
    return center;
  }
  // Scale the direction vector so it just reaches the boundary.
  const scaleX = dx !== 0 ? rect.w / 2 / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? rect.h / 2 / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  const length = Math.hypot(dx, dy);
  const gapScale = EDGE_ANCHOR_GAP / length;
  return {
    x: center.x + dx * (scale + gapScale),
    y: center.y + dy * (scale + gapScale),
  };
}

export interface RoutedEdge {
  from: { x: number; y: number };
  to: { x: number; y: number };
  /**
   * tldraw arc offset for the arrow midpoint. Non-zero only for edges that
   * skip over nodes in a sequential layout: the arc rises over the row
   * (negative bend arcs a left-to-right edge up and a top-to-bottom edge
   * right, since tldraw offsets the midpoint by (-uy, ux) * bend) instead
   * of cutting straight through every box in between.
   */
  bend: number;
}

const SKIP_EDGE_ARC_MARGIN = 64;

/**
 * Route one edge between two node rects: clip both ends to the node
 * boundaries, fall back to a plain center line when the rects overlap
 * (clipping can invert the segment into a backwards arrow), and arc over
 * any intermediate rects that sit between the endpoints in the layout
 * order.
 */
export function routeEdge(
  fromRect: LayoutRect,
  toRect: LayoutRect,
  intermediates: readonly LayoutRect[] = [],
  axis: 'x' | 'y' | null = null): RoutedEdge {
  const fromCenter = rectCenter(fromRect);
  const toCenter = rectCenter(toRect);
  let from = rectEdgeAnchor(fromRect, toCenter);
  let to = rectEdgeAnchor(toRect, fromCenter);
  const centerDx = toCenter.x - fromCenter.x;
  const centerDy = toCenter.y - fromCenter.y;
  const anchorDx = to.x - from.x;
  const anchorDy = to.y - from.y;
  if (centerDx * anchorDx + centerDy * anchorDy <= 0) {
    from = fromCenter;
    to = toCenter;
  }

  let bend = 0;
  if (axis !== null && intermediates.length > 0) {
    const maxPerp = intermediates.reduce(
      (max, rect) => Math.max(max, axis === 'x' ? rect.h : rect.w),
      0);
    if (maxPerp > 0) {
      bend = -(maxPerp / 2 + SKIP_EDGE_ARC_MARGIN);
    }
  }

  return { from, to, bend };
}
