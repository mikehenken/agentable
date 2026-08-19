/**
 * automated checks: communicative visuals auto-layout determinism,
 * diagram-from-structure compilation, progressive drawing, and tool routing.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createShapeId } from 'tldraw';
import {
  bindEngineCapabilities,
  resetEngineCapabilitiesForTests,
} from '../../src/agents/engineBridge';
import { withAgentToolContextAsync } from '../../src/agents/agentContext';
import { DRAWING_TOOLS } from '../../src/agents/tools/drawingTools';
import type { EngineCapabilities } from '../../src/engine/types';
import {
  AGENT_EDGE_FROM_META_KEY,
  AGENT_EDGE_LABEL_META_KEY,
  AGENT_EDGE_LABEL_TEXT_META_KEY,
  AGENT_EDGE_TO_META_KEY,
  type AgentDiagramStructure,
} from '../../src/engine/agentDrawingTypes';
import {
  DIAGRAM_NODE_GAP_X,
  DIAGRAM_NODE_GAP_Y,
  DIAGRAM_NODE_HEIGHT,
  DIAGRAM_NODE_WIDTH,
  DIAGRAM_PADDING,
  DIAGRAM_RADIAL_RADIUS,
  edgeLabelFlowGap,
  edgeLabelTextWidth,
  edgeLabelTimelineGap,
  estimateNodeSize,
  fitLayoutInBounds,
  layoutDiagramNodes,
  layoutNested,
  NESTED_TOP_LEVEL_GAP,
} from '../../src/engines/tldraw/agentDrawing/communicativeVisualLayout';
import { compileDiagramToDrawShapes } from '../../src/engines/tldraw/agentDrawing/diagramToDrawShapes';
import {
  bindEditor,
  __resetPanelShapeApiForTests__,
} from '../../src/engines/tldraw/shapes/panelShapeApi';
import {
  drawAgentDiagram,
  drawAgentShapes,
} from '../../src/engines/tldraw/agentDrawing/agentDrawingApi';

const PLACEMENT_BOUNDS = { x: 100, y: 80, w: 800, h: 600 };

const CAREER_DIAGRAM: AgentDiagramStructure = {
  nodes: [
    { id: 'a', label: 'Intern' },
    { id: 'b', label: 'Engineer' },
    { id: 'c', label: 'Lead' },
    { id: 'd', label: 'Director' },
  ],
};

const RADIAL_DIAGRAM: AgentDiagramStructure = {
  nodes: [
    { id: 'hub', label: 'Resort HQ' },
    { id: 'n1', label: 'Island A' },
    { id: 'n2', label: 'Island B' },
    { id: 'n3', label: 'Island C' },
  ],
};

const VPC_PEERING_DIAGRAM: AgentDiagramStructure = {
  nodes: [
    { id: 'aws', label: 'AWS Region', kind: 'container' },
    { id: 'aws-ec2', label: 'EC2 Instance', parentId: 'aws' },
    { id: 'aws-rds', label: 'RDS Database', parentId: 'aws' },
    { id: 'peering', label: 'VPC Peering' },
    { id: 'gcp', label: 'GCP Region', kind: 'container' },
    { id: 'gcp-vm', label: 'Compute VM', parentId: 'gcp' },
  ],
  edges: [
    { from: 'aws', to: 'peering', label: 'peering' },
    { from: 'peering', to: 'gcp' },
  ],
};

/** QA regression (P13): region → VPC → instance (9 nodes, 2-level nesting). */
const VPC_PEERING_NESTED_TWO_LEVEL: AgentDiagramStructure = {
  nodes: [
    { id: 'aws', label: 'AWS Cloud', kind: 'container' },
    { id: 'aws_vpc', label: 'AWS VPC', kind: 'container', parentId: 'aws' },
    { id: 'aws_ec2', label: 'EC2 Instance', parentId: 'aws_vpc' },
    { id: 'aws_vpg', label: 'Virtual Private Gateway', parentId: 'aws_vpc' },
    { id: 'peering', label: 'VPC Peering' },
    { id: 'gcp', label: 'GCP Cloud', kind: 'container' },
    { id: 'gcp_vpc', label: 'GCP VPC', kind: 'container', parentId: 'gcp' },
    { id: 'gcp_ce', label: 'Compute Engine', parentId: 'gcp_vpc' },
    { id: 'gcp_vgw', label: 'Cloud VPN Gateway', parentId: 'gcp_vpc' },
  ],
  edges: [
    { from: 'aws_vpg', to: 'peering', label: 'peering' },
    { from: 'peering', to: 'gcp_vgw' },
    { from: 'aws_ec2', to: 'aws_vpg' },
    { from: 'gcp_ce', to: 'gcp_vgw' },
  ],
};

function makeCapabilities(draw: boolean): EngineCapabilities {
  return {
    frames: true,
    draw,
    minimap: true,
    infinitePan: true,
    nativeSnapshots: true,
  };
}

