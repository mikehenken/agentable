/**
 * Iteration 6 regression coverage (owner screenshots): a redrawn dashboard
 * landed straight on top of the previous one, and section-header text
 * shapes collided with each other because the model guesses rendered
 * widths short. Placement hygiene now relocates overlapping compositions
 * into clear space and nudges colliding batch text apart, deterministically
 * and before anything is created.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShapeId, toRichText } from 'tldraw';
import type { AgentDrawShapeInput } from '../../src/engine/agentDrawingTypes';
import {
  AGENT_EDGE_FROM_META_KEY,
  AGENT_EDGE_LABEL_TEXT_META_KEY,
  AGENT_EDGE_TO_META_KEY,
  AGENT_SHAPE_PROVENANCE_META_KEY,
} from '../../src/engine/agentDrawingTypes';
import {
  batchBounds,
  estimateInputRect,
  relocationOffset,
  resolveTextCollisions,
  resolveUnderlineAccents,
  translateInput,
} from '../../src/engines/tldraw/agentDrawing/batchPlacement';
import { drawAgentShapes } from '../../src/engines/tldraw/agentDrawing/agentDrawingApi';
import {
  bindEditor,
  __resetPanelShapeApiForTests__,
} from '../../src/engines/tldraw/shapes/panelShapeApi';
import {
  bindEngineCapabilities,
  resetEngineCapabilitiesForTests,
} from '../../src/agents/engineBridge';
import type { EngineCapabilities } from '../../src/engine/types';

function box(x: number, y: number, w = 100, h = 60): AgentDrawShapeInput {
  return { kind: 'box', geometry: { kind: 'rect', x, y, w, h } };
}

function text(content: string, x: number, y: number): AgentDrawShapeInput {
  return { kind: 'text', text: content, geometry: { kind: 'text', x, y } };
}

describe('batchPlacement pure helpers', () => {
  it('estimates standalone text extents from character count', () => {
    const rect = estimateInputRect(text('TRAJECTORY PROFILE', 100, 50));
    expect(rect).not.toBeNull();
    // 18 chars * 15 px + padding: wide enough that a neighbor placed 120px
    // to the right is a detected collision.
    expect(rect!.w).toBeGreaterThan(250);
    expect(rect!.x).toBe(100);
  });

  it('relocationOffset returns null when the batch sits in the clear', () => {
    const batch = { x: 1000, y: 0, w: 300, h: 200 };
    expect(relocationOffset(batch, [{ x: 0, y: 0, w: 400, h: 300 }])).toBeNull();
  });

  it('relocationOffset ignores incidental sub-threshold overlap', () => {
    // Batch 400x400, obstacle clips one corner 60x60 (2.25% of the area).
    const batch = { x: 0, y: 0, w: 400, h: 400 };
    expect(relocationOffset(batch, [{ x: -340, y: -340, w: 400, h: 400 }])).toBeNull();
  });

  it('relocationOffset moves a swamped batch to the nearest clear side', () => {
    const batch = { x: 50, y: 40, w: 300, h: 200 };
    const obstacle = { x: 0, y: 0, w: 400, h: 300 };
    const offset = relocationOffset(batch, [obstacle]);
    expect(offset).not.toBeNull();
    const moved = {...batch, x: batch.x + offset!.dx, y: batch.y + offset!.dy };
    const w = Math.min(moved.x + moved.w, obstacle.x + obstacle.w) - Math.max(moved.x, obstacle.x);
    const h = Math.min(moved.y + moved.h, obstacle.y + obstacle.h) - Math.max(moved.y, obstacle.y);
    expect(w <= 0 || h <= 0).toBe(true);
  });

  it('translateInput shifts every geometry kind and preserves structure', () => {
    const arrow: AgentDrawShapeInput = {
      kind: 'arrow',
      geometry: { kind: 'segment', from: { x: 0, y: 0 }, to: { x: 10, y: 5 } },
    };
    const moved = translateInput(arrow, 100, 50);
    expect(moved.geometry).toEqual({
      kind: 'segment',
      from: { x: 100, y: 50 },
      to: { x: 110, y: 55 },
    });
    const movedBox = translateInput(box(5, 6), -5, -6);
    expect(movedBox.geometry).toEqual({ kind: 'rect', x: 0, y: 0, w: 100, h: 60 });
  });

  it('batchBounds unions every input estimate', () => {
    const bounds = batchBounds([box(0, 0), box(300, 200)]);
    expect(bounds).toEqual({ x: 0, y: 0, w: 400, h: 260 });
  });

  it('resolveTextCollisions nudges the later of two colliding headers apart', () => {
    // Two section headers on one row, second placed inside the first's
    // rendered width (the "TRAJECTORY PROFILETELEMETRY & COMMS" defect).
    const inputs = [text('TRAJECTORY PROFILE', 0, 0), text('TELEMETRY & COMMS', 150, 0)];
    const resolved = resolveTextCollisions(inputs);
    const first = estimateInputRect(resolved[0]!)!;
    const second = estimateInputRect(resolved[1]!)!;
    const w = Math.min(first.x + first.w, second.x + second.w) - Math.max(first.x, second.x);
    const h = Math.min(first.y + first.h, second.y + second.h) - Math.max(first.y, second.y);
    expect(w <= 0 || h <= 0).toBe(true);
    // The first header never moves.
    expect(resolved[0]!.geometry).toEqual(inputs[0]!.geometry);
  });

  it('resolveTextCollisions leaves separated text and non-text inputs alone', () => {
    const inputs = [text('THRUST', 0, 0), text('FUEL', 0, 200), box(0, 50)];
    const resolved = resolveTextCollisions(inputs);
    expect(resolved).toEqual(inputs);
  });

  it('resolveUnderlineAccents drops a flat stroke below the title it crosses', () => {
    // The "Zephyr-9" strikethrough: an xl title at y=40 renders ~56px tall,
    // but the model drew its underline at y=75, through the glyphs.
    const title: AgentDrawShapeInput = {
      kind: 'text',
      text: 'Zephyr-9 Dashboard',
      style: { size: 'xl' },
      geometry: { kind: 'text', x: 1240, y: 40 },
    };
    const underline: AgentDrawShapeInput = {
      kind: 'freehand',
      geometry: {
        kind: 'points',
        points: [
          { x: 1240, y: 75 },
          { x: 1340, y: 77 },
          { x: 1440, y: 75 },
        ],
      },
    };
    const resolved = resolveUnderlineAccents([title, underline]);
    const moved = resolved[1]!;
    expect(moved.geometry.kind).toBe('points');
    const ys = (moved.geometry as { points: Array<{ y: number }> }).points.map((p) => p.y);
    // Below the xl title's estimated bottom edge (40 + 56).
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(96);
    // The title itself never moves.
    expect(resolved[0]).toEqual(title);
  });

  it('resolveUnderlineAccents leaves tall strokes (emphasis circles) alone', () => {
    const label = text('MANUAL ABORT', 0, 0);
    const circle: AgentDrawShapeInput = {
      kind: 'freehand',
      geometry: {
        kind: 'points',
        points: [
          { x: -10, y: -10 },
          { x: 120, y: -20 },
          { x: 140, y: 40 },
          { x: -20, y: 50 },
          { x: -10, y: -10 },
        ],
      },
    };
    const resolved = resolveUnderlineAccents([label, circle]);
    expect(resolved[1]).toEqual(circle);
  });
});

interface StubShape {
  id: string;
  typeName: 'shape';
  type: string;
  x: number;
  y: number;
  index: string;
  meta: Record<string, unknown>;
  props: Record<string, unknown>;
}

function makeCapabilities(): EngineCapabilities {
  return { frames: true, draw: true, minimap: true, infinitePan: true, nativeSnapshots: true };
}

describe('drawAgentShapes placement hygiene wiring', () => {
  let shapes: Map<string, StubShape>;

  beforeEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    bindEngineCapabilities(makeCapabilities());
    shapes = new Map();
    const editor = {
      getShape: vi.fn((id: string) => shapes.get(String(id))),
      getCurrentPageId: () => 'page:page',
      createShape: vi.fn((shape: Omit<StubShape, 'typeName' | 'index'> & { parentId?: string }) => {
        shapes.set(String(shape.id), {...shape,
          id: String(shape.id),
          typeName: 'shape',
          // Real tldraw defaults parentId to the current page when omitted.
          parentId: shape.parentId ?? 'page:page',
          index: `a${shapes.size + 1}`,
          meta: shape.meta ?? {},
          props: shape.props ?? {},
        });
      }),
      deleteShapes: vi.fn((ids: readonly string[]) => {
        for (const id of ids) shapes.delete(String(id));
      }),
      getShapePageBounds: vi.fn((id: string) => {
        const shape = shapes.get(String(id));
        if (!shape) return null;
        return {
          x: shape.x,
          y: shape.y,
          w: (shape.props.w as number | undefined) ?? 100,
          h: (shape.props.h as number | undefined) ?? 60,
        };
      }),
      getCurrentPageShapes: vi.fn(() => [...shapes.values()]),
      getViewportPageBounds: vi.fn(() => ({ x: 0, y: 0, w: 1200, h: 800 })),
      updateShapes: vi.fn(
        (
          updates: Array<{
            id: string;
            props?: Record<string, unknown>;
            x?: number;
            y?: number;
          }>) => {
          for (const update of updates) {
            const shape = shapes.get(String(update.id));
            if (!shape) continue;
            if (update.props !== undefined) shape.props = {...shape.props,...update.props };
            if (update.x !== undefined) shape.x = update.x;
            if (update.y !== undefined) shape.y = update.y;
          }
        }),
    };
    bindEditor(editor as never);
  });

  afterEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
  });

  function addExistingAgentBox(x: number, y: number, w: number, h: number): void {
    const id = String(createShapeId(`existing-${shapes.size}`));
    shapes.set(id, {
      id,
      typeName: 'shape',
      type: 'geo',
      x,
      y,
      index: 'a0',
      meta: { [AGENT_SHAPE_PROVENANCE_META_KEY]: 'earlier-agent' },
      props: { w, h },
    });
  }

  it('relocates a new composition that lands on an existing drawing', () => {
    addExistingAgentBox(0, 0, 500, 400);
    const result = drawAgentShapes('agent-now', [box(50, 50), box(200, 50), box(350, 50)]);
    expect(result.createdShapeIds).toHaveLength(3);
    expect(result.placementNote).toContain('moved');
    for (const id of result.createdShapeIds) {
      const created = shapes.get(id)!;
      const rect = {
        x: created.x,
        y: created.y,
        w: created.props.w as number,
        h: created.props.h as number,
      };
      const w = Math.min(rect.x + rect.w, 500) - Math.max(rect.x, 0);
      const h = Math.min(rect.y + rect.h, 400) - Math.max(rect.y, 0);
      expect(w <= 0 || h <= 0).toBe(true);
    }
  });

  it('widens an ellipse for its longest word (labels inscribe at ~70% of ellipse width)', () => {
    // Regression (owner screenshot): "Inertial Nav" in a 100px ellipse
    // rendered as "Inertia l Nav".
    const result = drawAgentShapes('agent-now', [
      {
        kind: 'ellipse',
        text: 'Inertial Nav',
        geometry: { kind: 'rect', x: 0, y: 0, w: 100, h: 60 },
      },
    ]);
    const created = shapes.get(result.createdShapeIds[0]!)!;
    // "Inertial" at the stepped-down small label size, widened by the
    // ellipse inscription factor: 8 chars * 11px * 1.4 + padding.
    expect(created.props.w as number).toBeGreaterThanOrEqual(8 * 11 * 1.4 + 32 - 0.01);
  });

  it('does not move a batch on an empty canvas', () => {
    const result = drawAgentShapes('agent-now', [box(50, 50), box(200, 50), box(350, 50)]);
    expect(result.placementNote).toBeUndefined();
    const first = shapes.get(result.createdShapeIds[0]!)!;
    expect(first.x).toBe(50);
    expect(first.y).toBe(50);
  });

  it('redrawing an existing id moves the shape instead of being silently dropped', () => {
    // Observed live: the model repositions a layout by re-issuing
    // draw_shapes with the same ids. Duplicate creates were swallowed by
    // the per-shape catch, so the "move" did nothing predictable.
    drawAgentShapes('agent-now', [{...box(0, 0), id: 'move-me' }]);
    const shapeId = String(createShapeId('move-me'));
    expect(shapes.get(shapeId)!.x).toBe(0);

    const result = drawAgentShapes('agent-now', [{...box(600, 300, 140, 70), id: 'move-me' }]);
    expect(result.createdShapeIds).toContain(shapeId);
    const moved = shapes.get(shapeId)!;
    expect(moved.x).toBe(600);
    expect(moved.y).toBe(300);
    expect(moved.props.w).toBe(140);
    expect(moved.props.h).toBe(70);
  });

  it('normalizes model style tokens before shapes reach the editor', () => {
    // Live crash regression: "lightBlue" hit tldraw's store validator and
    // took down the entire canvas, not just the one shape.
    const result = drawAgentShapes('agent-now', [
      {...box(0, 0),
        style: { color: 'lightBlue' },
      },
    ]);
    const created = shapes.get(result.createdShapeIds[0]!)!;
    expect(created.props.color).toBe('light-blue');
  });

  it('redrawing a text id carries new wording, not just the new position', () => {
    // Observed live: the model repositioned its title and shortened it to
    // "Zephyr-9 Dash" in the same redraw, but the canvas kept rendering the
    // original longer string because the upsert only moved the shape.
    drawAgentShapes('agent-now', [
      {...text('Zephyr-9 Dashboard', 0, 0), id: 'title' },
    ]);
    const shapeId = String(createShapeId('title'));
    drawAgentShapes('agent-now', [{...text('Zephyr-9 Dash', 600, 40), id: 'title' }]);
    const updated = shapes.get(shapeId)!;
    expect(updated.x).toBe(600);
    expect(updated.y).toBe(40);
    expect(updated.props.richText).toEqual(toRichText('Zephyr-9 Dash'));
  });

  it('createFreehandShape honors geometry.closed for filled silhouettes', () => {
    drawAgentShapes('agent-now', [
      {
        kind: 'freehand',
        id: 'heart-closed',
        geometry: {
          kind: 'points',
          closed: true,
          points: [
            { x: 100, y: 100 },
            { x: 200, y: 100 },
            { x: 150, y: 200 },
          ],
        },
        style: { fill: 'solid', color: 'light-red', size: 'm' },
      },
    ]);
    const shapeId = String(createShapeId('heart-closed'));
    const created = shapes.get(shapeId)!;
    expect(created.type).toBe('draw');
    expect(created.props.isClosed).toBe(true);
    expect(created.props.fill).toBe('solid');
  });

  it('redrawing a freehand id replaces the stroke instead of keeping the stale one', () => {
    // Observed live: the model moved a dashboard by redrawing every id, but
    // the freehand accent circle stayed at its old spot because points
    // redraws were a silent no-op, leaving an orphaned mark on the canvas.
    const stroke = (x: number, y: number) => ({
      kind: 'freehand' as const,
      id: 'accent-circle',
      geometry: {
        kind: 'points' as const,
        points: [
          { x, y },
          { x: x + 40, y: y + 10 },
          { x: x + 80, y },
        ],
      },
    });
    drawAgentShapes('agent-now', [stroke(0, 0)]);
    const shapeId = String(createShapeId('accent-circle'));
    const before = shapes.get(shapeId)!;
    expect(before.x).toBe(0);

    const result = drawAgentShapes('agent-now', [stroke(600, 300)]);
    expect(result.createdShapeIds).toContain(shapeId);
    const after = shapes.get(shapeId)!;
    expect(after.x).toBe(600);
    expect(after.y).toBe(300);
    // Replaced, not duplicated: exactly one shape carries this id.
    expect([...shapes.values()].filter((s) => s.id === shapeId)).toHaveLength(1);
  });

  it('moving a node by redraw re-clips its edge arrows to the new borders', () => {
    drawAgentShapes('agent-now', [
      {...box(0, 0, 120, 60), id: 'node-a' },
      {...box(400, 0, 120, 60), id: 'node-b' },
    ]);
    const arrowId = String(createShapeId('edge-ab'));
    shapes.set(arrowId, {
      id: arrowId,
      typeName: 'shape',
      type: 'arrow',
      x: 126,
      y: 30,
      index: 'a8',
      meta: {
        [AGENT_SHAPE_PROVENANCE_META_KEY]: 'agent-now',
        [AGENT_EDGE_FROM_META_KEY]: 'node-a',
        [AGENT_EDGE_TO_META_KEY]: 'node-b',
      },
      props: { start: { x: 0, y: 0 }, end: { x: 268, y: 0 } },
    });
    const labelId = String(createShapeId('edge-ab-label'));
    shapes.set(labelId, {
      id: labelId,
      typeName: 'shape',
      type: 'text',
      x: 220,
      y: 4,
      index: 'a9',
      meta: {
        [AGENT_SHAPE_PROVENANCE_META_KEY]: 'agent-now',
        [AGENT_EDGE_FROM_META_KEY]: 'node-a',
        [AGENT_EDGE_TO_META_KEY]: 'node-b',
        [AGENT_EDGE_LABEL_TEXT_META_KEY]: '1',
      },
      props: { w: 100, h: 26 },
    });

    drawAgentShapes('agent-now', [{...box(400, 400, 120, 60), id: 'node-b' }]);

    const label = shapes.get(labelId)!;
    // The label follows its arrow to the new midpoint area instead of
    // floating where the old edge used to run.
    expect(label.y).toBeGreaterThan(100);
    expect(label.x).toBeGreaterThan(120);

    const arrow = shapes.get(arrowId)!;
    const start = arrow.props.start as { x: number; y: number };
    const end = arrow.props.end as { x: number; y: number };
    const fromPoint = { x: arrow.x + start.x, y: arrow.y + start.y };
    const toPoint = { x: arrow.x + end.x, y: arrow.y + end.y };
    // The arrow now leaves node-a's border toward node-b's NEW position
    // and stops at its border, instead of pointing at empty canvas.
    expect(fromPoint.y).toBeGreaterThan(60 - 0.01);
    expect(toPoint.y).toBeLessThanOrEqual(400);
    expect(toPoint.y).toBeGreaterThan(fromPoint.y);
    expect(toPoint.x).toBeGreaterThan(400 - 0.01);
    expect(toPoint.x).toBeLessThanOrEqual(520);
  });

  it('does not move a batch that redraws ids already on the canvas (progressive steps)', () => {
    drawAgentShapes('agent-now', [
      {...box(50, 50), id: 'step-node' },
      box(200, 50),
      box(350, 50),
    ]);
    const result = drawAgentShapes('agent-now', [
      {...box(50, 50), id: 'step-node' },
      {...box(200, 150), id: 'step-node-2' },
      {...box(350, 150), id: 'step-node-3' },
    ]);
    expect(result.placementNote).toBeUndefined();
    const second = shapes.get(String(createShapeId('step-node-2')))!;
    expect(second.x).toBe(200);
    expect(second.y).toBe(150);
  });
});
