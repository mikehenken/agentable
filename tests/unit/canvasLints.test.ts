/**
 * See-and-fix loop lints: deterministic layout checks the chat client feeds
 * back to the model after each drawing round (Apogee flagship, iteration 3).
 */
import { describe, expect, it } from 'vitest';
import {
  computeCanvasLints,
  readShapeGraph,
  suggestFreeRegion,
} from '../../src/chat/canvasLints';
import type {
  CanvasShapeGraph,
  CanvasShapeGraphNode,
} from '../../src/engine/canvasPerceptionTypes';

const AGENT = 'agentable-chat-agent';

function boxNode(
  id: string,
  rect: { x: number; y: number; w: number; h: number },
  overrides: Partial<CanvasShapeGraphNode> = {}): CanvasShapeGraphNode {
  return {
    id,
    nativeType: 'geo',
    kind: 'box',
    geometry: { kind: 'rect',...rect },
    parentId: null,
    zOrder: 0,
    agentId: AGENT,...overrides,
  };
}

function graphWith(
  shapes: CanvasShapeGraphNode[],
  region = { x: 0, y: 0, w: 1000, h: 700 }): CanvasShapeGraph {
  return { region, shapes };
}

describe('computeCanvasLints', () => {
  it('returns no lints for a clean, spaced layout', () => {
    const graph = graphWith([
      boxNode('a', { x: 50, y: 50, w: 200, h: 100 }, { text: 'Start' }),
      boxNode('b', { x: 350, y: 50, w: 200, h: 100 }, { text: 'Process' }),
    ]);
    expect(computeCanvasLints(graph, { agentId: AGENT })).toEqual([]);
  });

  it('reports partially overlapping shapes by their labels', () => {
    const graph = graphWith([
      boxNode('a', { x: 50, y: 50, w: 200, h: 100 }, { text: 'Flight Computer' }),
      boxNode('b', { x: 180, y: 90, w: 200, h: 100 }, { text: 'Telemetry' }),
    ]);
    const lints = computeCanvasLints(graph, { agentId: AGENT });
    expect(lints).toHaveLength(1);
    expect(lints[0]).toContain('"Flight Computer"');
    expect(lints[0]).toContain('"Telemetry"');
    expect(lints[0]).toContain('overlap');
  });

  it('allows full containment (a container box holding smaller boxes)', () => {
    const graph = graphWith([
      boxNode('outer', { x: 0, y: 0, w: 600, h: 400 }, { text: 'AWS Region' }),
      boxNode('inner', { x: 50, y: 50, w: 200, h: 100 }, { text: 'Lambda' }),
    ]);
    expect(computeCanvasLints(graph, { agentId: AGENT })).toEqual([]);
  });

  it('flags agent shapes sitting under an open panel and names the clear space', () => {
    const chatPanel: CanvasShapeGraphNode = {
      id: 'panel-1',
      nativeType: 'panel',
      kind: 'panel',
      geometry: { kind: 'panel', x: 600, y: 0, w: 360, h: 700 },
      parentId: null,
      zOrder: 10,
      panel: { panelId: 'chat', minimized: false },
    };
    const graph = graphWith([
      chatPanel,
      boxNode('a', { x: 700, y: 100, w: 200, h: 100 }, { text: 'Hidden Step' }),
    ]);
    const lints = computeCanvasLints(graph, { agentId: AGENT });
    expect(lints).toHaveLength(2);
    expect(lints[0]).toContain('"chat" panel');
    expect(lints[0]).toContain('"Hidden Step"');
     // The follow-up line hands the model page coordinates it can redraw
     // into, so one fix converges instead of guessing where the chat is.
    expect(lints[1]).toContain('Clear canvas space');
    expect(lints[1]).toMatch(/x \d+ to \d+/);
  });

  it('flags measured text sitting under an open panel', () => {
    const chatPanel: CanvasShapeGraphNode = {
      id: 'panel-1',
      nativeType: 'panel',
      kind: 'panel',
      geometry: { kind: 'panel', x: 600, y: 0, w: 360, h: 700 },
      parentId: null,
      zOrder: 10,
      panel: { panelId: 'chat', minimized: false },
    };
    const title: CanvasShapeGraphNode = {
      id: 't1',
      nativeType: 'text',
      kind: 'text',
      geometry: { kind: 'text', x: 620, y: 40, w: 300, h: 40 },
      text: 'Quarterly Signups',
      parentId: null,
      zOrder: 1,
      agentId: AGENT,
    };
    const lints = computeCanvasLints(graphWith([chatPanel, title]), { agentId: AGENT });
    expect(lints.length).toBeGreaterThanOrEqual(1);
    expect(lints[0]).toContain('"Quarterly Signups"');
    expect(lints[0]).toContain('panel');
  });

  it('skips unmeasured text (no w/h) without crashing', () => {
    const chatPanel: CanvasShapeGraphNode = {
      id: 'panel-1',
      nativeType: 'panel',
      kind: 'panel',
      geometry: { kind: 'panel', x: 600, y: 0, w: 360, h: 700 },
      parentId: null,
      zOrder: 10,
      panel: { panelId: 'chat', minimized: false },
    };
    const floating: CanvasShapeGraphNode = {
      id: 't2',
      nativeType: 'text',
      kind: 'text',
      geometry: { kind: 'text', x: 620, y: 40 },
      text: 'No extents',
      parentId: null,
      zOrder: 1,
      agentId: AGENT,
    };
    expect(computeCanvasLints(graphWith([chatPanel, floating]), { agentId: AGENT })).toEqual([]);
  });

  it('ignores shapes under a panel when they belong to another agent', () => {
    const chatPanel: CanvasShapeGraphNode = {
      id: 'panel-1',
      nativeType: 'panel',
      kind: 'panel',
      geometry: { kind: 'panel', x: 600, y: 0, w: 360, h: 700 },
      parentId: null,
      zOrder: 10,
      panel: { panelId: 'chat', minimized: false },
    };
    const graph = graphWith([
      chatPanel,
      boxNode('a', { x: 700, y: 100, w: 200, h: 100 }, { agentId: 'someone-else' }),
    ]);
    expect(computeCanvasLints(graph, { agentId: AGENT })).toEqual([]);
  });

  it('flags shapes cut off by the edge of the view', () => {
    const graph = graphWith([
      boxNode('a', { x: 900, y: 50, w: 300, h: 100 }, { text: 'Runs Off Screen' }),
    ]);
    const lints = computeCanvasLints(graph, { agentId: AGENT });
    expect(lints).toHaveLength(1);
    expect(lints[0]).toContain('extend past the visible view');
    expect(lints[0]).toContain('"Runs Off Screen"');
  });

  it('flags shapes butted edge-to-edge with no breathing room', () => {
    const graph = graphWith([
      boxNode('a', { x: 0, y: 0, w: 150, h: 80 }, { text: 'AWS Compute' }),
      boxNode('b', { x: 150, y: 0, w: 150, h: 80 }, { text: 'Azure Compute' }),
    ]);
    const lints = computeCanvasLints(graph, { agentId: AGENT });
    expect(lints).toHaveLength(1);
    expect(lints[0]).toContain('touch');
    expect(lints[0]).toContain('"AWS Compute"');
  });

  it('nudges toward arrows when a multi-node sketch has no connectors', () => {
    const graph = graphWith([
      boxNode('a', { x: 0, y: 0, w: 150, h: 80 }),
      boxNode('b', { x: 250, y: 0, w: 150, h: 80 }),
      boxNode('c', { x: 500, y: 0, w: 150, h: 80 }),
    ]);
    const lints = computeCanvasLints(graph, { agentId: AGENT });
    expect(lints).toHaveLength(1);
    expect(lints[0]).toContain('no connecting arrows');
  });

  it('does not nudge for arrows when a connector exists', () => {
    const arrow: CanvasShapeGraphNode = {
      id: 'ar1',
      nativeType: 'arrow',
      kind: 'arrow',
      geometry: { kind: 'segment', from: { x: 150, y: 40 }, to: { x: 250, y: 40 } },
      parentId: null,
      zOrder: 5,
      agentId: AGENT,
    };
    const graph = graphWith([
      boxNode('a', { x: 0, y: 0, w: 150, h: 80 }),
      boxNode('b', { x: 250, y: 0, w: 150, h: 80 }),
      boxNode('c', { x: 500, y: 0, w: 150, h: 80 }),
      arrow,
    ]);
    expect(computeCanvasLints(graph, { agentId: AGENT })).toEqual([]);
  });

  it('caps reported overlap pairs and summarizes the rest', () => {
     // Six boxes stacked on the same spot: 15 overlapping pairs.
    const shapes = Array.from({ length: 6 }, (_, index) =>
      boxNode(`s${index}`, { x: 10 * index, y: 5 * index, w: 200, h: 100 }));
    const lints = computeCanvasLints(graphWith(shapes), { agentId: AGENT });
    const summary = lints.find((lint) => lint.includes('more shape pairs'));
    expect(summary).toBeDefined();
    expect(lints.length).toBeLessThanOrEqual(6);
  });
});

