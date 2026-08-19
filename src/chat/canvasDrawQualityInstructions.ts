/**
 * Shared canvas draw-quality instructions — same rules as example 08 / in-canvas
 * chat (Nova). Operator and live chat both import this; do not fork weaker copies.
 */

/** Core drawing rules: diagram auto-layout, label-in-geo, patch-in-place repair. */
export const CANVAS_DRAW_QUALITY_INSTRUCTIONS = [
  'For flows, timelines, dependency maps, VPC/network/system diagrams, and anything with nodes and connections: call draw_shapes with diagram plus layout (flow, timeline, radial, or nested) so the canvas spaces nodes, centers labels inside boxes, and routes connectors — one structural diagram per draw_shapes call.',
  'VPC peering, cloud architecture, and network topology: use layout nested with region/container nodes (kind container) and child instances via parentId — never hand-placed shapes arrays.',
  'Put text on the box, ellipse, or arrow through its text field — never as a separate text shape layered over another shape.',
  'Size every box to fit its label with room to spare; keep labels short.',
  'Redrawing an existing id updates that shape in place; reuse the same ids when fixing overlaps.',
  'The client automatically groups each request, runs read_canvas and layout checks after every draw, and blocks clear_agent_drawings during overlap repair.',
  'Fix overlaps by patching in place (draw_shapes with existing ids, or arrange). Never clear the canvas to fix layout. One clear per turn is allowed only before the first draw, when the user explicitly asks to start over.',
].join(' ');

const STRUCTURAL_DIAGRAM_PATTERN =
  /\b(diagram|flowchart|flow chart|system diagram|sequence diagram|org chart|organization chart|vpc|peering|network|architecture|architectural|topology|system map|dependency|dependencies|aws|gcp|azure|cloud|subnet|gateway|firewall|infra|infrastructure|hub[- ]?and[- ]?spoke|microservice|data flow|component diagram|entity relationship|erd)\b/i;

/** True when the user likely wants diagram+layout, not hand-placed shapes. */
export function isStructuralDiagramIntent(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return false;
  }
  return STRUCTURAL_DIAGRAM_PATTERN.test(trimmed);
}

/** Appended to system instruction for draw-capable modes when intent is structural. */
export function buildDiagramIntentHint(userText: string): string {
  if (!isStructuralDiagramIntent(userText)) {
    return '';
  }
  return (
    '\n\n[Drawing hint for this message] Use draw_shapes with { layout: "nested"|"flow"|"radial"|"timeline", diagram: { nodes: [{ id, label, kind?, parentId? }], edges: [...] } } — ' +
    'not a hand-placed shapes array. For VPC/cloud architecture use layout nested: region nodes as containers (kind container), instances inside via parentId, peering edges between regions. Labels belong on node boxes; nested containers must fully enclose their child labels.'
  );
}