interface StubEditor {
  getViewportPageBounds(): Mock;
  getShapePageBounds(): Mock;
}

function makeStubEditor(viewport = PLACEMENT_BOUNDS): StubEditor {
  return {
    getViewportPageBounds: vi.fn(() => viewport),
    getShapePageBounds: vi.fn((id: string) => {
      if (id === String(createShapeId('panel:chat'))) {
        return { x: 40, y: 40, w: 320, h: 240 };
      }
      return null;
    }),
  };
}

describe('communicative visual layout determinism', () => {
  it('flow layout is deterministic for the same diagram', () => {
    const first = layoutDiagramNodes('flow', CAREER_DIAGRAM);
    const second = layoutDiagramNodes('flow', CAREER_DIAGRAM);
    expect(first).toEqual(second);
    expect(first.nodes).toHaveLength(4);
    const firstNodeWidth = estimateNodeSize(CAREER_DIAGRAM.nodes[0]!.label).w;
    expect(first.nodes[1]?.rect.x).toBe(firstNodeWidth + DIAGRAM_NODE_GAP_X);
    expect(first.nodes[1]?.rect.y).toBe(0);
  });

  it('timeline layout stacks nodes vertically in order', () => {
    const layout = layoutDiagramNodes('timeline', CAREER_DIAGRAM);
    const rowHeight = layout.nodes[0]?.rect.h ?? DIAGRAM_NODE_HEIGHT;
    expect(layout.nodes[0]?.rect.y).toBe(0);
    expect(layout.nodes[1]?.rect.y).toBe(rowHeight + DIAGRAM_NODE_GAP_Y);
    expect(layout.nodes[2]?.rect.y).toBe((rowHeight + DIAGRAM_NODE_GAP_Y) * 2);
  });

  it('radial layout places the first node at center and others on a ring', () => {
    const layout = layoutDiagramNodes('radial', RADIAL_DIAGRAM);
    const hubSize = estimateNodeSize(RADIAL_DIAGRAM.nodes[0]!.label);
    expect(layout.nodes[0]?.rect.x).toBe(-hubSize.w / 2);
    expect(layout.nodes[0]?.rect.y).toBe(-hubSize.h / 2);
    const orbit = layout.nodes[1]?.rect;
    expect(orbit).toBeDefined();
    const cx = orbit!.x + orbit!.w / 2;
    const cy = orbit!.y + orbit!.h / 2;
    const radius = Math.hypot(cx, cy);
    expect(radius).toBeGreaterThanOrEqual(DIAGRAM_RADIAL_RADIUS - 0.01);
  });

  it('nested layout places top-level regions in columns with children inside containers', () => {
    const layout = layoutDiagramNodes('nested', VPC_PEERING_DIAGRAM);
    expect(layout.nodes.length).toBe(VPC_PEERING_DIAGRAM.nodes.length);

    const byId = new Map(layout.nodes.map((entry) => [entry.node.id, entry.rect]));
    const aws = byId.get('aws');
    const peering = byId.get('peering');
    const gcp = byId.get('gcp');
    const awsEc2 = byId.get('aws-ec2');
    const gcpVm = byId.get('gcp-vm');

    expect(aws).toBeDefined();
    expect(peering).toBeDefined();
    expect(gcp).toBeDefined();
    expect(awsEc2).toBeDefined();
    expect(gcpVm).toBeDefined();

    // Three distinct horizontal columns: AWS | peering | GCP — not one flat row at Y=0.
    expect(peering!.x).toBeGreaterThan(aws!.x + aws!.w);
    expect(gcp!.x).toBeGreaterThan(peering!.x + peering!.w);

    // Children sit inside their parent container bounds, below the container top.
    expect(awsEc2!.y).toBeGreaterThan(aws!.y);
    expect(awsEc2!.y).toBeLessThan(aws!.y + aws!.h);
    expect(gcpVm!.y).toBeGreaterThan(gcp!.y);

    // Not every node shares the same Y=0 baseline (flow would center all on one row).
    const uniqueYs = new Set(layout.nodes.map((entry) => Math.round(entry.rect.y)));
    expect(uniqueYs.size).toBeGreaterThan(1);
  });

  it('layoutNested export matches layoutDiagramNodes nested mode', () => {
    const direct = layoutNested(VPC_PEERING_DIAGRAM.nodes);
    const viaSwitch = layoutDiagramNodes('nested', VPC_PEERING_DIAGRAM);
    expect(direct).toEqual(viaSwitch);
    const topLevel = viaSwitch.nodes.filter((entry) => entry.node.parentId === undefined);
    expect(topLevel.length).toBe(3);
    if (topLevel.length >= 2) {
      expect(topLevel[1]!.rect.x - (topLevel[0]!.rect.x + topLevel[0]!.rect.w)).toBe(
        NESTED_TOP_LEVEL_GAP);
    }
  });

  it('nested layout positions all nodes in a two-level VPC peering diagram (9 nodes)', () => {
    const layout = layoutDiagramNodes('nested', VPC_PEERING_NESTED_TWO_LEVEL);
    expect(layout.nodes).toHaveLength(VPC_PEERING_NESTED_TWO_LEVEL.nodes.length);

    const byId = new Map(layout.nodes.map((entry) => [entry.node.id, entry.rect]));
    for (const node of VPC_PEERING_NESTED_TWO_LEVEL.nodes) {
      expect(byId.has(node.id)).toBe(true);
    }

    const aws = byId.get('aws')!;
    const awsVpc = byId.get('aws_vpc')!;
    const awsEc2 = byId.get('aws_ec2')!;
    const awsVpg = byId.get('aws_vpg')!;
    const gcp = byId.get('gcp')!;
    const gcpVpc = byId.get('gcp_vpc')!;
    const gcpCe = byId.get('gcp_ce')!;
    const gcpVgw = byId.get('gcp_vgw')!;
    const peering = byId.get('peering')!;

    // Top-level columns: AWS | peering | GCP.
    expect(peering.x).toBeGreaterThan(aws.x + aws.w);
    expect(gcp.x).toBeGreaterThan(peering.x + peering.w);

    // aws_vpc sits inside aws; leaves sit inside aws_vpc.
    expect(awsVpc.x).toBeGreaterThan(aws.x);
    expect(awsVpc.y).toBeGreaterThan(aws.y);
    expect(awsVpc.x + awsVpc.w).toBeLessThanOrEqual(aws.x + aws.w + 0.01);
    expect(awsVpc.y + awsVpc.h).toBeLessThanOrEqual(aws.y + aws.h + 0.01);

    expect(awsEc2.x).toBeGreaterThan(awsVpc.x);
    expect(awsEc2.y).toBeGreaterThan(awsVpc.y);
    expect(awsEc2.x + awsEc2.w).toBeLessThanOrEqual(awsVpc.x + awsVpc.w + 0.01);
    expect(awsEc2.y + awsEc2.h).toBeLessThanOrEqual(awsVpc.y + awsVpc.h + 0.01);

    expect(awsVpg.x).toBeGreaterThan(awsVpc.x);
    expect(awsVpg.y).toBeGreaterThan(awsVpc.y);

    // GCP mirror: gcp_ce inside gcp_vpc inside gcp column.
    expect(gcpVpc.x).toBeGreaterThan(gcp.x);
    expect(gcpCe.x).toBeGreaterThan(gcpVpc.x);
    expect(gcpCe.y).toBeGreaterThan(gcpVpc.y);
    expect(gcpVgw.x).toBeGreaterThan(gcpVpc.x);
    expect(gcpVgw.y).toBeGreaterThan(gcpVpc.y);
  });

  it('deeply nested aws→aws_vpc→ec2 keeps ec2 inside both ancestor containers', () => {
    const layout = layoutNested([
      { id: 'aws', label: 'AWS Cloud', kind: 'container' },
      { id: 'aws_vpc', label: 'AWS VPC', kind: 'container', parentId: 'aws' },
      { id: 'ec2', label: 'EC2 Instance', parentId: 'aws_vpc' },
    ]);

    expect(layout.nodes).toHaveLength(3);
    const byId = new Map(layout.nodes.map((entry) => [entry.node.id, entry.rect]));
    const aws = byId.get('aws')!;
    const awsVpc = byId.get('aws_vpc')!;
    const ec2 = byId.get('ec2')!;

    expect(awsVpc.x).toBeGreaterThan(aws.x);
    expect(awsVpc.y).toBeGreaterThan(aws.y);
    expect(awsVpc.x + awsVpc.w).toBeLessThanOrEqual(aws.x + aws.w + 0.01);
    expect(awsVpc.y + awsVpc.h).toBeLessThanOrEqual(aws.y + aws.h + 0.01);

    expect(ec2.x).toBeGreaterThan(awsVpc.x);
    expect(ec2.y).toBeGreaterThan(awsVpc.y);
    expect(ec2.x + ec2.w).toBeLessThanOrEqual(awsVpc.x + awsVpc.w + 0.01);
    expect(ec2.y + ec2.h).toBeLessThanOrEqual(awsVpc.y + awsVpc.h + 0.01);
  });

  it('fitLayoutInBounds centers content within placement bounds', () => {
    const wideBounds = {...PLACEMENT_BOUNDS, w: 1200 };
    const raw = layoutDiagramNodes('flow', CAREER_DIAGRAM);
    const fitted = fitLayoutInBounds(raw, wideBounds);
    const minX = Math.min(...fitted.nodes.map((entry) => entry.rect.x));
    const maxX = Math.max(...fitted.nodes.map((entry) => entry.rect.x + entry.rect.w));
    expect(minX).toBeGreaterThanOrEqual(wideBounds.x + DIAGRAM_PADDING - 0.01);
    expect(maxX).toBeLessThanOrEqual(
      wideBounds.x + wideBounds.w - DIAGRAM_PADDING + 0.01);
  });
});

