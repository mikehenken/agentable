/**
 * Compile logical diagram structure into draw_shapes inputs (P8-T5).
 */
import type { Editor } from 'tldraw';
import { createShapeId } from 'tldraw';
import {
  AGENT_EDGE_FROM_META_KEY,
  AGENT_EDGE_LABEL_META_KEY,
  AGENT_EDGE_LABEL_TEXT_META_KEY,
  AGENT_EDGE_TO_META_KEY,
  type AgentDiagramEdge,
  type AgentDiagramPlacement,
  type AgentDiagramProgressive,
  type AgentDiagramStructure,
  type AgentDrawDiagramRequest,
  type AgentDrawShapeInput,
  type AgentDrawShapeStyle,
} from '../../../engine/agentDrawingTypes';
import {
  edgeLabelAnchor,
  edgeLabelTextHeight,
  edgeLabelTextWidth,
  fitLayoutInBounds,
  layoutDiagramNodes,
  routeEdge,
  type LayoutBounds,
  type LayoutRect,
  type PositionedDiagramNode,
} from './communicativeVisualLayout';
import { getChatPanelBounds } from '../choreography/chatReserved';

const DEFAULT_VIEWPORT_BOUNDS: LayoutBounds = { x: 0, y: 0, w: 1280, h: 840 };
const NEAR_PANEL_GAP = 32;
const VIEWPORT_PLACEMENT_MARGIN = 32;
const MIN_PLACEMENT_SIZE = 360;

/**
 * Default node colors by role so a diagram reads at a glance instead of
 * rendering monochrome: ellipses (terminals, actors) in green, boxes
 * (processes, systems) in blue. An explicit request style always wins.
 */
const NODE_ROLE_COLOR: Record<'box' | 'ellipse' | 'container', string> = {
  box: 'blue',
  ellipse: 'green',
  container: 'light-violet',
};

function panelShapeId(panelId: string): string {
  return String(createShapeId(`panel:${panelId}`));
}

function resolveNearPanelBounds(
  editor: Editor,
  panelId: string,
  side: 'right' | 'left' | 'bottom' | 'top' = 'right',
): LayoutBounds {
  const shapeId = panelShapeId(panelId);
  const bounds = editor.getShapePageBounds(shapeId as never);
  if (!bounds) {
    throw new Error(`panel "${panelId}" is not open on the canvas`);
  }
  switch (side) {
    case 'right':
      return {
        x: bounds.x + bounds.w + NEAR_PANEL_GAP,
        y: bounds.y,
        w: 640,
        h: Math.max(bounds.h, 480),
      };
    case 'left':
      return {
        x: bounds.x - NEAR_PANEL_GAP - 640,
        y: bounds.y,
        w: 640,
        h: Math.max(bounds.h, 480),
      };
    case 'bottom':
      return {
        x: bounds.x,
        y: bounds.y + bounds.h + NEAR_PANEL_GAP,
        w: Math.max(bounds.w, 640),
        h: 480,
      };
    case 'top':
      return {
        x: bounds.x,
        y: bounds.y - NEAR_PANEL_GAP - 480,
        w: Math.max(bounds.w, 640),
        h: 480,
      };
  }
}

/**
 * Shrink default viewport placement by a margin and steer it clear of the
 * open chat panel so agent drawings never land underneath the conversation.
 * Picks the largest clear region beside, above, or below the chat; falls
 * back to the plain inset bounds when the chat leaves no usable region.
 */
function chatAwareViewportBounds(editor: Editor, viewport: LayoutBounds): LayoutBounds {
  const inset: LayoutBounds = {
    x: viewport.x + VIEWPORT_PLACEMENT_MARGIN,
    y: viewport.y + VIEWPORT_PLACEMENT_MARGIN,
    w: viewport.w - VIEWPORT_PLACEMENT_MARGIN * 2,
    h: viewport.h - VIEWPORT_PLACEMENT_MARGIN * 2,
  };
  if (inset.w < MIN_PLACEMENT_SIZE || inset.h < MIN_PLACEMENT_SIZE) {
    return viewport;
  }

  const chat = getChatPanelBounds(editor);
  if (chat === null) {
    return inset;
  }
  const overlapW =
    Math.min(inset.x + inset.w, chat.x + chat.w) - Math.max(inset.x, chat.x);
  const overlapH =
    Math.min(inset.y + inset.h, chat.y + chat.h) - Math.max(inset.y, chat.y);
  if (overlapW <= 0 || overlapH <= 0) {
    return inset;
  }

  const gap = VIEWPORT_PLACEMENT_MARGIN;
  const candidates: LayoutBounds[] = [
    // Left of chat.
    { x: inset.x, y: inset.y, w: chat.x - gap - inset.x, h: inset.h },
    // Right of chat.
    {
      x: chat.x + chat.w + gap,
      y: inset.y,
      w: inset.x + inset.w - (chat.x + chat.w + gap),
      h: inset.h,
    },
    // Above chat.
    { x: inset.x, y: inset.y, w: inset.w, h: chat.y - gap - inset.y },
    // Below chat.
    {
      x: inset.x,
      y: chat.y + chat.h + gap,
      w: inset.w,
      h: inset.y + inset.h - (chat.y + chat.h + gap),
    },
  ];
  let best: LayoutBounds | null = null;
  for (const candidate of candidates) {
    if (candidate.w < MIN_PLACEMENT_SIZE || candidate.h < MIN_PLACEMENT_SIZE) {
      continue;
    }
    if (best === null || candidate.w * candidate.h > best.w * best.h) {
      best = candidate;
    }
  }
  return best ?? inset;
}

