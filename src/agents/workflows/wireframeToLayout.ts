/**
 * Wireframe-to-layout flagship workflow.
 *
 * Deterministic pipeline: sketch (draw_shapes) -> read_canvas -> propose layout
 * -> HITL apply via compose_panel + run_panel_action.
 */
import type {
  CanvasShapeGraph,
  CanvasShapeGraphNode,
} from '../../engine/canvasPerceptionTypes';
import type {
  WireframeGoldenSketch,
  WireframeLayoutGeometry,
  WireframeLayoutProposal,
  WireframeLayoutRole,
  WireframeLayoutSlot,
} from '../../engine/wireframeLayoutTypes';
import type { PanelSpec } from '../../panels/types';

const ROLE_ORDER: readonly WireframeLayoutRole[] = ['header', 'nav', 'main'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRectGeometry(node: CanvasShapeGraphNode): WireframeLayoutGeometry | null {
  const geometry = node.geometry;
  if (!isRecord(geometry) || geometry.kind !== 'rect') {
    return null;
  }
  const x = geometry.x;
  const y = geometry.y;
  const w = geometry.w;
  const h = geometry.h;
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof w !== 'number' ||
    typeof h !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(w) ||
    !Number.isFinite(h) ||
    w <= 0 ||
    h <= 0
  ) {
    return null;
  }
  return { x, y, w, h };
}

function readTextGeometry(node: CanvasShapeGraphNode): { x: number; y: number } | null {
  const geometry = node.geometry;
  if (!isRecord(geometry) || geometry.kind !== 'text') {
    return null;
  }
  const x = geometry.x;
  const y = geometry.y;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return { x, y };
}

function containsPoint(rect: WireframeLayoutGeometry, point: { x: number; y: number }): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function area(rect: WireframeLayoutGeometry): number {
  return rect.w * rect.h;
}

function roleDefaultLabel(role: WireframeLayoutRole): string {
  if (role === 'header') return 'Header';
  if (role === 'nav') return 'Navigation';
  return 'Main';
}

function roleHeaderTitle(role: WireframeLayoutRole): string {
  if (role === 'header') return 'Site header';
  if (role === 'nav') return 'Navigation';
  return 'Hero section';
}

export function buildWireframeSlotPanelSpec(role: WireframeLayoutRole, label: string): PanelSpec {
  const title = roleHeaderTitle(role);
  return {
    v: 1,
    origin: 'agent',
    root: 'body',
    nodes: {
      body: { type: 'panel-body', children: ['hdr', 'copy'] },
      hdr: { type: 'header', props: { title } },
      copy: { type: 'text', props: { text: label } },
    },
  };
}

function classifyWireframeBoxes(
  boxes: Array<{ node: CanvasShapeGraphNode; geometry: WireframeLayoutGeometry }>): Map<WireframeLayoutRole, { node: CanvasShapeGraphNode; geometry: WireframeLayoutGeometry }> {
  if (boxes.length < 3) {
    throw new Error(`wireframe requires at least three box regions, found ${boxes.length}`);
  }

  const sortedByTop = [...boxes].sort((left, right) => {
    if (left.geometry.y !== right.geometry.y) {
      return left.geometry.y - right.geometry.y;
    }
    return left.geometry.x - right.geometry.x;
  });

  const headerCandidate = sortedByTop.reduce((best, current) => {
    if (current.geometry.y > sortedByTop[0]!.geometry.y + 8) {
      return best;
    }
    if (current.geometry.w / current.geometry.h > best.geometry.w / best.geometry.h) {
      return current;
    }
    return best;
  }, sortedByTop[0]!);

  const remaining = boxes.filter((entry) => entry.node.id !== headerCandidate.node.id);
  const navCandidate = remaining.reduce((best, current) => {
    if (current.geometry.x < best.geometry.x) {
      return current;
    }
    if (current.geometry.x === best.geometry.x && current.geometry.w < best.geometry.w) {
      return current;
    }
    return best;
  }, remaining[0]!);

  const mainCandidate = remaining.filter((entry) => entry.node.id !== navCandidate.node.id).reduce((best, current) => (area(current.geometry) > area(best.geometry) ? current: best));

  return new Map<WireframeLayoutRole, { node: CanvasShapeGraphNode; geometry: WireframeLayoutGeometry }>([
    ['header', headerCandidate],
    ['nav', navCandidate],
    ['main', mainCandidate],
  ]);
}

