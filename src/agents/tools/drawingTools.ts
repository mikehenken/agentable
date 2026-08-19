/**
 * Agent drawing tools (D41, P8-T1): draw_shapes, annotate_panel,
 * clear_agent_drawings. Capability-gated on engine.capabilities.draw.
 */
import type {
  AgentDiagramLayoutMode,
  AgentDiagramEdge,
  AgentDiagramNode,
  AgentDiagramNodeKind,
  AgentDiagramPlacement,
  AgentDiagramProgressive,
  AgentDiagramStructure,
  AgentDrawDiagramRequest,
  AgentDrawGeometry,
  AgentDrawPointsGeometry,
  AgentDrawShapeInput,
  AgentDrawShapeKind,
  AgentPanelAnchor,
} from '../../engine/agentDrawingTypes';
import type { WireframeStencilKind } from '../../engine/authoringToolkitTypes';
import type { ToolDeclaration, ToolDefinition, ToolHandler } from '../../panels/tools';
import {
  recordAnnotatePanelActivity,
  recordClearDrawingsActivity,
  recordDrawShapesActivity,
} from '../drawingActivity';
import {
  drawCapabilityRefusal,
  drawToolSuccess,
  isDrawCapabilityAvailable,
} from '../engineBridge';
import {
  annotateAgentPanel,
  clearAgentDrawings,
  drawAgentDiagram,
  drawAgentShapes,
} from '../../engines/tldraw/agentDrawing/agentDrawingApi';
import { expandWireframeStencil } from '../../engines/tldraw/agentDrawing/wireframeStencils';
import { getAgentToolContext } from '../agentContext';
import {
  enforceStructuralDiagramDraw,
  hasValidDiagramLayout,
} from './enforceStructuralDiagramDraw';
import { normalizeDiagramPayload } from './diagramNormalization';

export const DRAWING_TOOL_NAMES = [
  'draw_shapes',
  'annotate_panel',
  'clear_agent_drawings',
] as const;

export type DrawingToolName = (typeof DRAWING_TOOL_NAMES)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readLayoutMode(value: unknown): AgentDiagramLayoutMode | undefined {
  if (
    value === 'none' ||
    value === 'flow' ||
    value === 'timeline' ||
    value === 'radial' ||
    value === 'nested'
  ) {
    return value;
  }
  return undefined;
}

function readNodeKind(value: unknown): AgentDiagramNodeKind | undefined {
  if (value === 'box' || value === 'ellipse' || value === 'container') {
    return value;
  }
  return undefined;
}

/**
 * Model-supplied display text sometimes arrives with literal escape
 * sequences ("Liftoff\n(Apex-9 ...") because the model double-escaped its
 * JSON. Convert the common escapes to what the model meant so labels never
 * render a visible backslash-n on the canvas. Ids are never sanitized.
 */
