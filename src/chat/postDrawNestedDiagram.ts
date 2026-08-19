/**
 * Nested diagram post-draw review — suppress benign layout lints that fire
 * after a successful nested first draw (viewport cutoff, false arrow/overlap
 * noise) so the see-and-fix loop does not thrash the model.
 */
import type { AgentDiagramLayoutMode } from '../engine/agentDrawingTypes';
import type { CanvasShapeGraph, CanvasShapeGraphNode } from '../engine/canvasPerceptionTypes';
import type { PostDrawRepairLayout } from './postDrawCanvasGrouping';

const VIEWPORT_CUTOFF_RE = /extend past the visible view/;
const NO_CONNECTING_ARROWS_RE = /no connecting arrows/;
const TOUCH_RE = /touch; add breathing room/;
const OVERLAP_RE = /overlap; separate them\./;

function extractQuotedLabels(lint: string): string[] {
  const labels: string[] = [];
  const re = /"([^"]+)"/g;
  let match: RegExpExecArray | null = re.exec(lint);
  while (match !== null) {
    labels.push(match[1]!);
    match = re.exec(lint);
  }
  return labels;
}

function findNodeByLabel(
  graph: CanvasShapeGraph,
  label: string,
): CanvasShapeGraphNode | undefined {
  const trimmed = label.replace(/\.\.\.$/, '');
  return graph.shapes.find((node) => {
    const text = typeof node.text === 'string' ? node.text.trim() : '';
    return text === trimmed || text.startsWith(trimmed);
  });
}

function isPageLevelContainer(node: CanvasShapeGraphNode): boolean {
  if (node.kind !== 'box' && node.kind !== 'panel') {
    return false;
  }
  const parent = node.parentId;
  return parent === null || parent === undefined || /^page:/.test(String(parent));
}

function isNestedColumnSiblingOverlap(
  lint: string,
  graph: CanvasShapeGraph | null | undefined,
): boolean {
  if (graph === null || graph === undefined || !OVERLAP_RE.test(lint)) {
    return false;
  }
  const labels = extractQuotedLabels(lint);
  if (labels.length < 2) {
    return false;
  }
  const nodes = labels
    .map((label) => findNodeByLabel(graph, label))
    .filter((node): node is CanvasShapeGraphNode => node !== undefined);
  if (nodes.length < 2) {
    return false;
  }
  return nodes.every((node) => isPageLevelContainer(node));
}

/**
 * Drop layout lints that are expected after nested auto-layout (camera fit
 * handles viewport; connectors exist; column containers may touch).
 */
export function filterBenignNestedDiagramLints(
  lints: readonly string[],
  graph?: CanvasShapeGraph | null,
): string[] {
  const hasConnectors =
    graph?.shapes.some((node) => node.kind === 'arrow' || node.kind === 'freehand') ?? false;

  return lints.filter((lint) => {
    if (VIEWPORT_CUTOFF_RE.test(lint)) {
      return false;
    }
    if (NO_CONNECTING_ARROWS_RE.test(lint) && hasConnectors) {
      return false;
    }
    if (TOUCH_RE.test(lint)) {
      return false;
    }
    if (isNestedColumnSiblingOverlap(lint, graph)) {
      return false;
    }
    return true;
  });
}

/**
 * True when nested first draw succeeded and no actionable lints remain after
 * benign filtering (arrange is skip for nested, so auto-fit + filter is enough).
 */
export function shouldCompleteNestedDiagramReview(
  layout: AgentDiagramLayoutMode | undefined,
  lintsAfterFilter: readonly string[],
  _repairLayout: PostDrawRepairLayout,
): boolean {
  if (layout !== 'nested') {
    return false;
  }
  return lintsAfterFilter.length === 0;
}
