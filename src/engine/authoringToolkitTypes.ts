/**
 * Open agent canvas authoring toolkit contracts (D50, P12-T1).
 * Types-only: safe for agents, tools, and tests without importing tldraw.
 */

/** Meta key for wireframe stencil classification on agent marks. */
export const AGENT_WIREFRAME_STENCIL_META_KEY = 'agentableWireframeStencil' as const;

/** Meta key for typed connector classification on agent arrows. */
export const AGENT_CONNECTOR_KIND_META_KEY = 'agentableConnectorKind' as const;

/** Structured refusal when model-supplied markup or URLs are rejected (G4). */
export const AUTHORING_MARKUP_REJECTED_CODE = 'AUTHORING_MARKUP_REJECTED' as const;

export type WireframeStencilKind = 'box' | 'label' | 'input' | 'button' | 'nav' | 'card';

export type AgentConnectorKind = 'dependency' | 'flow' | 'annotation';

export type AuthoringArrangeLayout = 'flow' | 'timeline' | 'radial' | 'nested';

export interface AgentInsertImageGeometry {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AgentInsertImageRequest {
  assetId?: string;
  generatePrompt?: string;
  geometry: AgentInsertImageGeometry;
  alt?: string;
}

export interface AgentInsertImageResult {
  imageShapeId: string;
  assetId: string;
  agentId: string;
  alt?: string;
}

export interface AgentConnectShapesRequest {
  from: string;
  to: string;
  kind: AgentConnectorKind;
  label?: string;
}

export interface AgentConnectShapesResult {
  connectorShapeId: string;
  from: string;
  to: string;
  kind: AgentConnectorKind;
  agentId: string;
  /**
   * Set when the label did not fit on the arrow (tight shapes wrap a pill
   * label mid-word) and was drawn as a text shape beside the midpoint.
   */
  labelShapeId?: string;
}

export interface AgentGroupShapesRequest {
  shapeIds: readonly string[];
}

export interface AgentGroupShapesResult {
  groupId: string;
  shapeIds: readonly string[];
  agentId: string;
}

export interface AgentFrameShapesRequest {
  shapeIds: readonly string[];
  name?: string;
}

export interface AgentFrameShapesResult {
  frameId: string;
  shapeIds: readonly string[];
  agentId: string;
  name?: string;
}

export interface AgentArrangeRequest {
  shapeIds?: readonly string[];
  frameId?: string;
  layout: AuthoringArrangeLayout;
}

export interface AgentArrangeResult {
  arrangedShapeIds: readonly string[];
  layout: AuthoringArrangeLayout;
  agentId: string;
  /**
   * Model-facing reminder that arrange moved the shapes in place. Without it
   * models redraw the whole diagram under fresh ids after arranging, leaving
   * a duplicate copy on the canvas.
   */
  note: string;
}

/** Resolved image asset from a trusted host bridge (never model-supplied URLs). */
export interface AuthoringResolvedImageAsset {
  assetId: string;
  src: string;
  w: number;
  h: number;
  mimeType: string;
}