export function readSketchText(value: unknown): string | undefined {
  const text = readString(value);
  if (text === undefined) return undefined;
  const cleaned = text
    .replace(/\\r\\n|\\n|\\r/g, '\n')
    .replace(/\\t/g, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function readDiagramNode(value: unknown): AgentDiagramNode | undefined {
  if (!isRecord(value)) return undefined;
  const id = readString(value.id);
  const label =
    readSketchText(value.label) ??
    readSketchText(value.text) ??
    readSketchText(value.name) ??
    readSketchText(value.title) ??
    id;
  if (id === undefined || label === undefined) return undefined;
  const kind = readNodeKind(value.kind);
  const parentId = readString(value.parentId);
  const base = kind !== undefined ? { id, label, kind } : { id, label };
  return parentId !== undefined ? { ...base, parentId } : base;
}

function readDiagramEdge(value: unknown): AgentDiagramEdge | undefined {
  if (!isRecord(value)) return undefined;
  const from = readString(value.from);
  const to = readString(value.to);
  if (from === undefined || to === undefined) return undefined;
  const label = readSketchText(value.label);
  return label !== undefined ? { from, to, label } : { from, to };
}

function readDiagramStructure(value: unknown): AgentDiagramStructure | undefined {
  if (!isRecord(value)) return undefined;
  if (!Array.isArray(value.nodes) || value.nodes.length === 0) return undefined;
  const nodes = value.nodes
    .map((entry) => readDiagramNode(entry))
    .filter((entry): entry is AgentDiagramNode => entry !== undefined);
  if (nodes.length !== value.nodes.length) return undefined;

  const diagram: AgentDiagramStructure = { nodes };
  if (Array.isArray(value.edges)) {
    const edges = value.edges
      .map((entry) => readDiagramEdge(entry))
      .filter((entry): entry is NonNullable<ReturnType<typeof readDiagramEdge>> => entry !== undefined);
    if (edges.length !== value.edges.length) return undefined;
    diagram.edges = edges;
  }
  if (Array.isArray(value.order)) {
    const order = value.order
      .map((entry) => (typeof entry === 'string' && entry.length > 0 ? entry : undefined))
      .filter((entry): entry is string => entry !== undefined);
    if (order.length !== value.order.length) return undefined;
    diagram.order = order;
  }
  return diagram;
}

function readPlacement(value: unknown): AgentDiagramPlacement | undefined {
  if (!isRecord(value)) return undefined;
  const kind = value.kind;
  if (kind === 'viewport') {
    return { kind: 'viewport' };
  }
  if (kind === 'rect') {
    const x = readFiniteNumber(value.x);
    const y = readFiniteNumber(value.y);
    const w = readFiniteNumber(value.w);
    const h = readFiniteNumber(value.h);
    if (x === undefined || y === undefined || w === undefined || h === undefined) {
      return undefined;
    }
    return { kind: 'rect', x, y, w, h };
  }
  if (kind === 'nearPanel') {
    const panelId = readString(value.panelId);
    if (panelId === undefined) return undefined;
    const side = value.side;
    if (
      side === 'right' ||
      side === 'left' ||
      side === 'bottom' ||
      side === 'top'
    ) {
      return { kind: 'nearPanel', panelId, side };
    }
    return { kind: 'nearPanel', panelId };
  }
  return undefined;
}

function readProgressive(value: unknown): AgentDiagramProgressive | undefined {
  if (!isRecord(value)) return undefined;
  const step = readFiniteNumber(value.step);
  if (step === undefined || !Number.isInteger(step) || step < 1) return undefined;
  const totalSteps = readFiniteNumber(value.totalSteps);
  if (totalSteps !== undefined && (!Number.isInteger(totalSteps) || totalSteps < step)) {
    return undefined;
  }
  return totalSteps !== undefined ? { step, totalSteps } : { step };
}

function readDrawDiagramRequest(args: Record<string, unknown>): AgentDrawDiagramRequest | undefined {
  const layout = readLayoutMode(args.layout);
  if (layout === undefined || layout === 'none') return undefined;
  const diagram = readDiagramStructure(args.diagram);
  if (diagram === undefined) return undefined;
  const request: AgentDrawDiagramRequest = { layout, diagram };
  const placement = readPlacement(args.placement);
  if (placement !== undefined) request.placement = placement;
  const progressive = readProgressive(args.progressive);
  if (progressive !== undefined) request.progressive = progressive;
  if (isRecord(args.style)) {
    const style: AgentDrawShapeInput['style'] = {};
    const color = readString(args.style.color);
    if (color !== undefined) style.color = color;
    if (
      args.style.fill === 'none' ||
      args.style.fill === 'semi' ||
      args.style.fill === 'solid'
    ) {
      style.fill = args.style.fill;
    }
    if (
      args.style.dash === 'draw' ||
      args.style.dash === 'dashed' ||
      args.style.dash === 'dotted' ||
      args.style.dash === 'solid'
    ) {
      style.dash = args.style.dash;
    }
    if (
      args.style.size === 's' ||
      args.style.size === 'm' ||
      args.style.size === 'l' ||
      args.style.size === 'xl'
    ) {
      style.size = args.style.size;
    }
    if (Object.keys(style).length > 0) {
      request.style = style;
    }
  }
  return request;
}

function readStencil(value: unknown): WireframeStencilKind | undefined {
  if (
    value === 'box' ||
    value === 'label' ||
    value === 'input' ||
    value === 'button' ||
    value === 'nav' ||
    value === 'card'
  ) {
    return value;
  }
  return undefined;
}

function readDrawKind(value: unknown): AgentDrawShapeKind | undefined {
  if (
    value === 'box' ||
    value === 'ellipse' ||
    value === 'arrow' ||
    value === 'text' ||
    value === 'freehand'
  ) {
    return value;
  }
  return undefined;
}

const DRAW_KIND_ALIASES: Readonly<Record<string, AgentDrawShapeKind>> = {
  box: 'box',
  rect: 'box',
  rectangle: 'box',
  geo: 'box',
  triangle: 'box',
  polygon: 'box',
  ellipse: 'ellipse',
  circle: 'ellipse',
  arrow: 'arrow',
  line: 'arrow',
  text: 'text',
  label: 'text',
  freehand: 'freehand',
  draw: 'freehand',
  freedraw: 'freehand',
};

function normalizeDrawKindAlias(value: unknown): AgentDrawShapeKind | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }
  const direct = readDrawKind(value);
  if (direct !== undefined) {
    return direct;
  }
  return DRAW_KIND_ALIASES[value.toLowerCase()];
}

