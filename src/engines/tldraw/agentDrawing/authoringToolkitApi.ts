/**
 * Imperative authoring toolkit driver for the tldraw whiteboard.
 */
import type { Editor, TLAssetId, TLShapeId, TLShapePartial } from 'tldraw';
import { AssetRecordType, createShapeId, toRichText } from 'tldraw';
import { toShapeId } from './shapeRef';
import {
  AGENT_CONNECTOR_KIND_META_KEY,
  type AgentArrangeRequest,
  type AgentArrangeResult,
  type AgentConnectShapesRequest,
  type AgentConnectShapesResult,
  type AgentFrameShapesRequest,
  type AgentFrameShapesResult,
  type AgentGroupShapesRequest,
  type AgentGroupShapesResult,
  type AgentInsertImageRequest,
  type AgentInsertImageResult,
  type AuthoringResolvedImageAsset,
} from '../../../engine/authoringToolkitTypes';
import {
  AGENT_SHAPE_PROVENANCE_META_KEY,
  type AgentDiagramEdge,
  type AgentDiagramNode,
  type AgentDiagramStructure,
} from '../../../engine/agentDrawingTypes';
import {
  DIAGRAM_NODE_HEIGHT,
  DIAGRAM_NODE_WIDTH,
  fitLayoutInBounds,
  layoutDiagramNodes,
  type EstimatedNodeSize,
  type LayoutBounds,
  type LayoutRect,
  type NodeMeasure,
} from './communicativeVisualLayout';
import { readEdgeMeta, rerouteEdgeArrows } from './edgeReroute';
import { getEditor } from '../shapes/panelShapeApi';

const FRAME_PADDING = 24;

function provenanceMeta(
  agentId: string,
  extra?: Readonly<Record<string, string>>): Record<string, string> {
  return {...extra, [AGENT_SHAPE_PROVENANCE_META_KEY]: agentId };
}

function requireEditor(): Editor {
  const editor = getEditor();
  if (!editor) {
    throw new Error('canvas editor not bound');
  }
  return editor;
}

function asShapeId(id: string): TLShapeId {
  // Normalize both raw logical ids ("ignition") a model assigns at draw time
  // and already-formatted ids ("shape:ignition") to the same TLShapeId, so a
  // connect_shapes/group_shapes/frame_shapes reference resolves to the shape
  // that draw_shapes created with that id.
  return toShapeId(id);
}

function readAgentId(meta: unknown): string | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  const value = (meta as Record<string, unknown>)[AGENT_SHAPE_PROVENANCE_META_KEY];
  return typeof value === 'string' && value.length > 0 ? value: undefined;
}

function shapePageBounds(
  editor: Editor,
  shapeId: TLShapeId): { x: number; y: number; w: number; h: number } {
  const bounds = editor.getShapePageBounds(shapeId);
  if (!bounds) {
    throw new Error(`shape "${String(shapeId)}" has no page bounds`);
  }
  return { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h };
}

function shapeCenter(editor: Editor, shapeId: TLShapeId): { x: number; y: number } {
  const bounds = shapePageBounds(editor, shapeId);
  return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
}

function ensureShapeIds(editor: Editor, shapeIds: readonly string[]): TLShapeId[] {
  if (shapeIds.length === 0) {
    throw new Error('shapeIds must contain at least one shape id');
  }
  const resolved: TLShapeId[] = [];
  for (const id of shapeIds) {
    const shapeId = asShapeId(id);
    if (!editor.getShape(shapeId)) {
      throw new Error(`shape "${id}" was not found on the canvas`);
    }
    resolved.push(shapeId);
  }
  return resolved;
}

function registerImageAsset(editor: Editor, asset: AuthoringResolvedImageAsset): TLAssetId {
  const assetRecordId = AssetRecordType.createId();
  const createAssets = (
    editor as Editor & {
      createAssets?: (assets: readonly unknown[]) => void;
    }
  ).createAssets;
  if (typeof createAssets === 'function') {
    createAssets.call(editor, [
      {
        id: assetRecordId,
        type: 'image',
        typeName: 'asset',
        props: {
          name: asset.assetId,
          src: asset.src,
          w: asset.w,
          h: asset.h,
          mimeType: asset.mimeType,
          isAnimated: false,
        },
      },
    ]);
  }
  return assetRecordId;
}

