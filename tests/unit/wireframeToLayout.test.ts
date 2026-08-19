/**
 * unit checks: wireframe layout proposal from golden shape graph.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildWireframeSlotPanelSpec,
  goldenSketchToDrawShapes,
  geometriesMatchGolden,
  normalizeWireframeProposalForCompare,
  proposeWireframeLayout,
} from '../../src/agents/workflows/wireframeToLayout';
import type { CanvasShapeGraph } from '../../src/engine/canvasPerceptionTypes';
import type { WireframeGoldenSketch, WireframeLayoutProposal } from '../../src/engine/wireframeLayoutTypes';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_GRAPH_PATH = join(__dirname, '../fixtures/wireframe-golden-shape-graph.json');
const GOLDEN_SKETCH_PATH = join(__dirname, '../fixtures/wireframe-golden-sketch.json');
const GOLDEN_PROPOSAL_PATH = join(__dirname, '../fixtures/wireframe-golden-layout-proposal.json');

function stripSourceShapeIds(proposal: WireframeLayoutProposal): WireframeLayoutProposal {
  return {...proposal,
    slots: proposal.slots.map((slot) => ({...slot,
      sourceShapeId: 'stable-for-compare',
    })),
  };
}

describe('wireframe golden fixtures ', () => {
  it('loads sketch, graph, and layout proposal fixtures', () => {
    const sketch = JSON.parse(readFileSync(GOLDEN_SKETCH_PATH, 'utf8')) as WireframeGoldenSketch;
    const graph = JSON.parse(readFileSync(GOLDEN_GRAPH_PATH, 'utf8')) as CanvasShapeGraph;
    const proposal = JSON.parse(readFileSync(GOLDEN_PROPOSAL_PATH, 'utf8')) as WireframeLayoutProposal;

    expect(sketch.shapes).toHaveLength(4);
    expect(graph.shapes).toHaveLength(4);
    expect(proposal.slots).toHaveLength(3);
  });

  it('maps golden sketch to draw_shapes arguments', () => {
    const sketch = JSON.parse(readFileSync(GOLDEN_SKETCH_PATH, 'utf8')) as WireframeGoldenSketch;
    const args = goldenSketchToDrawShapes(sketch);
    expect(args).toHaveLength(4);
    expect(args[0]).toMatchObject({
      kind: 'box',
      geometry: { kind: 'rect', x: 40, y: 40, w: 720, h: 64 },
    });
  });
});

describe('proposeWireframeLayout ', () => {
  it('derives deterministic slots from the golden shape graph', () => {
    const graph = JSON.parse(readFileSync(GOLDEN_GRAPH_PATH, 'utf8')) as CanvasShapeGraph;
    const goldenProposal = JSON.parse(
      readFileSync(GOLDEN_PROPOSAL_PATH, 'utf8')) as WireframeLayoutProposal;

    const proposal = proposeWireframeLayout(graph);
    const normalized = stripSourceShapeIds(normalizeWireframeProposalForCompare(proposal));
    const expected = stripSourceShapeIds(
      normalizeWireframeProposalForCompare(goldenProposal));

    expect(normalized).toEqual(expected);
  });

  it('uses hero label text from the main region', () => {
    const graph = JSON.parse(readFileSync(GOLDEN_GRAPH_PATH, 'utf8')) as CanvasShapeGraph;
    const proposal = proposeWireframeLayout(graph);
    const main = proposal.slots.find((slot) => slot.role === 'main');
    expect(main?.label).toBe('Hero');
  });

  it('builds valid composed specs for each role', () => {
    expect(buildWireframeSlotPanelSpec('header', 'Header').nodes.body).toBeDefined();
    expect(buildWireframeSlotPanelSpec('nav', 'Navigation').nodes.hdr).toMatchObject({
      type: 'header',
    });
    expect(buildWireframeSlotPanelSpec('main', 'Hero').nodes.copy).toMatchObject({
      type: 'text',
      props: { text: 'Hero' },
    });
  });

  it('matches golden geometry via helper', () => {
    const graph = JSON.parse(readFileSync(GOLDEN_GRAPH_PATH, 'utf8')) as CanvasShapeGraph;
    expect(geometriesMatchGolden(graph, graph)).toBe(true);
  });
});
