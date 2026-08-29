/**
 * Server-side enforcement: structural diagram intents must use diagram+layout,
 * not hand-placed shapes arrays.
 */
import { isStructuralDiagramIntent } from '../../chat/canvasDrawQualityInstructions';
import { getDrawUserMessage } from '../../chat/drawIntentContext';
import { normalizeDiagramPayload } from './diagramNormalization';

export const STRUCTURAL_DIAGRAM_REQUIRED_ERROR =
  'Structural diagrams require draw_shapes with { layout: "flow"|"timeline"|"radial"|"nested", diagram: { nodes: [...], edges?: [...] } } — ' +
  'not a hand-placed shapes array. Put labels on node boxes; pass edges as diagram.edges with from/to node ids. Use nested with parentId for VPC/cloud architecture.';

type LayoutMode = 'flow' | 'timeline' | 'radial' | 'nested';

interface DiagramNodeDraft {
  id: string;
  label: string;
  kind: 'box' | 'ellipse' | 'container';
  parentId?: string;
}

interface DiagramEdgeDraft {
  from: string;
  to: string;
  label?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
}

function normalizeShapeKind(value: unknown): 'box' | 'ellipse' | 'arrow' | 'text' | undefined {
  const kind = readString(value)?.toLowerCase();
  if (kind === undefined) return undefined;
  if (kind === 'box' || kind === 'rect' || kind === 'rectangle' || kind === 'geo' || kind === 'triangle') {
    return 'box';
  }
  if (kind === 'ellipse' || kind === 'circle') {
    return 'ellipse';
  }
  if (kind === 'arrow' || kind === 'line') {
    return 'arrow';
  }
  if (kind === 'text' || kind === 'label') {
    return 'text';
  }
  return undefined;
}

function readRectCenter(entry: Record<string, unknown>): { x: number; y: number } | undefined {
  const geometry = isRecord(entry.geometry) ? entry.geometry : entry;
  const x = readFiniteNumber(geometry.x);
  const y = readFiniteNumber(geometry.y);
  const w =
    readFiniteNumber(geometry.w) ??
    readFiniteNumber(geometry.width);
  const h =
    readFiniteNumber(geometry.h) ??
    readFiniteNumber(geometry.height);
  if (x === undefined || y === undefined || w === undefined || h === undefined) {
    return undefined;
  }
  return { x: x + w / 2, y: y + h / 2 };
}

