/**
 * Canvas perception contracts. Types-only for agents, tools, and tests.
 */
import type { AgentDrawGeometry, AgentDrawShapeKind } from './agentDrawingTypes';
import type { Rect } from './types';

/** Region selector for read_canvas and screenshot_canvas. */
export type CanvasPerceptionRegion =
  | { kind: 'viewport' }
  | { kind: 'rect'; rect: Rect };

export interface CanvasReadOptions {
  region?: CanvasPerceptionRegion;
  /** Max shapes returned before truncation (default 200). */
  budget?: number;
}

export interface CanvasScreenshotOptions {
  region?: CanvasPerceptionRegion;
  /** PNG pixel ratio (default 1). */
  pixelRatio?: number;
  /** When the viewport/region is empty, screenshot these shapes instead. */
  fallbackShapeIds?: readonly string[];
}

export interface CanvasShapePanelMeta {
  panelId: string;
  minimized: boolean;
}

/** One node in the structured shape graph returned by read_canvas. */
export interface CanvasShapeGraphNode {
  id: string;
  /** Native tldraw shape type (geo, arrow, text, draw, panel,...). */
  nativeType: string;
  /** Simplified agent-draw kind when mappable. */
  kind?: AgentDrawShapeKind | 'panel';
  geometry: AgentDrawGeometry | CanvasPanelGeometry;
  text?: string;
  /** Resolved arrow endpoint shape ids when bindings or refs exist. */
  from?: string;
  to?: string;
  parentId?: string | null;
  zOrder: number;
  agentId?: string;
  panel?: CanvasShapePanelMeta;
}

export interface CanvasPanelGeometry {
  kind: 'panel';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CanvasShapeGraph {
  region: Rect;
  shapes: CanvasShapeGraphNode[];
  truncated?: boolean;
}

export interface CanvasScreenshotResult {
  dataUrl: string;
  width: number;
  height: number;
  format: 'png';
  region: Rect;
}