function convertExcalidrawElement(element: unknown): Record<string, unknown> | undefined {
  if (!isRecord(element)) {
    return undefined;
  }
  const type = typeof element.type === 'string' ? element.type.toLowerCase() : '';
  const x = readFiniteNumber(element.x) ?? 0;
  const y = readFiniteNumber(element.y) ?? 0;
  const w =
    readFiniteNumber(element.width) ??
    readFiniteNumber(element.w) ??
    0;
  const h =
    readFiniteNumber(element.height) ??
    readFiniteNumber(element.h) ??
    0;

  if (type === 'rectangle' || type === 'diamond') {
    const kind = type === 'diamond' ? 'ellipse' : 'box';
    return { kind, geometry: { kind: 'rect', x, y, w, h } };
  }
  if (type === 'ellipse' || type === 'circle') {
    return { kind: 'ellipse', geometry: { kind: 'rect', x, y, w, h } };
  }
  if (type === 'line' || type === 'arrow') {
    const points = Array.isArray(element.points)
      ? element.points
          .map((entry) => readPoint(entry))
          .filter((entry): entry is { x: number; y: number } => entry !== undefined)
      : [];
    if (points.length >= 2) {
      return {
        kind: 'arrow',
        geometry: { kind: 'segment', from: points[0], to: points[points.length - 1] },
      };
    }
    return {
      kind: 'arrow',
      geometry: {
        kind: 'segment',
        from: { x, y },
        to: { x: x + (w || 40), y: y + (h || 0) },
      },
    };
  }
  if (type === 'freedraw' && Array.isArray(element.points)) {
    const points = element.points
      .map((entry) => readPoint(entry))
      .filter((entry): entry is { x: number; y: number } => entry !== undefined);
    if (points.length >= 2) {
      return { kind: 'freehand', geometry: { kind: 'points', points } };
    }
  }
  if (type === 'text') {
    const text = readSketchText(element.text);
    return {
      kind: 'text',
      text,
      geometry: { kind: 'text', x, y },
    };
  }
  return undefined;
}