export function resolveDiagramPlacementBounds(
  editor: Editor,
  placement: AgentDiagramPlacement | undefined,
): LayoutBounds {
  if (placement === undefined || placement.kind === 'viewport') {
    const viewport = editor.getViewportPageBounds?.();
    if (viewport) {
      return chatAwareViewportBounds(editor, {
        x: viewport.x,
        y: viewport.y,
        w: viewport.w,
        h: viewport.h,
      });
    }
    return DEFAULT_VIEWPORT_BOUNDS;
  }
  if (placement.kind === 'rect') {
    if (placement.w <= 0 || placement.h <= 0) {
      throw new Error('placement rect requires positive width and height');
    }
    return {
      x: placement.x,
      y: placement.y,
      w: placement.w,
      h: placement.h,
    };
  }
  return resolveNearPanelBounds(editor, placement.panelId, placement.side);
}

function filterProgressiveNodes(
  nodes: readonly PositionedDiagramNode[],
  progressive: AgentDiagramProgressive | undefined,
): readonly PositionedDiagramNode[] {
  if (progressive === undefined) {
    return nodes;
  }
  if (!Number.isInteger(progressive.step) || progressive.step < 1) {
    throw new Error('progressive.step must be a positive integer');
  }
  return nodes.slice(0, progressive.step);
}

function visibleNodeIds(nodes: readonly PositionedDiagramNode[]): Set<string> {
  return new Set(nodes.map((entry) => entry.node.id));
}

function resolveEdges(diagram: AgentDiagramStructure): readonly AgentDiagramEdge[] {
  if (diagram.edges !== undefined && diagram.edges.length > 0) {
    return diagram.edges;
  }
  const order = diagram.order ?? diagram.nodes.map((node) => node.id);
  const sequential: AgentDiagramEdge[] = [];
  for (let index = 0; index < order.length - 1; index += 1) {
    sequential.push({ from: order[index]!, to: order[index + 1]! });
  }
  return sequential;
}

function nodeShapeInputs(
  entry: PositionedDiagramNode,
  style: AgentDrawShapeStyle | undefined,
): AgentDrawShapeInput[] {
  const kind = entry.node.kind ?? 'box';
  const nodeStyle: AgentDrawShapeStyle = {
    color: style?.color ?? NODE_ROLE_COLOR[kind === 'container' ? 'container' : kind],
    fill: style?.fill ?? (kind === 'container' ? 'semi' : 'semi'),
    dash: style?.dash ?? (kind === 'container' ? 'dashed' : 'draw'),
    size: style?.size ?? (kind === 'container' ? 'l' : 'm'),
  };
  // The label rides inside the geo shape (tldraw centers and wraps it), so
  // diagram text can never overlap or overflow its node.
  const shape: AgentDrawShapeInput = {
    kind: kind === 'container' ? 'box' : kind,
    // Stamp the logical node id so follow-up tools (connect_shapes,
    // group_shapes) can reference diagram nodes by their diagram id.
    id: entry.node.id,
    geometry: {
      kind: 'rect',
      x: entry.rect.x,
      y: entry.rect.y,
      w: entry.rect.w,
      h: entry.rect.h,
    },
    style: nodeStyle,
  };
  if (entry.node.label.length > 0) {
    shape.text = entry.node.label;
  }
  return [shape];
}