describe('diagram to draw_shapes compilation', () => {
  let editor: StubEditor;

  beforeEach(() => {
    editor = makeStubEditor();
  });

  it('renders career trajectory from structure without coordinates in the request', () => {
    const shapes = compileDiagramToDrawShapes(editor as never, {
      layout: 'timeline',
      diagram: CAREER_DIAGRAM,
      placement: { kind: 'rect',...PLACEMENT_BOUNDS },
    });

    const boxes = shapes.filter((shape) => shape.kind === 'box');
    const arrows = shapes.filter((shape) => shape.kind === 'arrow');
    const looseText = shapes.filter((shape) => shape.kind === 'text');

    expect(boxes).toHaveLength(4);
    // Labels ride inside the node shape (tldraw centers and wraps them), so
    // the compiler emits no separately-positioned text shapes to drift or
    // overlap their box.
    expect(looseText).toHaveLength(0);
    expect(boxes.map((shape) => shape.text)).toEqual([
      'Intern',
      'Engineer',
      'Lead',
      'Director',
    ]);
    // Node ids pass through so connect_shapes can reference diagram nodes.
    expect(boxes.map((shape) => shape.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(arrows).toHaveLength(3);
    for (const shape of shapes) {
      expect(shape.geometry.kind).not.toBe('points');
    }
  });

  it('clips edges to node boundaries so connectors never run through boxes', () => {
    // Regression: center-to-center edges in a vertical timeline drew one
    // line straight through every box they linked.
    const shapes = compileDiagramToDrawShapes(editor as never, {
      layout: 'timeline',
      diagram: {
        nodes: [
          { id: 'a', label: 'Stage One' },
          { id: 'b', label: 'Stage Two' },
        ],
      },
      placement: { kind: 'rect',...PLACEMENT_BOUNDS },
    });

    const boxes = shapes.filter((shape) => shape.kind === 'box');
    const arrow = shapes.find((shape) => shape.kind === 'arrow');
    expect(boxes).toHaveLength(2);
    expect(arrow).toBeDefined();

    const top = boxes.find((shape) => shape.id === 'a')!.geometry as {
      y: number;
      h: number;
    };
    const bottom = boxes.find((shape) => shape.id === 'b')!.geometry as {
      y: number;
    };
    const segment = arrow!.geometry as {
      from: { x: number; y: number };
      to: { x: number; y: number };
    };
    // The arrow starts below the first box and ends above the second, never
    // inside either.
    expect(segment.from.y).toBeGreaterThanOrEqual(top.y + top.h);
    expect(segment.to.y).toBeLessThanOrEqual(bottom.y);
    expect(segment.from.y).toBeLessThan(segment.to.y);
  });

  it('colors nodes by role and keeps edges visually subordinate by default', () => {
    const shapes = compileDiagramToDrawShapes(editor as never, {
      layout: 'flow',
      diagram: {
        nodes: [
          { id: 'start', label: 'Start', kind: 'ellipse' },
          { id: 'work', label: 'Process' },
          { id: 'end', label: 'End', kind: 'ellipse' },
        ],
      },
      placement: { kind: 'rect',...PLACEMENT_BOUNDS },
    });

    const ellipses = shapes.filter((shape) => shape.kind === 'ellipse');
    const boxes = shapes.filter((shape) => shape.kind === 'box');
    const arrows = shapes.filter((shape) => shape.kind === 'arrow');

    expect(ellipses.every((shape) => shape.style?.color === 'green')).toBe(true);
    expect(boxes.every((shape) => shape.style?.color === 'blue')).toBe(true);
    expect(arrows.every((shape) => shape.style?.color === 'grey')).toBe(true);
    expect(arrows.every((shape) => shape.style?.size === 's')).toBe(true);
  });

  it('an explicit request style overrides the role palette', () => {
    const shapes = compileDiagramToDrawShapes(editor as never, {
      layout: 'flow',
      diagram: {
        nodes: [
          { id: 'start', label: 'Start', kind: 'ellipse' },
          { id: 'work', label: 'Process' },
        ],
      },
      placement: { kind: 'rect',...PLACEMENT_BOUNDS },
      style: { color: 'violet' },
    });

    const nodes = shapes.filter((shape) => shape.kind !== 'arrow');
    expect(nodes.every((shape) => shape.style?.color === 'violet')).toBe(true);
  });

  it('default viewport placement steers clear of the open chat panel', () => {
    // Stub chat panel sits at {40, 40, 320, 240}; the viewport is
    // {100, 80, 800, 600}. The largest clear region is right of the chat.
    const shapes = compileDiagramToDrawShapes(editor as never, {
      layout: 'timeline',
      diagram: CAREER_DIAGRAM,
    });

    const chatRightEdge = 40 + 320;
    for (const shape of shapes) {
      if (shape.geometry.kind !== 'rect') continue;
      expect(shape.geometry.x).toBeGreaterThan(chatRightEdge);
    }
  });

  it('progressive step reveals nodes and edges incrementally', () => {
    const step1 = compileDiagramToDrawShapes(editor as never, {
      layout: 'flow',
      diagram: CAREER_DIAGRAM,
      placement: { kind: 'rect',...PLACEMENT_BOUNDS },
      progressive: { step: 1, totalSteps: 4 },
    });
    const step2 = compileDiagramToDrawShapes(editor as never, {
      layout: 'flow',
      diagram: CAREER_DIAGRAM,
      placement: { kind: 'rect',...PLACEMENT_BOUNDS },
      progressive: { step: 2, totalSteps: 4 },
    });

    expect(step1.filter((shape) => shape.kind === 'box')).toHaveLength(1);
    expect(step1.filter((shape) => shape.kind === 'arrow')).toHaveLength(0);
    expect(step2.filter((shape) => shape.kind === 'box')).toHaveLength(2);
    expect(step2.filter((shape) => shape.kind === 'arrow')).toHaveLength(1);
  });

  it('nearPanel placement resolves beside an open panel', () => {
    const shapes = compileDiagramToDrawShapes(editor as never, {
      layout: 'flow',
      diagram: {
        nodes: [{ id: 'only', label: 'Callout diagram' }],
      },
      placement: { kind: 'nearPanel', panelId: 'chat', side: 'right' },
    });
    const box = shapes.find((shape) => shape.kind === 'box');
    expect(box?.geometry.kind).toBe('rect');
    if (box?.geometry.kind !== 'rect') return;
    expect(box.geometry.x).toBeGreaterThanOrEqual(40 + 320 + 32);
  });

  it('nested VPC peering compiles every node and edge from two-level hierarchy', () => {
    const shapes = compileDiagramToDrawShapes(editor as never, {
      layout: 'nested',
      diagram: VPC_PEERING_NESTED_TWO_LEVEL,
      placement: { kind: 'rect',...PLACEMENT_BOUNDS },
    });

    const boxes = shapes.filter((shape) => shape.kind === 'box');
    const arrows = shapes.filter((shape) => shape.kind === 'arrow');

    expect(boxes).toHaveLength(VPC_PEERING_NESTED_TWO_LEVEL.nodes.length);
    expect(boxes.map((shape) => shape.id).sort()).toEqual(
      VPC_PEERING_NESTED_TWO_LEVEL.nodes.map((node) => node.id).sort());
    const containerBoxes = boxes.filter((shape) => {
      const node = VPC_PEERING_NESTED_TWO_LEVEL.nodes.find((entry) => entry.id === shape.id);
      return node?.kind === 'container';
    });
    expect(containerBoxes.length).toBe(4);
    expect(containerBoxes.every((shape) => shape.style?.fill === 'semi')).toBe(true);
    expect(containerBoxes.every((shape) => shape.style?.dash === 'dashed')).toBe(true);
    expect(containerBoxes.every((shape) => shape.style?.size === 'l')).toBe(true);

    expect(arrows).toHaveLength(VPC_PEERING_NESTED_TWO_LEVEL.edges!.length);
  });
});

describe('draw_shapes tool auto-layout routing', () => {
  let editor: ReturnType<typeof makeStubEditor> & {
    createShape: Mock;
    getShape(): Mock;
    getCurrentPageShapes(): Mock;
    deleteShapes: Mock;
  };

  beforeEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    bindEngineCapabilities(makeCapabilities(true));
    const shapes = new Map<string, unknown>();
    editor = {...makeStubEditor,
      getShape: vi.fn((id: string) => shapes.get(id)),
      createShape: vi.fn((shape: { id: string }) => {
        shapes.set(shape.id, shape);
      }),
      deleteShapes: vi.fn(),
      getCurrentPageShapes: vi.fn(() => [...shapes.values()]),
    };
    bindEditor(editor as never);
  });

  afterEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
  });

  it('handler draws a timeline diagram from logical structure', async () => {
    const tool = DRAWING_TOOLS.find((entry) => entry.declaration.name === 'draw_shapes');
    expect(tool).toBeDefined();

    const result = await withAgentToolContextAsync(
      { agentId: 'presenter-1', agentLabel: 'Presenter' }, () =>
        tool!.handler({
          layout: 'timeline',
          diagram: CAREER_DIAGRAM,
          placement: { kind: 'rect',...PLACEMENT_BOUNDS },
        }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const payload = result.result as { createdShapeIds: string[]; layout?: string };
    expect(payload.layout).toBe('timeline');
    expect(payload.createdShapeIds.length).toBeGreaterThanOrEqual(7);
    expect(editor.createShape).toHaveBeenCalled();
  });

  it('rejects mixing diagram auto-layout with explicit shapes', async () => {
    const tool = DRAWING_TOOLS.find((entry) => entry.declaration.name === 'draw_shapes');
    expect(tool).toBeDefined();

    const result = await withAgentToolContextAsync(
      { agentId: 'presenter-1', agentLabel: 'Presenter' }, () =>
        tool!.handler({
          layout: 'flow',
          diagram: CAREER_DIAGRAM,
          shapes: [{ kind: 'box', geometry: { kind: 'rect', x: 0, y: 0, w: 10, h: 10 } }],
        }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('not both');
  });
});

describe('drawAgentDiagram integration ', () => {
  beforeEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    bindEngineCapabilities(makeCapabilities(true));
    const shapes = new Map<string, unknown>();
    const editor = {...makeStubEditor,
      getShape: vi.fn((id: string) => shapes.get(id)),
      createShape: vi.fn((shape: { id: string }) => {
        shapes.set(shape.id, shape);
      }),
      deleteShapes: vi.fn(),
      getCurrentPageShapes: vi.fn(() => [...shapes.values()]),
    };
    bindEditor(editor as never);
  });

  afterEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
  });

  it('returns layout metadata from drawAgentDiagram', () => {
    const result = drawAgentDiagram('agent-diagram', {
      layout: 'radial',
      diagram: RADIAL_DIAGRAM,
      placement: { kind: 'rect',...PLACEMENT_BOUNDS },
      progressive: { step: 2 },
    });
    expect(result.layout).toBe('radial');
    expect(result.progressiveStep).toBe(2);
    expect(result.createdShapeIds.length).toBeGreaterThan(0);
  });

  it('explicit drawAgentShapes path remains unchanged for coordinate batches', () => {
    const result = drawAgentShapes('agent-alpha', [
      { kind: 'box', geometry: { kind: 'rect', x: 10, y: 20, w: 100, h: 50 } },
    ]);
    expect(result.layout).toBeUndefined();
    expect(result.createdShapeIds).toHaveLength(1);
  });
});