function convertTldrawRawShape(record: Record<string, unknown>): Record<string, unknown> | undefined {
  const type = typeof record.type === 'string' ? record.type.toLowerCase() : '';
  const props = isRecord(record.props) ? record.props : {};
  const x = readFiniteNumber(record.x) ?? readFiniteNumber(props.x) ?? 0;
  const y = readFiniteNumber(record.y) ?? readFiniteNumber(props.y) ?? 0;
  const w = readFiniteNumber(props.w) ?? readFiniteNumber(props.width) ?? 100;
  const h = readFiniteNumber(props.h) ?? readFiniteNumber(props.height) ?? 80;

  if (type === 'geo') {
    const geo = typeof props.geo === 'string' ? props.geo.toLowerCase() : 'rectangle';
    const kind = geo === 'ellipse' || geo === 'circle' ? 'ellipse' : 'box';
    return { kind, geometry: { kind: 'rect', x, y, w, h } };
  }
  if (type === 'arrow') {
    const start = readPoint(props.start) ?? { x, y };
    const end = readPoint(props.end) ?? { x: x + w, y: y + h };
    return { kind: 'arrow', geometry: { kind: 'segment', from: start, to: end } };
  }
  if (type === 'text') {
    const text = readSketchText(props.text ?? record.text);
    return { kind: 'text', text, geometry: { kind: 'text', x, y } };
  }
  if (type === 'draw' && Array.isArray(props.segments)) {
    const points: Array<{ x: number; y: number }> = [];
    for (const segment of props.segments) {
      if (!isRecord(segment)) continue;
      const point = readPoint(segment);
      if (point !== undefined) {
        points.push(point);
      }
    }
    if (points.length >= 2) {
      return { kind: 'freehand', geometry: { kind: 'points', points } };
    }
  }
  return undefined;
}

function normalizeShapeEntry(entry: unknown): Record<string, unknown> | undefined {
  if (!isRecord(entry)) {
    return undefined;
  }
  if (typeof entry.type === 'string' && entry.kind === undefined) {
    const converted = convertTldrawRawShape(entry);
    if (converted !== undefined) {
      return converted;
    }
  }
  const kind = normalizeDrawKindAlias(entry.kind ?? entry.type);
  if (kind === undefined) {
    return undefined;
  }
  const next: Record<string, unknown> = { ...entry, kind };
  const geomKind = geometryKindForShape(kind);
  const geometry =
    readGeometry(entry.geometry, geomKind) ?? readGeometry(entry, geomKind);
  if (geometry !== undefined) {
    next.geometry = geometry;
  }
  return next;
}

export interface NormalizeDrawShapesArgsResult {
  args: Record<string, unknown>;
  error?: string;
}

/**
 * Normalize LLM draw_shapes payloads before parsing: excalidraw elements,
 * raw tldraw records, and kind aliases → canonical { shapes: [...] }.
 */
export function normalizeDrawShapesArgs(args: Record<string, unknown>): NormalizeDrawShapesArgsResult {
  let normalized: Record<string, unknown> = { ...args };
  normalized = normalizeDiagramPayload(normalized);

  if (!Array.isArray(normalized.shapes) && Array.isArray(normalized.elements)) {
    const converted = normalized.elements
      .map((entry) => convertExcalidrawElement(entry))
      .filter((entry): entry is Record<string, unknown> => entry !== undefined);
    normalized.shapes = converted;
    delete normalized.elements;
  }

  if (
    !Array.isArray(normalized.shapes) &&
    typeof normalized.type === 'string' &&
    (normalized.type === 'geo' ||
      normalized.type === 'arrow' ||
      normalized.type === 'text' ||
      normalized.type === 'draw')
  ) {
    const converted = convertTldrawRawShape(normalized);
    if (converted !== undefined) {
      normalized.shapes = [converted];
    }
  }

  if (Array.isArray(normalized.shapes)) {
    normalized.shapes = normalized.shapes
      .map((entry) => normalizeShapeEntry(entry))
      .filter((entry): entry is Record<string, unknown> => entry !== undefined);
    if (normalized.shapes.length === 0) {
      delete normalized.shapes;
    }
  }

  const hasExplicitShapes = Array.isArray(normalized.shapes) && normalized.shapes.length > 0;
  if (!hasExplicitShapes) {
    if (hasValidDiagramLayout(normalized)) {
      return { args: normalized };
    }
    return {
      args: normalized,
      error:
        'draw_shapes requires at least one shape after normalization, or diagram with layout flow, timeline, radial, or nested — not excalidraw elements or raw tldraw records at the top level',
    };
  }

  return { args: normalized };
}

