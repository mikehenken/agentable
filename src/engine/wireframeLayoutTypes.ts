/**
 * Wireframe-to-layout contracts. Types-only for agents and tests.
 */
import type { CanvasShapeGraph } from './canvasPerceptionTypes';
import type { Rect } from './types';
import type { PanelSpec } from '../panels/types';

export type WireframeLayoutRole = 'header' | 'nav' | 'main';

export interface WireframeLayoutGeometry {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WireframeLayoutSlot {
  role: WireframeLayoutRole;
  label: string;
  sourceShapeId: string;
  geometry: WireframeLayoutGeometry;
  placement: WireframeLayoutGeometry;
  spec: PanelSpec;
}

export interface WireframeLayoutProposal {
  version: 1;
  region: Rect;
  slots: WireframeLayoutSlot[];
}

export interface WireframeGoldenSketchShape {
  kind: 'box' | 'text';
  geometry: Record<string, number>;
  text?: string;
}

export interface WireframeGoldenSketch {
  version: 1;
  shapes: WireframeGoldenSketchShape[];
}

export interface WireframeToLayoutReadInput {
  graph: CanvasShapeGraph;
}