/**
 * Regression coverage for the "fixed node size overflows long labels"
 * bug (Apogee Aerospace flagship review, iteration 2 addendum): every node
 * used to be exactly DIAGRAM_NODE_WIDTH x DIAGRAM_NODE_HEIGHT regardless of
 * label length, so a label like "Regional Director" overflowed its box and
 * adjacent nodes in a tight layout could crowd or touch. estimateNodeSize
 * and the three layout modes now fit each node to its own label.
 */
describe('label-fitted node sizing (regression: long labels overflowed a fixed box)', () => {
  it('estimateNodeSize keeps the default footprint for short labels', () => {
    const size = estimateNodeSize('Lead');
    expect(size.w).toBeGreaterThanOrEqual(DIAGRAM_NODE_WIDTH);
    expect(size.h).toBe(DIAGRAM_NODE_HEIGHT);
  });

  it('estimateNodeSize treats slash as a word break for longest-word width', () => {
    const size = estimateNodeSize('Amazon Web Services GCP Cloud');
    expect(size.w).toBeGreaterThan(DIAGRAM_NODE_WIDTH);
  });

  it('estimateNodeSize widens the box for a longer single-line label', () => {
    const short = estimateNodeSize('Lead');
    const longer = estimateNodeSize('Regional Director');
    expect(longer.w).toBeGreaterThan(short.w);
  });

  it('estimateNodeSize wraps and grows height instead of overflowing a very long label', () => {
    const size = estimateNodeSize(
      'Ground station network operations and telemetry relay coordination');
    expect(size.h).toBeGreaterThan(DIAGRAM_NODE_HEIGHT);
  });

  it('flow layout gives long-label nodes a wider box and never lets adjacent boxes touch or overlap', () => {
    const diagram: AgentDiagramStructure = {
      nodes: [
        { id: 'a', label: 'Guest Experience Associate' },
        { id: 'b', label: 'Regional Director' },
        { id: 'c', label: 'Lead' },
      ],
    };
    const layout = layoutDiagramNodes('flow', diagram);
    for (const entry of layout.nodes) {
      const expected = estimateNodeSize(entry.node.label);
      expect(entry.rect.w).toBe(expected.w);
      expect(entry.rect.h).toBe(expected.h);
    }
    for (let i = 0; i < layout.nodes.length - 1; i += 1) {
      const current = layout.nodes[i]!.rect;
      const next = layout.nodes[i + 1]!.rect;
      expect(next.x).toBeGreaterThanOrEqual(current.x + current.w + DIAGRAM_NODE_GAP_X - 0.01);
    }
  });

  it('timeline layout uses one uniform column width and never lets rows touch or overlap vertically', () => {
    const diagram: AgentDiagramStructure = {
      nodes: [
        { id: 'a', label: 'Guest Experience Associate' },
        { id: 'b', label: 'Lead' },
        { id: 'c', label: 'Island Operations Manager' },
      ],
    };
    const layout = layoutDiagramNodes('timeline', diagram);
    const widths = new Set(layout.nodes.map((entry) => entry.rect.w));
    expect(widths.size).toBe(1);
    for (let i = 0; i < layout.nodes.length - 1; i += 1) {
      const current = layout.nodes[i]!.rect;
      const next = layout.nodes[i + 1]!.rect;
      expect(next.y).toBeGreaterThanOrEqual(current.y + current.h + DIAGRAM_NODE_GAP_Y - 0.01);
    }
  });

  it('radial layout pushes the orbit radius out for longer labels so orbit nodes never overlap', () => {
    const diagram: AgentDiagramStructure = {
      nodes: [
        { id: 'hub', label: 'Coral Bay HQ' },
        { id: 'n1', label: 'Azure Atoll Regional Operations Center' },
        { id: 'n2', label: 'Sunreach Isle' },
        { id: 'n3', label: 'Mistral Key' },
        { id: 'n4', label: 'Ember Lagoon' },
      ],
    };
    const layout = layoutDiagramNodes('radial', diagram);
    const orbitRects = layout.nodes.slice(1).map((entry) => entry.rect);

    function intersects(a: LayoutRectLike, b: LayoutRectLike): boolean {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }
    for (let i = 0; i < orbitRects.length; i += 1) {
      for (let j = i + 1; j < orbitRects.length; j += 1) {
        expect(intersects(orbitRects[i]!, orbitRects[j]!)).toBe(false);
      }
    }
  });
});