function readAnchor(value: unknown): AgentPanelAnchor | undefined {
  if (
    value === 'top' ||
    value === 'bottom' ||
    value === 'left' ||
    value === 'right' ||
    value === 'center'
  ) {
    return value;
  }
  return undefined;
}

function readPoint(value: unknown): { x: number; y: number } | undefined {
  // Models often emit freehand/arrow points as numeric tuples [x, y].
  if (Array.isArray(value) && value.length >= 2) {
    const x = readFiniteNumber(value[0]);
    const y = readFiniteNumber(value[1]);
    if (x !== undefined && y !== undefined) {
      return { x, y };
    }
  }
  if (!isRecord(value)) return undefined;
  const x = readFiniteNumber(value.x);
  const y = readFiniteNumber(value.y);
  if (x === undefined || y === undefined) return undefined;
  return { x, y };
}

const GEOMETRY_KINDS: readonly string[] = ['rect', 'segment', 'points', 'text'];

function readGeometry(
  value: unknown,
  fallbackKind?: AgentDrawGeometry['kind'],
): AgentDrawGeometry | undefined {
  if (!isRecord(value)) return undefined;
  // Models routinely omit the redundant geometry.kind discriminator: it is
  // already implied by the shape's own `kind` (box/ellipse map to rect, arrow
  // to segment, freehand to points, text to text). Use the value's own kind
  // only when it is a real geometry-kind tag; otherwise (missing, or the
  // shape's own kind like "ellipse" when geometry fields are hoisted onto the
  // shape) fall back to the shape-derived kind, so one missing tag does not
  // fail the whole draw_shapes call and leave the canvas blank.
  const kind =
    typeof value.kind === 'string' && GEOMETRY_KINDS.includes(value.kind as never)
      ? (value.kind as AgentDrawGeometry['kind'])
      : fallbackKind;
  if (kind === 'rect') {
    const x = readFiniteNumber(value.x);
    const y = readFiniteNumber(value.y);
    // Accept `width`/`height` as aliases for `w`/`h`: models commonly use the
    // spelled-out names.
    const w = readFiniteNumber(value.w) ?? readFiniteNumber(value.width);
    const h = readFiniteNumber(value.h) ?? readFiniteNumber(value.height);
    if (x === undefined || y === undefined || w === undefined || h === undefined) {
      return undefined;
    }
    return { kind: 'rect', x, y, w, h };
  }
  if (kind === 'segment') {
    const from = readPoint(value.from);
    const to = readPoint(value.to);
    if (!from || !to) return undefined;
    return { kind: 'segment', from, to };
  }
  if (kind === 'points') {
    if (!Array.isArray(value.points)) return undefined;
    const points = value.points
      .map((entry) => readPoint(entry))
      .filter((entry): entry is { x: number; y: number } => entry !== undefined);
    if (points.length < 2) return undefined;
    const geometry: AgentDrawPointsGeometry = { kind: 'points', points };
    if (value.closed === true) {
      geometry.closed = true;
    } else if (value.closed === false) {
      geometry.closed = false;
    }
    return geometry;
  }
  if (kind === 'text') {
    const x = readFiniteNumber(value.x);
    const y = readFiniteNumber(value.y);
    if (x === undefined || y === undefined) return undefined;
    // Accept `w`/`width` as a max-width fallback: models often size a text box
    // with a width rather than the schema's `maxWidth`, and honoring it keeps
    // long labels wrapped inside their intended box instead of running off.
    const maxWidth =
      readFiniteNumber(value.maxWidth) ??
      readFiniteNumber(value.w) ??
      readFiniteNumber(value.width);
    return maxWidth !== undefined ? { kind: 'text', x, y, maxWidth } : { kind: 'text', x, y };
  }
  return undefined;
}

