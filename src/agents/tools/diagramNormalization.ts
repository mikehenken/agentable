/**
 * Auto-fix LLM diagram payloads before strict parsing (P13-T7).
 */
import type {
  AgentDiagramEdge,
  AgentDiagramLayoutMode,
  AgentDiagramNodeKind,
} from '../../engine/agentDrawingTypes';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNodeKind(value: unknown): AgentDiagramNodeKind | undefined {
  if (value === 'box' || value === 'ellipse' || value === 'container') {
    return value;
  }
  return undefined;
}

function readNodeKindAlias(value: unknown): AgentDiagramNodeKind | undefined {
  const alias = readString(value)?.toLowerCase();
  if (alias === undefined) return undefined;
  if (alias === 'box' || alias === 'rect' || alias === 'rectangle') {
    return 'box';
  }
  if (alias === 'circle' || alias === 'ellipse') {
    return 'ellipse';
  }
  if (alias === 'container') {
    return 'container';
  }
  return undefined;
}

function readNodeKindFromAliases(raw: Record<string, unknown>): AgentDiagramNodeKind | undefined {
  const fromKind = readNodeKind(raw.kind);
  if (fromKind !== undefined) {
    return fromKind;
  }
  return readNodeKindAlias(raw.shape) ?? readNodeKindAlias(raw.type);
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

function readSketchText(value: unknown): string | undefined {
  const text = readString(value);
  if (text === undefined) return undefined;
  const cleaned = text
    .replace(/\\r\\n|\\n|\\r/g, '\n')
    .replace(/\\t/g, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function readDiagramLabelField(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return (
    readSketchText(value.label) ??
    readSketchText(value.text) ??
    readSketchText(value.name) ??
    readSketchText(value.title)
  );
}

function slugifyDiagramId(label: string, index: number): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : `node-${index + 1}`;
}

function normalizeLayoutMode(value: unknown): AgentDiagramLayoutMode | undefined {
  if (
    value === 'none' ||
    value === 'flow' ||
    value === 'timeline' ||
    value === 'radial' ||
    value === 'nested'
  ) {
    return value;
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'horizontal' || lower === 'left-to-right' || lower === 'left_to_right') {
      return 'flow';
    }
    if (lower === 'vertical' || lower === 'top-to-bottom') {
      return 'timeline';
    }
    if (lower === 'hub' || lower === 'spoke' || lower === 'radial') {
      return 'radial';
    }
    if (
      lower === 'nested' ||
      lower === 'layered' ||
      lower === 'architecture' ||
      lower === 'hierarchical'
    ) {
      return 'nested';
    }
  }
  return readLayoutMode(value);
}

/**
 * Auto-fix diagram payloads from the model: fill missing ids/labels, dedupe ids,
 * remap edge endpoints, and normalize layout aliases before strict parsing.
 */
export function normalizeDiagramPayload(args: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...args };
  const diagram = args.diagram;
  let layout = normalizeLayoutMode(args.layout);
  if ((layout === undefined || layout === 'none') && isRecord(diagram)) {
    const diagramLayout = normalizeLayoutMode(diagram.layout);
    if (diagramLayout !== undefined && diagramLayout !== 'none') {
      layout = diagramLayout;
    }
  }
  if (layout !== undefined && layout !== 'none') {
    next.layout = layout;
  }

  if (!isRecord(diagram) || !Array.isArray(diagram.nodes) || diagram.nodes.length === 0) {
    return next;
  }

  const usedIds = new Set<string>();
  const idRemap = new Map<string, string>();
  const nodes: Array<{
    id: string;
    label: string;
    kind?: AgentDiagramNodeKind;
    parentId?: string;
  }> = [];

  for (let index = 0; index < diagram.nodes.length; index += 1) {
    const raw = diagram.nodes[index];
    if (!isRecord(raw)) {
      const fallbackId = `node-${index + 1}`;
      usedIds.add(fallbackId);
      nodes.push({ id: fallbackId, label: `Node ${index + 1}` });
      continue;
    }

    const label =
      readDiagramLabelField(raw) ?? readString(raw.id) ?? `Node ${index + 1}`;
    const originalId = readString(raw.id);
    let id = originalId ?? slugifyDiagramId(label, index);
    if (originalId !== undefined) {
      idRemap.set(originalId, id);
    }

    let candidate = id;
    let suffix = 2;
    while (usedIds.has(candidate)) {
      candidate = `${id}-${suffix}`;
      suffix += 1;
    }
    id = candidate;
    usedIds.add(id);
    if (originalId !== undefined && originalId !== id) {
      idRemap.set(originalId, id);
    }

    const kind = readNodeKindFromAliases(raw);
    const parentId = readString(raw.parentId);
    const remappedParent =
      parentId !== undefined && idRemap.has(parentId) ? idRemap.get(parentId) : parentId;
    const nodeEntry =
      kind !== undefined
        ? { id, label, kind, ...(remappedParent !== undefined ? { parentId: remappedParent } : {}) }
        : { id, label, ...(remappedParent !== undefined ? { parentId: remappedParent } : {}) };
    nodes.push(nodeEntry);
  }

  // Second pass: remap parentId after all ids are finalized.
  for (const node of nodes) {
    if (node.parentId !== undefined && idRemap.has(node.parentId)) {
      node.parentId = idRemap.get(node.parentId);
    }
  }

  const normalizedDiagram: Record<string, unknown> = { ...diagram, nodes };
  delete normalizedDiagram.layout;

  if (Array.isArray(diagram.edges)) {
    const edges: AgentDiagramEdge[] = [];
    for (const raw of diagram.edges) {
      if (!isRecord(raw)) continue;
      let from = readString(raw.from);
      let to = readString(raw.to);
      if (from !== undefined && idRemap.has(from)) {
        from = idRemap.get(from);
      }
      if (to !== undefined && idRemap.has(to)) {
        to = idRemap.get(to);
      }
      if (from !== undefined && /^\d+$/.test(from)) {
        const idx = Number.parseInt(from, 10);
        if (idx >= 0 && idx < nodes.length) {
          from = nodes[idx]!.id;
        }
      }
      if (to !== undefined && /^\d+$/.test(to)) {
        const idx = Number.parseInt(to, 10);
        if (idx >= 0 && idx < nodes.length) {
          to = nodes[idx]!.id;
        }
      }
      if (from === undefined || to === undefined) continue;
      const edgeLabel = readDiagramLabelField(raw);
      edges.push(edgeLabel !== undefined ? { from, to, label: edgeLabel } : { from, to });
    }
    if (edges.length > 0) {
      normalizedDiagram.edges = edges;
    }
  }

  next.diagram = normalizedDiagram;
  return next;
}