function edgeShapeInputs(
  edges: readonly AgentDiagramEdge[],
  positionedById: Map<string, PositionedDiagramNode>,
  visibleIds: Set<string>,
  style: AgentDrawShapeStyle | undefined,
  order: readonly string[],
  layout: AgentDrawDiagramRequest['layout'],
): AgentDrawShapeInput[] {
  const shapes: AgentDrawShapeInput[] = [];
  const indexById = new Map(order.map((id, index) => [id, index]));
  const axis = layout === 'flow' ? 'x' : layout === 'timeline' ? 'y' : null;
  for (const edge of edges) {
    if (!visibleIds.has(edge.from) || !visibleIds.has(edge.to)) {
      continue;
    }
    const fromNode = positionedById.get(edge.from);
    const toNode = positionedById.get(edge.to);
    if (fromNode === undefined || toNode === undefined) {
      continue;
    }
    // An edge that skips over nodes in a sequential layout arcs over them
    // instead of drawing a straight line through every box in between.
    const intermediates: LayoutRect[] = [];
    const fromIndex = indexById.get(edge.from);
    const toIndex = indexById.get(edge.to);
    if (axis !== null && fromIndex !== undefined && toIndex !== undefined) {
      const lo = Math.min(fromIndex, toIndex);
      const hi = Math.max(fromIndex, toIndex);
      for (let index = lo + 1; index < hi; index += 1) {
        const between = positionedById.get(order[index]!);
        if (between !== undefined && visibleIds.has(between.node.id)) {
          intermediates.push(between.rect);
        }
      }
    }
    const routed = routeEdge(fromNode.rect, toNode.rect, intermediates, axis);
    // Edges stay visually subordinate to nodes: thin grey strokes unless the
    // request explicitly styles them.
    const edgeStyle: AgentDrawShapeStyle = {
      color: style?.color ?? 'grey',
      dash: style?.dash ?? 'draw',
      size: style?.size ?? 's',
      fill: 'none',
    };
    const arrow: AgentDrawShapeInput = {
      kind: 'arrow',
      geometry: {
        kind: 'segment',
        from: routed.from,
        to: routed.to,
      },
      style: edgeStyle,
      // Endpoint ids ride in meta so arrange can re-route this arrow when
      // it moves the nodes, instead of stranding it where it was drawn.
      meta: {
        [AGENT_EDGE_FROM_META_KEY]: edge.from,
        [AGENT_EDGE_TO_META_KEY]: edge.to,
        ...(edge.label !== undefined && edge.label.length > 0
          ? { [AGENT_EDGE_LABEL_META_KEY]: edge.label }
          : {}),
      },
    };
    if (routed.bend !== 0) {
      arrow.bend = routed.bend;
    }
    shapes.push(arrow);
    // The label renders as fixed-width text beside the arrow, never as a
    // tldraw label pill: pills wrap to the arrow's length, so any move
    // that shortens the arrow re-breaks the label mid-word ("downli nk").
    // The same edge meta (plus the label-text marker) lets re-routing
    // move the label with its arrow.
    if (edge.label !== undefined && edge.label.length > 0) {
      const labelWidth = edgeLabelTextWidth(edge.label);
      const labelHeight = edgeLabelTextHeight(edge.label);
      const anchor = edgeLabelAnchor(routed.from, routed.to, routed.bend);
      shapes.push({
        kind: 'text',
        text: edge.label,
        geometry: {
          kind: 'text',
          x: anchor.x - labelWidth / 2,
          y: anchor.y - labelHeight / 2,
          maxWidth: labelWidth,
        },
        style: { size: 's', color: 'grey' },
        meta: {
          [AGENT_EDGE_FROM_META_KEY]: edge.from,
          [AGENT_EDGE_TO_META_KEY]: edge.to,
          [AGENT_EDGE_LABEL_TEXT_META_KEY]: '1',
        },
      });
    }
  }
  return shapes;
}

export function compileDiagramToDrawShapes(
  editor: Editor,
  request: AgentDrawDiagramRequest,
): AgentDrawShapeInput[] {
  if (request.diagram.nodes.length === 0) {
    return [];
  }

  const ids = new Set<string>();
  for (const node of request.diagram.nodes) {
    if (ids.has(node.id)) {
      throw new Error(`duplicate diagram node id "${node.id}"`);
    }
    ids.add(node.id);
  }

  const placementBounds = resolveDiagramPlacementBounds(editor, request.placement);
  const rawLayout = layoutDiagramNodes(request.layout, request.diagram);
  const fitted = fitLayoutInBounds(rawLayout, placementBounds);
  const visibleNodes = filterProgressiveNodes(fitted.nodes, request.progressive);
  const visibleIds = visibleNodeIds(visibleNodes);
  const positionedById = new Map(fitted.nodes.map((entry) => [entry.node.id, entry]));

  const shapes: AgentDrawShapeInput[] = visibleNodes.flatMap((entry) =>
    nodeShapeInputs(entry, request.style),
  );
  shapes.push(
    ...edgeShapeInputs(
      resolveEdges(request.diagram),
      positionedById,
      visibleIds,
      request.style,
      fitted.nodes.map((entry) => entry.node.id),
      request.layout,
    ),
  );
  return shapes;
}