/** Geometry kind implied by a shape's own kind, for LLM args that omit it. */
function geometryKindForShape(kind: AgentDrawShapeKind): AgentDrawGeometry['kind'] {
  switch (kind) {
    case 'box':
    case 'ellipse':
      return 'rect';
    case 'arrow':
      return 'segment';
    case 'freehand':
      return 'points';
    case 'text':
      return 'text';
  }
}

function readDrawShape(value: unknown): AgentDrawShapeInput | AgentDrawShapeInput[] | undefined {
  if (!isRecord(value)) return undefined;
  const stencil = readStencil(value.stencil);
  if (stencil !== undefined) {
    // Wireframe stencils are always positioned by a rect.
    const geometry = readGeometry(value.geometry, 'rect');
    if (geometry === undefined) return undefined;
    const text = readSketchText(value.text);
    return expandWireframeStencil(stencil, geometry, text);
  }
  const kind = readDrawKind(value.kind);
  if (kind === undefined) return undefined;
  const geomKind = geometryKindForShape(kind);
  // Prefer a nested geometry object; fall back to geometry fields hoisted
  // directly onto the shape (x/y/w/h/width/height/points/from/to at the top
  // level), which is another common shape of LLM output.
  const geometry =
    readGeometry(value.geometry, geomKind) ?? readGeometry(value, geomKind);
  if (geometry === undefined) return undefined;

  const input: AgentDrawShapeInput = { kind, geometry };
  // Capture a caller/model-assigned id so connect_shapes/group_shapes/
  // frame_shapes can reference this shape by the same id later.
  const id = readString(value.id);
  if (id !== undefined) input.id = id;
  const text = readSketchText(value.text);
  if (text !== undefined) input.text = text;
  const from = readString(value.from);
  if (from !== undefined) input.from = from;
  const to = readString(value.to);
  if (to !== undefined) input.to = to;
  if (isRecord(value.style)) {
    const style: AgentDrawShapeInput['style'] = {};
    const color = readString(value.style.color);
    if (color !== undefined) style.color = color;
    if (
      value.style.fill === 'none' ||
      value.style.fill === 'semi' ||
      value.style.fill === 'solid'
    ) {
      style.fill = value.style.fill;
    }
    if (
      value.style.dash === 'draw' ||
      value.style.dash === 'dashed' ||
      value.style.dash === 'dotted' ||
      value.style.dash === 'solid'
    ) {
      style.dash = value.style.dash;
    }
    if (
      value.style.size === 's' ||
      value.style.size === 'm' ||
      value.style.size === 'l' ||
      value.style.size === 'xl'
    ) {
      style.size = value.style.size;
    }
    if (Object.keys(style).length > 0) {
      input.style = style;
    }
  }
  return input;
}

function withDrawGate(handler: ToolHandler): ToolHandler {
  return (args) => {
    if (!isDrawCapabilityAvailable()) {
      return drawCapabilityRefusal();
    }
    return handler(args);
  };
}

function resolveActingAgentId(args: Record<string, unknown>): string {
  const ctx = getAgentToolContext();
  if (ctx === null) {
    throw new Error('agent tool context is required for this operation');
  }
  const override = readString(args.agentId);
  return override ?? ctx.agentId;
}