export function insertAgentImage(
  agentId: string,
  request: AgentInsertImageRequest,
  resolvedAsset: AuthoringResolvedImageAsset): AgentInsertImageResult {
  const editor = requireEditor();
  const { geometry } = request;
  if (geometry.w <= 0 || geometry.h <= 0) {
    throw new Error('geometry requires positive width and height');
  }

  const assetRecordId = registerImageAsset(editor, resolvedAsset);
  const imageShapeId = createShapeId();
  editor.createShape({
    id: imageShapeId,
    type: 'image',
    x: geometry.x,
    y: geometry.y,
    meta: provenanceMeta(agentId, {
      assetRef: resolvedAsset.assetId,...(request.alt !== undefined && request.alt.length > 0 ? { alt: request.alt }: {}),
    }),
    props: {
      w: geometry.w,
      h: geometry.h,
      assetId: assetRecordId,
    },
  });

  return {
    imageShapeId: String(imageShapeId),
    assetId: resolvedAsset.assetId,
    agentId,
    alt: request.alt,
  };
}

export function connectAgentShapes(
  agentId: string,
  request: AgentConnectShapesRequest): AgentConnectShapesResult {
  const editor = requireEditor();
  const fromId = asShapeId(request.from);
  const toId = asShapeId(request.to);
  if (!editor.getShape(fromId)) {
    throw new Error(`from shape "${request.from}" was not found on the canvas`);
  }
  if (!editor.getShape(toId)) {
    throw new Error(`to shape "${request.to}" was not found on the canvas`);
  }

  const fromCenter = shapeCenter(editor, fromId);
  const toCenter = shapeCenter(editor, toId);
  const minX = Math.min(fromCenter.x, toCenter.x);
  const minY = Math.min(fromCenter.y, toCenter.y);
  const connectorShapeId = createShapeId();

  // A bound arrow's label pill wraps to the arrow's length, so between
  // tightly-packed shapes a label renders as mid-word fragments
  // ("downli nk"). When the open run between the two borders cannot hold
  // the label, it moves off the arrow and becomes a plain text shape
  // beside the midpoint instead.
  const CONNECT_LABEL_CHAR_WIDTH = 14;
  const CONNECT_LABEL_CLEARANCE = 24;
  const label =
    request.label !== undefined && request.label.length > 0 ? request.label: undefined;
  const fromBounds = shapePageBounds(editor, fromId);
  const toBounds = shapePageBounds(editor, toId);
  const centerDistance = Math.hypot(toCenter.x - fromCenter.x, toCenter.y - fromCenter.y);
  const openRun =
    centerDistance -
    Math.hypot(fromBounds.w, fromBounds.h) / 2 -
    Math.hypot(toBounds.w, toBounds.h) / 2;
  const labelFits =
    label === undefined || openRun >= label.length * CONNECT_LABEL_CHAR_WIDTH + CONNECT_LABEL_CLEARANCE;

  editor.createShape({
    id: connectorShapeId,
    type: 'arrow',
    x: minX,
    y: minY,
    meta: provenanceMeta(agentId, {
      [AGENT_CONNECTOR_KIND_META_KEY]: request.kind,
    }),
    props: {
      start: { x: fromCenter.x - minX, y: fromCenter.y - minY },
      end: { x: toCenter.x - minX, y: toCenter.y - minY },
      color: request.kind === 'dependency' ? 'orange': request.kind === 'flow' ? 'blue': 'grey',
      fill: 'none',
      dash: request.kind === 'annotation' ? 'dotted': 'draw',
      size: 'm',
      // tldraw's arrow stores its label as richText, not a plain `text`
      // prop (setting `text` throws "Unexpected property" at validation).
      ...(label !== undefined && labelFits ? { richText: toRichText(label) }: {}),
    },
  });

  let labelShapeId: TLShapeId | undefined;
  if (label !== undefined && !labelFits) {
    const midX = (fromCenter.x + toCenter.x) / 2;
    const midY = (fromCenter.y + toCenter.y) / 2;
    const ux = (toCenter.x - fromCenter.x) / Math.max(1, centerDistance);
    const uy = (toCenter.y - fromCenter.y) / Math.max(1, centerDistance);
    // Perpendicular pointed up-ish so the label sits above the line.
    let nx = -uy;
    let ny = ux;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const estWidth = label.length * 11 + 16;
    const estHeight = 26;
    const labelOffset = 18;
    labelShapeId = createShapeId();
    editor.createShape({
      id: labelShapeId,
      type: 'text',
      x: midX + nx * labelOffset - estWidth / 2,
      y: midY + ny * labelOffset - estHeight / 2,
      meta: provenanceMeta(agentId),
      props: {
        richText: toRichText(label),
        color: 'grey',
        size: 's',
        font: 'draw',
        autoSize: false,
        w: estWidth,
      },
    });
  }

  const createBinding = (
    editor as Editor & {
      createBinding?: (binding: Record<string, unknown>) => void;
    }
  ).createBinding;
  if (typeof createBinding === 'function') {
    createBinding.call(editor, {
      type: 'arrow',
      fromId: connectorShapeId,
      toId: fromId,
      props: { terminal: 'start', normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false },
    });
    createBinding.call(editor, {
      type: 'arrow',
      fromId: connectorShapeId,
      toId: toId,
      props: { terminal: 'end', normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false },
    });
  }

  return {
    connectorShapeId: String(connectorShapeId),
    from: request.from,
    to: request.to,
    kind: request.kind,
    agentId,...(labelShapeId !== undefined ? { labelShapeId: String(labelShapeId) }: {}),
  };
}