function resolveMainLabel(
  graph: CanvasShapeGraph,
  mainGeometry: WireframeLayoutGeometry): string {
  for (const node of graph.shapes) {
    if (typeof node.text !== 'string' || node.text.length === 0) {
      continue;
    }
    const point = readTextGeometry(node);
    if (point !== null && containsPoint(mainGeometry, point)) {
      return node.text;
    }
  }
  return roleDefaultLabel('main');
}

export function proposeWireframeLayout(graph: CanvasShapeGraph): WireframeLayoutProposal {
  const boxes = graph.shapes.map((node) => {
      const geometry = readRectGeometry(node);
      if (geometry === null) {
        return null;
      }
      return { node, geometry };
    }).filter((entry): entry is { node: CanvasShapeGraphNode; geometry: WireframeLayoutGeometry } => entry !== null);

  const classified = classifyWireframeBoxes(boxes);
  const mainGeometry = classified.get('main')!.geometry;
  const mainLabel = resolveMainLabel(graph, mainGeometry);

  const slots: WireframeLayoutSlot[] = ROLE_ORDER.map((role) => {
    const match = classified.get(role);
    if (match === undefined) {
      throw new Error(`missing wireframe region for role "${role}"`);
    }
    const label = role === 'main' ? mainLabel: roleDefaultLabel(role);
    return {
      role,
      label,
      sourceShapeId: match.node.id,
      geometry: match.geometry,
      placement: match.geometry,
      spec: buildWireframeSlotPanelSpec(role, label),
    };
  });

  return {
    version: 1,
    region: graph.region,
    slots,
  };
}

export function goldenSketchToDrawShapes(
  sketch: WireframeGoldenSketch): Array<Record<string, unknown>> {
  return sketch.shapes.map((entry) => {
    const shape: Record<string, unknown> = {
      kind: entry.kind,
      geometry: entry.geometry,
    };
    if (entry.text !== undefined) {
      shape.text = entry.text;
    }
    return shape;
  });
}

export function normalizeWireframeProposalForCompare(
  proposal: WireframeLayoutProposal): WireframeLayoutProposal {
  return {
    version: proposal.version,
    region: proposal.region,
    slots: proposal.slots.map((slot) => ({
      role: slot.role,
      label: slot.label,
      sourceShapeId: slot.sourceShapeId,
      geometry: slot.geometry,
      placement: slot.placement,
      spec: {
        v: slot.spec.v,
        origin: 'agent',
        root: slot.spec.root,
        nodes: slot.spec.nodes,
      },
    })),
  };
}

export function geometriesMatchGolden(graph: CanvasShapeGraph, golden: CanvasShapeGraph): boolean {
  if (graph.region.x !== golden.region.x) return false;
  if (graph.region.y !== golden.region.y) return false;
  if (graph.region.w !== golden.region.w) return false;
  if (graph.region.h !== golden.region.h) return false;

  const graphBoxes = graph.shapes.map((node) => readRectGeometry(node)).filter((entry): entry is WireframeLayoutGeometry => entry !== null).sort((left, right) => left.y - right.y || left.x - right.x);

  const goldenBoxes = golden.shapes.map((node) => readRectGeometry(node)).filter((entry): entry is WireframeLayoutGeometry => entry !== null).sort((left, right) => left.y - right.y || left.x - right.x);

  if (graphBoxes.length !== goldenBoxes.length) {
    return false;
  }

  for (let index = 0; index < graphBoxes.length; index += 1) {
    const left = graphBoxes[index]!;
    const right = goldenBoxes[index]!;
    if (
      left.x !== right.x ||
      left.y !== right.y ||
      left.w !== right.w ||
      left.h !== right.h
    ) {
      return false;
    }
  }

  const graphText = graph.shapes.map((node) => node.text).filter((entry): entry is string => typeof entry === 'string').sort();
  const goldenText = golden.shapes.map((node) => node.text).filter((entry): entry is string => typeof entry === 'string').sort();

  return graphText.join('|') === goldenText.join('|');
}