function readTextAnchor(entry: Record<string, unknown>): { x: number; y: number } | undefined {
  const geometry = isRecord(entry.geometry) ? entry.geometry : entry;
  const x = readFiniteNumber(geometry.x);
  const y = readFiniteNumber(geometry.y);
  if (x === undefined || y === undefined) return undefined;
  return { x, y };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function hasValidDiagramLayout(args: Record<string, unknown>): boolean {
  const layout = args.layout;
  if (
    layout !== 'flow' &&
    layout !== 'timeline' &&
    layout !== 'radial' &&
    layout !== 'nested'
  ) {
    return false;
  }
  const diagram = args.diagram;
  if (!isRecord(diagram) || !Array.isArray(diagram.nodes) || diagram.nodes.length === 0) {
    return false;
  }
  for (const node of diagram.nodes) {
    if (!isRecord(node)) return false;
    const id = readString(node.id);
    const label =
      readString(node.label) ??
      readString(node.text) ??
      readString(node.name) ??
      readString(node.title);
    if (id === undefined || label === undefined) {
      return false;
    }
  }
  return true;
}

export function isHandPlacedShapesOnly(args: Record<string, unknown>): boolean {
  if (!Array.isArray(args.shapes) || args.shapes.length === 0) {
    return false;
  }
  return !hasValidDiagramLayout(args);
}

export function isInPlacePatchDraw(shapes: unknown[]): boolean {
  if (shapes.length === 0) {
    return false;
  }
  return shapes.every((entry) => isRecord(entry) && readString(entry.id) !== undefined);
}

export function inferLayoutMode(userText: string): LayoutMode {
  const lower = userText.toLowerCase();
  if (
    /\b(hub[- ]?and[- ]?spoke|hub\/spoke|spoke|dependency|dependencies|dependency map|radial)\b/.test(
      lower,
    )
  ) {
    return 'radial';
  }
  if (/\b(sequence|timeline|chronolog|step[- ]by[- ]step|over time)\b/.test(lower)) {
    return 'timeline';
  }
  if (
    /\b(vpc|peering|network|architecture|architectural|topology|aws|gcp|azure|subnet|cloud|infrastructure|infra|system diagram|component diagram)\b/.test(
      lower,
    )
  ) {
    return 'nested';
  }
  return 'flow';
}

function readArrowEndpointIds(entry: Record<string, unknown>): { from: string; to: string } | undefined {
  const topFrom = readString(entry.from);
  const topTo = readString(entry.to);
  if (topFrom !== undefined && topTo !== undefined) {
    return { from: topFrom, to: topTo };
  }
  const geometry = isRecord(entry.geometry) ? entry.geometry : entry;
  const geomFrom = geometry.from;
  const geomTo = geometry.to;
  if (typeof geomFrom === 'string' && typeof geomTo === 'string') {
    const from = readString(geomFrom);
    const to = readString(geomTo);
    if (from !== undefined && to !== undefined) {
      return { from, to };
    }
  }
  return undefined;
}

export function convertHandPlacedShapesToDiagram(
  args: Record<string, unknown>,
  userText: string,
): Record<string, unknown> | undefined {
  if (!Array.isArray(args.shapes)) {
    return undefined;
  }

  const nodeDrafts: DiagramNodeDraft[] = [];
  const nodeCenters = new Map<string, { x: number; y: number }>();
  const edges: DiagramEdgeDraft[] = [];
  const orphanTexts: Array<{ label: string; anchor: { x: number; y: number } }> = [];
  let nextNodeIndex = 1;

  for (const rawEntry of args.shapes) {
    if (!isRecord(rawEntry)) {
      continue;
    }
    const kind = normalizeShapeKind(rawEntry.kind);
    if (kind === 'box' || kind === 'ellipse') {
      const id = readString(rawEntry.id) ?? `node-${nextNodeIndex++}`;
      const label = readString(rawEntry.text) ?? id;
      nodeDrafts.push({ id, label, kind });
      const center = readRectCenter(rawEntry);
      if (center !== undefined) {
        nodeCenters.set(id, center);
      }
      continue;
    }
    if (kind === 'arrow') {
      const endpoints = readArrowEndpointIds(rawEntry);
      if (endpoints !== undefined) {
        const label = readString(rawEntry.text);
        edges.push(label !== undefined ? { ...endpoints, label } : endpoints);
      }
      continue;
    }
    if (kind === 'text') {
      const label = readString(rawEntry.text);
      const anchor = readTextAnchor(rawEntry);
      if (label !== undefined && anchor !== undefined) {
        orphanTexts.push({ label, anchor });
      }
    }
  }

  for (const orphan of orphanTexts) {
    let nearest: { id: string; dist: number } | null = null;
    for (const node of nodeDrafts) {
      const center = nodeCenters.get(node.id);
      if (center === undefined) continue;
      const dist = distance(orphan.anchor, center);
      if (dist > 120) continue;
      if (nearest === null || dist < nearest.dist) {
        nearest = { id: node.id, dist };
      }
    }
    if (nearest === null) continue;
    const target = nodeDrafts.find((node) => node.id === nearest?.id);
    if (target !== undefined && target.label === target.id) {
      target.label = orphan.label;
    }
  }

  if (nodeDrafts.length < 2 && edges.length < 1) {
    return undefined;
  }

  const layout = inferLayoutMode(userText);
  const next: Record<string, unknown> = { ...args };
  delete next.shapes;
  next.layout = layout;
  next.diagram = {
    nodes: nodeDrafts.map((node) =>
      node.kind === 'ellipse' ? { id: node.id, label: node.label, kind: 'ellipse' } : { id: node.id, label: node.label },
    ),
    ...(edges.length > 0 ? { edges } : {}),
  };
  return next;
}

export interface EnforceStructuralDiagramDrawResult {
  args: Record<string, unknown>;
  error?: string;
  rewritten?: boolean;
}

export function enforceStructuralDiagramDraw(
  args: Record<string, unknown>,
): EnforceStructuralDiagramDrawResult {
  const userText = getDrawUserMessage();
  let workingArgs = normalizeDiagramPayload(args);

  if (userText !== undefined && isStructuralDiagramIntent(userText)) {
    if (isRecord(workingArgs.diagram) && !hasValidDiagramLayout(workingArgs)) {
      workingArgs = normalizeDiagramPayload(workingArgs);
    }
  }

  if (userText === undefined || !isStructuralDiagramIntent(userText)) {
    return { args: workingArgs };
  }

  if (!isHandPlacedShapesOnly(workingArgs)) {
    return { args: workingArgs };
  }

  const shapes = workingArgs.shapes;
  if (!Array.isArray(shapes)) {
    return { args: workingArgs };
  }

  if (isInPlacePatchDraw(shapes)) {
    return { args: workingArgs };
  }

  const converted = convertHandPlacedShapesToDiagram(workingArgs, userText);
  if (converted !== undefined) {
    return { args: converted, rewritten: true };
  }

  return { args: workingArgs, error: STRUCTURAL_DIAGRAM_REQUIRED_ERROR };
}
