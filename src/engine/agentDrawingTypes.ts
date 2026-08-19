/**
 * Agent drawing tool contracts. Types-only: safe for agents,
 * engine SPI consumers, and tests without importing tldraw.
 */
import type { EngineCapabilities } from './types';

/** Provenance meta key stamped on every agent-created canvas mark. */
export const AGENT_SHAPE_PROVENANCE_META_KEY = 'agentableAgent' as const;

/** Links panel callouts to a panel instance for move/dock follow behavior. */
export const AGENT_PANEL_ANCHOR_META_KEY = 'agentablePanelAnchor' as const;

export const AGENT_ANNOTATION_KIND_META_KEY = 'agentableAnnotation' as const;

/**
 * Meta keys linking a diagram edge arrow to its endpoint node ids (and
 * carrying its label), so re-layout tools (arrange) can move the arrows
 * with their nodes instead of stranding them where they were drawn.
 */
export const AGENT_EDGE_FROM_META_KEY = 'agentableEdgeFrom' as const;
export const AGENT_EDGE_TO_META_KEY = 'agentableEdgeTo' as const;
export const AGENT_EDGE_LABEL_META_KEY = 'agentableEdgeLabel' as const;
/**
 * Marks a standalone text shape as a diagram edge's label. Edge labels
 * render as fixed-width text beside the arrow, never as tldraw label
 * pills: a pill wraps to the arrow's length, so any move that shortens
 * the arrow re-breaks the label mid-word ("downli nk").
 */
export const AGENT_EDGE_LABEL_TEXT_META_KEY = 'agentableEdgeLabelText' as const;

export type AgentDrawShapeKind = 'box' | 'ellipse' | 'arrow' | 'text' | 'freehand';

export type AgentPanelAnchor = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface AgentDrawPoint {
  x: number;
  y: number;
}

export interface AgentDrawRectGeometry {
  kind: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AgentDrawSegmentGeometry {
  kind: 'segment';
  from: AgentDrawPoint;
  to: AgentDrawPoint;
}

export interface AgentDrawPointsGeometry {
  kind: 'points';
  points: readonly AgentDrawPoint[];
  /**
   * When true, the freehand path closes and solid fill can render a silhouette.
   * When omitted, closure is inferred if the first and last points are equal.
   */
  closed?: boolean;
}

export interface AgentDrawTextGeometry {
  kind: 'text';
  x: number;
  y: number;
  maxWidth?: number;
  /**
   * Measured page extents, reported by perception reads only. Draw inputs
   * never set these; text sizes itself from content and maxWidth.
   */
  w?: number;
  h?: number;
}

export type AgentDrawGeometry =
  | AgentDrawRectGeometry
  | AgentDrawSegmentGeometry
  | AgentDrawPointsGeometry
  | AgentDrawTextGeometry;

export interface AgentDrawShapeStyle {
  color?: string;
  fill?: 'none' | 'semi' | 'solid';
  dash?: 'draw' | 'dashed' | 'dotted' | 'solid';
  /** tldraw label/stroke size. Drives visual hierarchy (title vs body). */
  size?: 's' | 'm' | 'l' | 'xl';
}

export interface AgentDrawShapeInput {
  kind: AgentDrawShapeKind;
  geometry: AgentDrawGeometry;
  /**
   * Optional caller/model-assigned id. When present the created shape uses it
   * (as `shape:<id>`), so later tools (connect_shapes, group_shapes,
   * frame_shapes) can reference this shape by the same id.
   */
  id?: string;
  text?: string;
  /** Optional shape ref ids for arrow endpoints (tldraw shape ids). */
  from?: string;
  to?: string;
  style?: AgentDrawShapeStyle;
  /** Additional provenance or stencil meta merged onto the created shape. */
  meta?: Readonly<Record<string, string>>;
  /**
   * Arc offset for an arrow's midpoint (tldraw bend). Compiler-internal:
   * set for diagram edges that skip over nodes so they rise over the row
   * instead of cutting through it. Never model-supplied.
   */
  bend?: number;
}

export type AgentDiagramLayoutMode = 'none' | 'flow' | 'timeline' | 'radial' | 'nested';

export type AgentDiagramNodeKind = 'box' | 'ellipse' | 'container';

export interface AgentDiagramNode {
  id: string;
  label: string;
  kind?: AgentDiagramNodeKind;
  /** When set, this node is laid out inside the parent container (nested layout). */
  parentId?: string;
}

export interface AgentDiagramEdge {
  from: string;
  to: string;
  label?: string;
}

/** Logical diagram structure: no coordinates required. */
export interface AgentDiagramStructure {
  nodes: readonly AgentDiagramNode[];
  edges?: readonly AgentDiagramEdge[];
  /** Optional explicit order; defaults to nodes array order. */
  order?: readonly string[];
}

export type AgentDiagramPlacement =
  | { kind: 'viewport' }
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'nearPanel'; panelId: string; side?: 'right' | 'left' | 'bottom' | 'top' };

/** Progressive reveal for speech-synced drawing. */
export interface AgentDiagramProgressive {
  /** 1-based count of nodes (in layout order) to render this step. */
  step: number;
  totalSteps?: number;
}

export interface AgentDrawDiagramRequest {
  layout: Exclude<AgentDiagramLayoutMode, 'none'>;
  diagram: AgentDiagramStructure;
  placement?: AgentDiagramPlacement;
  progressive?: AgentDiagramProgressive;
  style?: AgentDrawShapeStyle;
}

export interface AgentDrawShapesResult {
  createdShapeIds: string[];
  agentId: string;
  layout?: AgentDiagramLayoutMode;
  progressiveStep?: number;
  /**
   * Set when the whole batch was translated to clear existing canvas
   * content, so the model knows its coordinates shifted.
   */
  placementNote?: string;
}

export interface AgentAnnotatePanelResult {
  calloutShapeId: string;
  panelId: string;
  agentId: string;
}

export interface AgentClearDrawingsResult {
  removedShapeIds: string[];
  agentId: string;
}

/** Structured refusal when the mounted engine lacks draw capability (/). */
export const ENGINE_DRAW_UNAVAILABLE_CODE = 'ENGINE_DRAW_UNAVAILABLE' as const;

/**
 * Typed capability refusal for draw, canvas perception ("see"), and
 * walkthrough tools when the mounted engine's declared `EngineCapabilities`
 * does not include the capability the tool needs (/). Carries
 * a stable code, the missing capability key, and an adopter-safe message.
 * Every draw/see/walkthrough tool call reaches this refusal through the
 * normal `ToolResult` contract: never a thrown error, never a silent
 * no-op. The check is derived from the mounted engine's `capabilities`
 * object, never from an engine name or type check.
 */
export interface EngineCapabilityRefusal {
  ok: false;
  code: typeof ENGINE_DRAW_UNAVAILABLE_CODE;
  capability: keyof EngineCapabilities;
  message: string;
}