export function groupAgentShapes(
  agentId: string,
  request: AgentGroupShapesRequest): AgentGroupShapesResult {
  const editor = requireEditor();
  const shapeIds = ensureShapeIds(editor, request.shapeIds);
  for (const shapeId of shapeIds) {
    const stamped = readAgentId(editor.getShape(shapeId)?.meta);
    if (stamped !== undefined && stamped !== agentId) {
      throw new Error(`shape "${String(shapeId)}" belongs to another agent`);
    }
  }

  editor.setCurrentTool('select');
  editor.groupShapes(shapeIds);
  const parentId = editor.getShape(shapeIds[0]!)?.parentId;
  if (!parentId) {
    throw new Error('group_shapes failed to create a group parent');
  }
  const parentShape = editor.getShape(parentId);
  if (!parentShape || parentShape.type !== 'group') {
    throw new Error('group_shapes did not produce a group container');
  }
  editor.updateShapes([
    {
      id: parentShape.id,
      type: 'group',
      meta: provenanceMeta(agentId),
    },
  ]);

  return {
    groupId: String(parentShape.id),
    shapeIds: request.shapeIds,
    agentId,
  };
}

export function frameAgentShapes(
  agentId: string,
  request: AgentFrameShapesRequest): AgentFrameShapesResult {
  const editor = requireEditor();
  const shapeIds = ensureShapeIds(editor, request.shapeIds);

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const shapeId of shapeIds) {
    const bounds = shapePageBounds(editor, shapeId);
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.w);
    maxY = Math.max(maxY, bounds.y + bounds.h);
  }

  const frameId = createShapeId();
  const frameName = request.name ?? 'Agent frame';
  const frameW = maxX - minX + FRAME_PADDING * 2;
  const frameH = maxY - minY + FRAME_PADDING * 2;
  editor.createShape({
    id: frameId,
    type: 'frame',
    x: minX - FRAME_PADDING,
    y: minY - FRAME_PADDING,
    meta: provenanceMeta(agentId),
    props: {
      w: frameW,
      h: frameH,
      name: frameName,
    },
  });
  editor.reparentShapes(shapeIds, frameId);

  return {
    frameId: String(frameId),
    shapeIds: request.shapeIds,
    agentId,
    name: frameName,
  };
}

function collectArrangeShapeIds(editor: Editor, request: AgentArrangeRequest): TLShapeId[] {
  if (request.frameId !== undefined) {
    if (request.shapeIds !== undefined && request.shapeIds.length > 0) {
      throw new Error('pass either shapeIds or frameId for arrange, not both');
    }
    const frameId = asShapeId(request.frameId);
    const frame = editor.getShape(frameId);
    if (!frame || frame.type !== 'frame') {
      throw new Error(`frame "${request.frameId}" was not found on the canvas`);
    }
    return editor.getSortedChildIdsForParent(frameId);
  }
  if (request.shapeIds === undefined || request.shapeIds.length < 2) {
    throw new Error('arrange requires at least two shapeIds or a frameId');
  }
  return ensureShapeIds(editor, request.shapeIds);
}

interface ArrangeEdgeArrow {
  arrowId: TLShapeId;
  fromShapeId: TLShapeId;
  toShapeId: TLShapeId;
  label?: string;
}

/** Every agent edge arrow that touches the arranged node set. */
function collectEdgeArrows(editor: Editor, nodeIds: ReadonlySet<string>): ArrangeEdgeArrow[] {
  const arrows: ArrangeEdgeArrow[] = [];
  const pageShapes =
    typeof editor.getCurrentPageShapes === 'function' ? editor.getCurrentPageShapes(): [];
  for (const shape of pageShapes) {
    if (shape.type !== 'arrow') continue;
    const edge = readEdgeMeta(shape.meta);
    if (edge === undefined) continue;
    const fromShapeId = asShapeId(edge.from);
    const toShapeId = asShapeId(edge.to);
    if (!nodeIds.has(String(fromShapeId)) && !nodeIds.has(String(toShapeId))) continue;
    arrows.push({
      arrowId: shape.id,
      fromShapeId,
      toShapeId,...(edge.label !== undefined ? { label: edge.label }: {}),
    });
  }
  return arrows;
}