const declarationDrawShapes: ToolDeclaration = {
  name: 'draw_shapes',
  description:
    'Create batched canvas marks (box, ellipse, arrow, text, freehand) or a logical diagram with auto-layout (flow, timeline, radial, nested). Prefer diagram plus layout for anything with nodes and connections: the canvas lays it out cleanly with labels centered inside nodes. Pick the layout that fits the structure up front: nested for VPC/cloud/architecture with regions/containers; radial for hub-spoke; flow for processes; timeline for sequences. Redrawing an id that already exists updates that shape in place, so revise a drawing by reusing the SAME ids; never draw a duplicate copy under new ids. To only re-layout shapes you already drew, call arrange instead of drawing again. Additive only; never mutates panel data. Each shape is provenance-stamped for the acting agent.',
  costClass: 'cheap',
  parameters: {
    type: 'object',
    properties: {
      shapes: {
        type: 'array',
        description:
          'Explicit shapes. Each item: { kind: box | ellipse | arrow | text | freehand, geometry, id?, text?, style? }. geometry by kind: box/ellipse take { x, y, w, h }; arrow takes { from: {x,y}, to: {x,y} }; text takes { x, y, maxWidth? }; freehand takes { points: [{x,y}, ...] }. text on a box, ellipse, or arrow renders as a label centered inside the shape, so never draw a separate text shape over a box. id lets later connect_shapes or group_shapes calls reference the shape. style: { color, fill: none | semi | solid, dash: draw | dashed | dotted | solid, size: s | m | l | xl }. color must be one of: black, grey, light-violet, violet, blue, light-blue, yellow, orange, green, light-green, light-red, red, white (kebab-case, never camelCase). Use size xl or l for titles, m for nodes, s for captions and arrows; vary color by role instead of drawing everything one color.',
        items: { type: 'object' },
      },
      layout: {
        type: 'string',
        enum: ['none', 'flow', 'timeline', 'radial', 'nested'],
        description:
          'Top-level auto-layout mode (sibling of diagram, not inside diagram). When flow, timeline, radial, or nested, pass diagram instead of coordinates. nested for VPC/cloud/architecture with parentId containers; radial for hub-spoke; flow for processes; timeline for sequences.',
      },
      diagram: {
        type: 'object',
        description:
          'Logical nodes and edges for auto-layout: { nodes: [{ id, label, kind?: box | ellipse | container, parentId?: string }], edges?: [{ from, to, label? }] }. Agents pass structure, not absolute coordinates. Node labels render centered inside the node; boxes color blue, ellipses green, containers light-violet, edges thin grey by default.',
      },
      placement: {
        type: 'object',
        description:
          'Placement target: viewport (default, automatically avoids the chat panel), rect, or nearPanel relative to an open panel.',
      },
      progressive: {
        type: 'object',
        description:
          'Progressive reveal step for speech-synced drawing. step is the 1-based node count to render.',
      },
      style: {
        type: 'object',
        description:
          'Optional style override applied to a diagram: { color, fill, dash, size }. Omit to keep the default role palette.',
      },
      stencil: {
        type: 'string',
        enum: ['box', 'label', 'input', 'button', 'nav', 'card'],
        description:
          'Wireframe placeholder stencil. When set, geometry is a rect and kind is inferred.',
      },
    },
  },
};

const declarationAnnotatePanel: ToolDeclaration = {
  name: 'annotate_panel',
  description:
    'Place a provenance-stamped callout anchored to an open panel. The callout moves with the panel through drag and dock operations.',
  costClass: 'cheap',
  parameters: {
    type: 'object',
    properties: {
      panelId: { type: 'string', description: 'Open panel instance id.' },
      text: { type: 'string', description: 'Callout text.' },
      anchor: {
        type: 'string',
        enum: ['top', 'bottom', 'left', 'right', 'center'],
        description: 'Anchor position relative to the panel bounds.',
      },
    },
    required: ['panelId', 'text', 'anchor'],
  },
};

function readClearScope(value: unknown): 'currentTurn' | 'all' | undefined {
  if (value === 'currentTurn' || value === 'all') {
    return value;
  }
  return undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  return out.length > 0 ? out : undefined;
}

const declarationClearAgentDrawings: ToolDeclaration = {
  name: 'clear_agent_drawings',
  description:
    'Remove canvas marks provenance-stamped for an agent. Defaults to scope currentTurn (only shapes drawn this turn). Pass scope: "all" to wipe every agent mark. Optionally target shapeIds or a groupId container.',
  costClass: 'cheap',
  parameters: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'Agent whose marks should be cleared. Defaults to the acting agent.',
      },
      scope: {
        type: 'string',
        enum: ['currentTurn', 'all'],
        description:
          'currentTurn (default) clears only shapes from this chat turn; all clears every agent mark.',
      },
      shapeIds: {
        type: 'array',
        description: 'Optional explicit shape ids to remove (must belong to the agent).',
        items: { type: 'string' },
      },
      groupId: {
        type: 'string',
        description: 'Optional group container id — removes agent-stamped children of that group.',
      },
    },
  },
};