describe('suggestFreeRegion', () => {
  it('returns the largest area beside a docked panel', () => {
     // Chat docked on the left third of a 1200x700 view: free space is right.
    const chatPanel: CanvasShapeGraphNode = {
      id: 'panel-1',
      nativeType: 'panel',
      kind: 'panel',
      geometry: { kind: 'panel', x: 0, y: 0, w: 400, h: 700 },
      parentId: null,
      zOrder: 10,
      panel: { panelId: 'chat', minimized: false },
    };
    const region = { x: 0, y: 0, w: 1200, h: 700 };
    const free = suggestFreeRegion(graphWith([chatPanel], region));
    expect(free).not.toBeNull();
    expect(free!.x).toBeGreaterThanOrEqual(400);
    expect(free!.x + free!.w).toBeLessThanOrEqual(1200);
  });

  it('returns the inset view when no panel is open', () => {
    const region = { x: 100, y: 100, w: 1000, h: 700 };
    const free = suggestFreeRegion(graphWith([], region));
    expect(free).not.toBeNull();
    expect(free!.x).toBeGreaterThan(100);
    expect(free!.w).toBeLessThan(1000);
  });
});

describe('readShapeGraph', () => {
  it('accepts a structurally valid graph payload', () => {
    const graph = graphWith([boxNode('a', { x: 0, y: 0, w: 10, h: 10 })]);
    expect(readShapeGraph(graph)).not.toBeNull();
  });

  it('rejects payloads missing shapes or region', () => {
    expect(readShapeGraph(null)).toBeNull();
    expect(readShapeGraph({})).toBeNull();
    expect(readShapeGraph({ shapes: [] })).toBeNull();
    expect(readShapeGraph({ region: { x: 0, y: 0, w: 1, h: 1 } })).toBeNull();
  });
});