function buildDiagramFromShapes(
  editor: Editor,
  shapeIds: readonly TLShapeId[]): {
  diagram: AgentDiagramStructure;
  origin: LayoutBounds;
  shapeByNodeId: Map<string, TLShapeId>;
  measure: NodeMeasure;
  edgeArrows: ArrangeEdgeArrow[];
} {
  const nodes: AgentDiagramNode[] = [];
  const shapeByNodeId = new Map<string, TLShapeId>();
  const sizeByNodeId = new Map<string, EstimatedNodeSize>();
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  shapeIds.forEach((shapeId) => {
    // Edge arrows and their label texts are not layout nodes: they follow
    // their nodes after the move, so a model that lists them in shapeIds
    // does not corrupt the grid with connector "boxes".
    const shape = editor.getShape(shapeId);
    if (
      shape !== undefined &&
      (shape.type === 'arrow' || shape.type === 'text') &&
      readEdgeMeta(shape.meta) !== undefined
    ) {
      return;
    }
    const bounds = shapePageBounds(editor, shapeId);
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.w);
    maxY = Math.max(maxY, bounds.y + bounds.h);
    const nodeId = String(shapeId);
    nodes.push({ id: nodeId, label: nodeId.slice(-6), kind: 'box' });
    shapeByNodeId.set(nodeId, shapeId);
    sizeByNodeId.set(nodeId, { w: bounds.w, h: bounds.h });
  });

  const nodeIdSet = new Set(shapeByNodeId.keys());
  const edgeArrows = collectEdgeArrows(editor, nodeIdSet);
  const edges: AgentDiagramEdge[] = [];
  for (const arrow of edgeArrows) {
    const from = String(arrow.fromShapeId);
    const to = String(arrow.toShapeId);
    if (nodeIdSet.has(from) && nodeIdSet.has(to)) {
      edges.push({ from, to,...(arrow.label !== undefined ? { label: arrow.label }: {}) });
    }
  }

  // Lay out by what is actually on the canvas: sizing the ring or row for
  // guessed default boxes piles real 200px-wide ellipses on top of each
  // other (owner-reported arrange regression).
  const measure: NodeMeasure = (node) =>
    sizeByNodeId.get(node.id) ?? { w: DIAGRAM_NODE_WIDTH, h: DIAGRAM_NODE_HEIGHT };

  return {
    diagram: {
      nodes,
      order: nodes.map((node) => node.id),...(edges.length > 0 ? { edges }: {}),
    },
    origin: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    shapeByNodeId,
    measure,
    edgeArrows,
  };
}

export function arrangeAgentShapes(
  agentId: string,
  request: AgentArrangeRequest): AgentArrangeResult {
  const editor = requireEditor();
  const shapeIds = collectArrangeShapeIds(editor, request);
  if (shapeIds.length < 2) {
    throw new Error('arrange requires at least two shapes');
  }

  const { diagram, origin, shapeByNodeId, measure } = buildDiagramFromShapes(editor, shapeIds);
  if (diagram.nodes.length < 2) {
    throw new Error('arrange requires at least two non-connector shapes (edge arrows follow their nodes)');
  }
  const rawLayout = layoutDiagramNodes(request.layout, diagram, measure);
  const fitted = fitLayoutInBounds(rawLayout, origin);

  const rectByNodeId = new Map<string, LayoutRect>();
  const updates: TLShapePartial[] = [];
  for (const positioned of fitted.nodes) {
    const shapeId = shapeByNodeId.get(positioned.node.id);
    if (shapeId === undefined) continue;
    const shape = editor.getShape(shapeId);
    if (!shape) continue;
    rectByNodeId.set(positioned.node.id, positioned.rect);
    // Position-only update; the runtime type string satisfies any variant of
    // the discriminated partial union.
    updates.push({
      id: shapeId,
      type: shape.type,
      x: positioned.rect.x,
      y: positioned.rect.y,
    } as TLShapePartial);
  }
  if (updates.length > 0) {
    editor.updateShapes(updates);
  }

  // Move every touching edge arrow with its nodes: without this, arrange
  // strands connectors and their labels at the old positions (the orphaned
  // line the owner screenshotted after a radial arrange).
  const order = fitted.nodes.map((entry) => entry.node.id);
  const axis =
    request.layout === 'flow'
      ? ('x' as const): request.layout === 'timeline'
        ? ('y' as const): null;
  rerouteEdgeArrows(editor, rectByNodeId, { order, axis });

  return {
    arrangedShapeIds: shapeIds.map(String),
    layout: request.layout,
    agentId,
    note:
      `Rearranged ${shapeIds.length} shapes into a ${request.layout} layout in place. ` +
      'Connectors and labels moved with them; the canvas already shows the new layout. ' +
      'Do not redraw these shapes.',
  };
}

/** Test helper: read connector kind from shape meta. */
export function readConnectorKind(meta: unknown): string | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  const value = (meta as Record<string, unknown>)[AGENT_CONNECTOR_KIND_META_KEY];
  return typeof value === 'string' ? value: undefined;
}