interface LayoutRectLike {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Iteration 5 regression coverage (owner screenshots): labeled edges packed
 * into the default flow gap made tldraw wrap the label pill mid-word over
 * the boxes ("IMU/G PS Data"); skip edges drew a straight line through the
 * boxes between their endpoints; arrange spaced real shapes by guessed
 * default sizes.
 */
describe('edge-label-aware gaps and skip-edge arcs (iteration 5)', () => {
  const LABELED_FLOW: AgentDiagramStructure = {
    nodes: [
      { id: 'sensors', label: 'Sensor Suite (IMU/GPS)' },
      { id: 'flight', label: 'AeroCore-9 Flight Comp' },
      { id: 'gnc', label: 'GNC Flight Software' },
    ],
    edges: [
      { from: 'sensors', to: 'flight', label: 'IMU/GPS Data' },
      { from: 'flight', to: 'gnc', label: 'Executes' },
    ],
  };

  it('flow widens each labeled gap to fit its label pill', () => {
    const layout = layoutDiagramNodes('flow', LABELED_FLOW);
    const [a, b, c] = layout.nodes.map((entry) => entry.rect);
    const firstGap = b!.x - (a!.x + a!.w);
    const secondGap = c!.x - (b!.x + b!.w);
    expect(firstGap).toBeGreaterThanOrEqual(edgeLabelFlowGap('IMU/GPS Data') - 0.01);
    expect(firstGap).toBeGreaterThan(DIAGRAM_NODE_GAP_X);
    expect(secondGap).toBeGreaterThanOrEqual(edgeLabelFlowGap('Executes') - 0.01);
  });

  it('flow keeps unlabeled gaps at the default', () => {
    const layout = layoutDiagramNodes('flow', {
      nodes: [
        { id: 'a', label: 'One' },
        { id: 'b', label: 'Two' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    });
    const [a, b] = layout.nodes.map((entry) => entry.rect);
    expect(b!.x - (a!.x + a!.w)).toBe(DIAGRAM_NODE_GAP_X);
  });

  it('timeline widens a labeled gap for the pill longest word and wrapped height', () => {
    const layout = layoutDiagramNodes('timeline', {
      nodes: [
        { id: 'a', label: 'Uplink' },
        { id: 'b', label: 'Relay' },
      ],
      edges: [{ from: 'a', to: 'b', label: 'Telemetry Packet' }],
    });
    const [top, bottom] = layout.nodes.map((entry) => entry.rect);
    const gap = bottom!.y - (top!.y + top!.h);
    expect(gap).toBeGreaterThanOrEqual(edgeLabelTimelineGap('Telemetry Packet') - 0.01);
    expect(gap).toBeGreaterThan(DIAGRAM_NODE_GAP_Y);
  });

  it('radial pushes the ring out so labeled spokes have open run for their pill', () => {
    const diagram: AgentDiagramStructure = {
      nodes: [
        { id: 'hub', label: 'Mission Control' },
        { id: 'n1', label: 'Ground A' },
        { id: 'n2', label: 'Ground B' },
        { id: 'n3', label: 'Ground C' },
      ],
      edges: [
        { from: 'hub', to: 'n1', label: 'Telemetry downlink' },
        { from: 'hub', to: 'n2', label: 'Command uplink' },
        { from: 'hub', to: 'n3' },
      ],
    };
    const layout = layoutDiagramNodes('radial', diagram);
    const hub = layout.nodes[0]!.rect;
    const orbits = layout.nodes.slice(1).map((entry) => entry.rect);
    const hubHalf = Math.max(hub.w, hub.h) / 2;
    const orbitHalf = orbits.reduce((max, rect) => Math.max(max, rect.w, rect.h), 0) / 2;
    const spokeLabelSpan = edgeLabelFlowGap('Telemetry downlink');
    for (const orbit of orbits) {
      const radius = Math.hypot(orbit.x + orbit.w / 2, orbit.y + orbit.h / 2);
      expect(radius).toBeGreaterThanOrEqual(hubHalf + orbitHalf + spokeLabelSpan - 0.01);
    }
  });

  it('measure override sizes the layout by real bounds instead of label estimates', () => {
    const layout = layoutDiagramNodes('flow', CAREER_DIAGRAM, () => ({ w: 300, h: 120 }));
    for (const entry of layout.nodes) {
      expect(entry.rect.w).toBe(300);
      expect(entry.rect.h).toBe(120);
    }
  });

  it('a skip edge arcs over the boxes between its endpoints instead of cutting through them', () => {
    const editor = makeStubEditor();
    const shapes = compileDiagramToDrawShapes(editor as never, {
      layout: 'flow',
      diagram: {
        nodes: [
          { id: 'a', label: 'Ingest' },
          { id: 'b', label: 'Transform' },
          { id: 'c', label: 'Publish' },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c' },
          { from: 'a', to: 'c' },
        ],
      },
      placement: { kind: 'rect',...PLACEMENT_BOUNDS },
    });

    const arrows = shapes.filter((shape) => shape.kind === 'arrow');
    expect(arrows).toHaveLength(3);
    const middle = shapes.find((shape) => shape.id === 'b')!.geometry as { h: number };
    const skip = arrows.find(
      (shape) =>
        shape.meta?.[AGENT_EDGE_FROM_META_KEY] === 'a' &&
        shape.meta?.[AGENT_EDGE_TO_META_KEY] === 'c');
    expect(skip).toBeDefined();
    // Negative bend arcs a left-to-right edge upward, clear of the middle
    // box; the magnitude must exceed the box's half height.
    expect(skip!.bend).toBeDefined();
    expect(skip!.bend!).toBeLessThan(0);
    expect(Math.abs(skip!.bend!)).toBeGreaterThan(middle.h / 2);
    const adjacent = arrows.filter((shape) => shape !== skip);
    expect(adjacent.every((shape) => shape.bend === undefined)).toBe(true);
  });

  it('diagram edge arrows carry endpoint and label meta so arrange can move them with their nodes', () => {
    const editor = makeStubEditor();
    const shapes = compileDiagramToDrawShapes(editor as never, {
      layout: 'flow',
      diagram: LABELED_FLOW,
      placement: { kind: 'rect',...PLACEMENT_BOUNDS },
    });
    const arrows = shapes.filter((shape) => shape.kind === 'arrow');
    expect(arrows).toHaveLength(2);
    const first = arrows[0]!;
    expect(first.meta?.[AGENT_EDGE_FROM_META_KEY]).toBe('sensors');
    expect(first.meta?.[AGENT_EDGE_TO_META_KEY]).toBe('flight');
    expect(first.meta?.[AGENT_EDGE_LABEL_META_KEY]).toBe('IMU/GPS Data');
  });

  it('edge labels render as fixed-width text beside the arrow, never as a pill', () => {
    // Regression (owner screenshot): pill labels wrap to the arrow's
    // length, so any move that shortens the arrow re-breaks the label
    // mid-word ("downli nk").
    const editor = makeStubEditor();
    const shapes = compileDiagramToDrawShapes(editor as never, {
      layout: 'flow',
      diagram: LABELED_FLOW,
      placement: { kind: 'rect',...PLACEMENT_BOUNDS },
    });
    const arrows = shapes.filter((shape) => shape.kind === 'arrow');
    // No pill text on the arrows themselves.
    expect(arrows.every((shape) => shape.text === undefined)).toBe(true);

    const labels = shapes.filter(
      (shape) =>
        shape.kind === 'text' && shape.meta?.[AGENT_EDGE_LABEL_TEXT_META_KEY] === '1');
    expect(labels).toHaveLength(2);
    const label = labels.find((shape) => shape.text === 'IMU/GPS Data')!;
    expect(label).toBeDefined();
    expect(label.meta?.[AGENT_EDGE_FROM_META_KEY]).toBe('sensors');
    expect(label.meta?.[AGENT_EDGE_TO_META_KEY]).toBe('flight');
    expect(label.geometry.kind).toBe('text');
    if (label.geometry.kind !== 'text') return;
    // Fixed width sized to the whole label so it never wraps mid-word.
    expect(label.geometry.maxWidth).toBeGreaterThanOrEqual(
      edgeLabelTextWidth('IMU/GPS Data') - 0.01);
    // The label sits beside its arrow: centered on the gap between the
    // two nodes, offset off the line.
    const arrow = arrows[0]!.geometry as {
      from: { x: number; y: number };
      to: { x: number; y: number };
    };
    const midX = (arrow.from.x + arrow.to.x) / 2;
    const labelCenterX = label.geometry.x + edgeLabelTextWidth('IMU/GPS Data') / 2;
    expect(Math.abs(labelCenterX - midX)).toBeLessThan(8);
    const midY = (arrow.from.y + arrow.to.y) / 2;
    expect(label.geometry.y).toBeLessThan(midY);
  });
});