export const DRAWING_TOOLS: readonly ToolDefinition[] = [
  {
    declaration: declarationDrawShapes,
    handler: withDrawGate((args) => {
      const normalizedResult = normalizeDrawShapesArgs(args);
      if (normalizedResult.error !== undefined) {
        return { ok: false, error: normalizedResult.error };
      }
      let normalizedArgs = normalizedResult.args;

      const enforced = enforceStructuralDiagramDraw(normalizedArgs);
      if (enforced.error !== undefined) {
        return { ok: false, error: enforced.error };
      }
      normalizedArgs = enforced.args;

      const diagramRequest = readDrawDiagramRequest(normalizedArgs);
      if (diagramRequest !== undefined) {
        if (Array.isArray(normalizedArgs.shapes) && normalizedArgs.shapes.length > 0) {
          return {
            ok: false,
            error: 'pass either diagram with layout or explicit shapes, not both',
          };
        }
        try {
          const agentId = resolveActingAgentId(normalizedArgs);
          const result = drawAgentDiagram(agentId, diagramRequest);
          recordDrawShapesActivity(agentId, result);
          return drawToolSuccess({ kind: 'draw_shapes', result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { ok: false, error: message };
        }
      }

      if (!Array.isArray(normalizedArgs.shapes)) {
        return {
          ok: false,
          error: 'shapes must be an array, or provide diagram with layout flow, timeline, radial, or nested',
        };
      }
      const shapes: AgentDrawShapeInput[] = [];
      for (const entry of normalizedArgs.shapes) {
        const parsed = readDrawShape(entry);
        if (parsed === undefined) {
          // Skip a single shape we cannot parse rather than failing the whole
          // batch. An LLM sometimes emits one malformed entry among many;
          // dropping just that one still renders the rest and never blanks the
          // canvas when a clear preceded this draw.
          continue;
        }
        shapes.push(...(Array.isArray(parsed) ? parsed : [parsed]));
      }
      if (shapes.length === 0) {
        return {
          ok: false,
          error: 'no shape had a supported kind and geometry or wireframe stencil',
        };
      }
      try {
        const agentId = resolveActingAgentId(normalizedArgs);
        const result = drawAgentShapes(agentId, shapes);
        recordDrawShapesActivity(agentId, result);
        return drawToolSuccess({ kind: 'draw_shapes', result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
      }
    }),
  },
  {
    declaration: declarationAnnotatePanel,
    handler: withDrawGate((args) => {
      const panelId = readString(args.panelId);
      const text = readSketchText(args.text);
      const anchor = readAnchor(args.anchor);
      if (panelId === undefined) {
        return { ok: false, error: 'panelId must be a non-empty string' };
      }
      if (text === undefined) {
        return { ok: false, error: 'text must be a non-empty string' };
      }
      if (anchor === undefined) {
        return { ok: false, error: 'anchor must be top, bottom, left, right, or center' };
      }
      try {
        const agentId = resolveActingAgentId(args);
        const result = annotateAgentPanel(agentId, panelId, text, anchor);
        recordAnnotatePanelActivity(agentId, result);
        return drawToolSuccess({ kind: 'annotate_panel', result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
      }
    }),
  },
  {
    declaration: declarationClearAgentDrawings,
    handler: withDrawGate((args) => {
      try {
        const agentId = resolveActingAgentId(args);
        const scope = readClearScope(args.scope) ?? 'currentTurn';
        const shapeIds = readStringArray(args.shapeIds);
        const groupId = readString(args.groupId);
        const result = clearAgentDrawings(agentId, { scope, shapeIds, groupId });
        recordClearDrawingsActivity(agentId, result);
        return drawToolSuccess({ kind: 'clear_agent_drawings', result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
      }
    }),
  },
];
