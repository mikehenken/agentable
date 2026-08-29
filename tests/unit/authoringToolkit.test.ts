/**
 * automated checks: authoring toolkit tools, engine draw capability gating,
 * wireframe stencils, and insert_image markup rejection (G4).
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createShapeId } from 'tldraw';
import {
  AGENT_EDGE_FROM_META_KEY,
  AGENT_EDGE_TO_META_KEY,
  AGENT_SHAPE_PROVENANCE_META_KEY,
  ENGINE_DRAW_UNAVAILABLE_CODE,
} from '../../src/engine/agentDrawingTypes';
import {
  AGENT_WIREFRAME_STENCIL_META_KEY,
  AUTHORING_MARKUP_REJECTED_CODE,
} from '../../src/engine/authoringToolkitTypes';
import {
  bindAuthoringAssetResolver,
  resetAuthoringAssetBridgeForTests,
} from '../../src/agents/authoringAssetBridge';
import {
  bindEngineCapabilities,
  resetEngineCapabilitiesForTests,
} from '../../src/agents/engineBridge';
import {
  gateToolsForEngineCapabilities,
  selectEngineOfferedTools,
} from '../../src/agents/capabilities';
import {
  AUTHORING_TOOLKIT_TOOLS,
  AUTHORING_TOOLKIT_TOOL_NAMES,
} from '../../src/agents/tools/authoringToolkitTools';
import {
  getFunctionDeclarations,
  getTool,
} from '../../src/agents/tools/canvasTools';
import { DRAWING_TOOLS } from '../../src/agents/tools/drawingTools';
import { withAgentToolContextAsync } from '../../src/agents/agentContext';
import {
  arrangeAgentShapes,
  connectAgentShapes,
  frameAgentShapes,
  groupAgentShapes,
  insertAgentImage,
  readConnectorKind,
} from '../../src/engines/tldraw/agentDrawing/authoringToolkitApi';
import { drawAgentShapes, readShapeProvenance } from '../../src/engines/tldraw/agentDrawing/agentDrawingApi';
import { toShapeId } from '../../src/engines/tldraw/agentDrawing/shapeRef';
import { expandWireframeStencil } from '../../src/engines/tldraw/agentDrawing/wireframeStencils';
import {
  bindEditor,
  __resetPanelShapeApiForTests__,
} from '../../src/engines/tldraw/shapes/panelShapeApi';
import type { EngineCapabilities } from '../../src/engine/types';

interface StubShape {
  id: string;
  typeName: 'shape';
  type: string;
  x: number;
  y: number;
  parentId?: string;
  index: string;
  meta: Record<string, unknown>;
  props: Record<string, unknown>;
}

interface StubEditor {
  getShape(): Mock;
  createShape: Mock;
  createAssets?: Mock;
  createBinding?: Mock;
  deleteShapes: Mock;
  getShapePageBounds(): Mock;
  getCurrentPageShapes(): Mock;
  getSortedChildIdsForParent(): Mock;
  groupShapes: Mock;
  reparentShapes: Mock;
  updateShapes: Mock;
  setCurrentTool: Mock;
  __shapes: Map<string, StubShape>;
  __groups: Map<string, string[]>;
}

function makeCapabilities(draw: boolean): EngineCapabilities {
  return {
    frames: true,
    draw,
    minimap: true,
    infinitePan: true,
    nativeSnapshots: true,
  };
}

function makeStubEditor(): StubEditor {
  const shapes = new Map<string, StubShape>();
  const groups = new Map<string, string[]>();
  let groupCounter = 0;

  const editor: StubEditor = {
    __shapes: shapes,
    __groups: groups,
    getShape: vi.fn((id: string) => shapes.get(id)),
    getCurrentPageId: () => 'page:page',
    createShape: vi.fn((shape: Omit<StubShape, 'typeName' | 'index'>) => {
      shapes.set(shape.id, {...shape,
        typeName: 'shape',
        index: `a${shapes.size + 1}`,
        // Real tldraw defaults parentId to the current page when omitted.
        parentId: shape.parentId ?? 'page:page',
        meta: shape.meta ?? {},
        props: shape.props ?? {},
      });
    }),
    createAssets: vi.fn(),
    createBinding: vi.fn(),
    deleteShapes: vi.fn((ids: string[]) => {
      for (const id of ids) {
        shapes.delete(id);
      }
    }),
    getShapePageBounds: vi.fn((id: string) => {
      const shape = shapes.get(id);
      if (!shape) return null;
      const w = (shape.props.w as number | undefined) ?? 120;
      const h = (shape.props.h as number | undefined) ?? 80;
      return { x: shape.x, y: shape.y, w, h };
    }),
    getCurrentPageShapes: vi.fn(() => [...shapes.values()]),
    getSortedChildIdsForParent: vi.fn((parentId: string) =>
      [...shapes.values()].filter((shape) => shape.parentId === parentId).map((shape) => shape.id)),
    groupShapes: vi.fn((ids: string[]) => {
      groupCounter += 1;
      const groupId = String(createShapeId(`group:${groupCounter}`));
      shapes.set(groupId, {
        id: groupId,
        typeName: 'shape',
        type: 'group',
        x: 0,
        y: 0,
        index: `g${groupCounter}`,
        meta: {},
        props: {},
      });
      groups.set(groupId, ids);
      for (const id of ids) {
        const shape = shapes.get(id);
        if (shape) {
          shape.parentId = groupId;
        }
      }
    }),
    reparentShapes: vi.fn((ids: string[], parentId: string) => {
      for (const id of ids) {
        const shape = shapes.get(id);
        if (shape) {
          shape.parentId = parentId;
        }
      }
    }),
    updateShapes: vi.fn(
      (
        updates: Array<{
          id: string;
          meta?: Record<string, unknown>;
          props?: Record<string, unknown>;
          x?: number;
          y?: number;
        }>) => {
        for (const update of updates) {
          const shape = shapes.get(update.id);
          if (!shape) continue;
          if (update.meta !== undefined) shape.meta = update.meta;
          if (update.props !== undefined) shape.props = {...shape.props,...update.props };
          if (update.x !== undefined) shape.x = update.x;
          if (update.y !== undefined) shape.y = update.y;
        }
      }),
    setCurrentTool: vi.fn(),
  };
  return editor;
}

describe('authoring toolkit engine capability gating', () => {
  afterEach(() => {
    resetEngineCapabilitiesForTests();
  });

  it('offers authoring toolkit when engine.draw is true', () => {
    const offers = gateToolsForEngineCapabilities(
      AUTHORING_TOOLKIT_TOOLS,
      makeCapabilities(true));
    const offered = selectEngineOfferedTools(offers).map((tool) => tool.declaration.name);
    expect(offered).toEqual([...AUTHORING_TOOLKIT_TOOL_NAMES]);
  });

  it('refuses authoring toolkit on a mocked engine without draw', () => {
    const offers = gateToolsForEngineCapabilities(
      AUTHORING_TOOLKIT_TOOLS,
      makeCapabilities(false));
    const offered = selectEngineOfferedTools(offers).map((tool) => tool.declaration.name);
    expect(offered).toEqual([]);
    for (const offer of offers) {
      expect(offer.offered).toBe(false);
      expect(offer.note?.code).toBe('ENGINE_CAPABILITY_MISMATCH');
      expect(offer.note?.message).toContain(ENGINE_DRAW_UNAVAILABLE_CODE);
    }
  });

  it('handler refuses insert_image when draw capability is unbound', async () => {
    const tool = AUTHORING_TOOLKIT_TOOLS.find((entry) => entry.declaration.name === 'insert_image');
    expect(tool).toBeDefined();
    const result = await withAgentToolContextAsync(
      { agentId: 'author-1', agentLabel: 'Author Agent' }, () =>
        tool!.handler({
          assetId: 'logo-1',
          geometry: { x: 0, y: 0, w: 120, h: 80 },
        }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain(ENGINE_DRAW_UNAVAILABLE_CODE);
  });

  it('omits authoring toolkit from getFunctionDeclarations when draw is unavailable', () => {
    resetEngineCapabilitiesForTests();
    const declarations = getFunctionDeclarations().map((entry) => entry.name);
    for (const name of AUTHORING_TOOLKIT_TOOL_NAMES) {
      expect(declarations).not.toContain(name);
      // getTool stays resolvable on purpose: executeTool needs the handler so
      // it can return the runtime capability refusal.
      expect(getTool(name)).toBeDefined();
    }
  });

  it('exposes authoring toolkit in getFunctionDeclarations when draw is bound', () => {
    bindEngineCapabilities(makeCapabilities(true));
    const declarations = getFunctionDeclarations().map((entry) => entry.name);
    for (const name of AUTHORING_TOOLKIT_TOOL_NAMES) {
      expect(declarations).toContain(name);
      expect(getTool(name)).toBeDefined();
    }
  });
});

describe('insert_image markup rejection ( G4)', () => {
  let editor: StubEditor;

  beforeEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    resetAuthoringAssetBridgeForTests();
    bindEngineCapabilities(makeCapabilities(true));
    editor = makeStubEditor();
    bindEditor(editor as never);
    bindAuthoringAssetResolver((assetId) => ({
      assetId,
      src: `asset:${assetId}`,
      w: 200,
      h: 120,
      mimeType: 'image/png',
    }));
  });

  afterEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    resetAuthoringAssetBridgeForTests();
  });

  it('rejects model-supplied url fields', async () => {
    const tool = AUTHORING_TOOLKIT_TOOLS.find((entry) => entry.declaration.name === 'insert_image');
    expect(tool).toBeDefined();
    const result = await withAgentToolContextAsync(
      { agentId: 'author-1', agentLabel: 'Author Agent' }, () =>
        tool!.handler({
          url: 'https://evil.example/logo.png',
          geometry: { x: 0, y: 0, w: 120, h: 80 },
        }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain(AUTHORING_MARKUP_REJECTED_CODE);
  });

  it('rejects URL-like assetId values', async () => {
    const tool = AUTHORING_TOOLKIT_TOOLS.find((entry) => entry.declaration.name === 'insert_image');
    expect(tool).toBeDefined();
    const result = await withAgentToolContextAsync(
      { agentId: 'author-1', agentLabel: 'Author Agent' }, () =>
        tool!.handler({
          assetId: 'https://evil.example/logo.png',
          geometry: { x: 0, y: 0, w: 120, h: 80 },
        }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain(AUTHORING_MARKUP_REJECTED_CODE);
  });

  it('stamps provenance on insert_image shapes', () => {
    const result = insertAgentImage(
      'author-1',
      { assetId: 'hero', geometry: { x: 10, y: 20, w: 160, h: 90 }, alt: 'Hero' },
      {
        assetId: 'hero',
        src: 'asset:hero',
        w: 160,
        h: 90,
        mimeType: 'image/png',
      });
    expect(result.imageShapeId.length).toBeGreaterThan(0);
    const created = editor.createShape.mock.calls.at(-1)?.[0] as StubShape;
    expect(created.type).toBe('image');
    expect(readShapeProvenance(created)).toBe('author-1');
    expect(created.meta.alt).toBe('Hero');
  });
});

describe('wireframe stencils and authoring adapters ', () => {
  let editor: StubEditor;

  beforeEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    bindEngineCapabilities(makeCapabilities(true));
    editor = makeStubEditor();
    bindEditor(editor as never);
  });

  afterEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
  });

  it('expands button stencil into provenance-stamped wireframe marks', () => {
    const shapes = expandWireframeStencil('button', { kind: 'rect', x: 0, y: 0, w: 100, h: 40 });
    expect(shapes.length).toBeGreaterThan(0);
    const result = drawAgentShapes('author-2', shapes);
    expect(result.createdShapeIds.length).toBe(shapes.length);
    for (const call of editor.createShape.mock.calls) {
      const created = call[0] as StubShape;
      expect(readShapeProvenance(created)).toBe('author-2');
      expect(created.meta[AGENT_WIREFRAME_STENCIL_META_KEY]).toBe('button');
    }
  });

  it('connect_shapes stamps connector kind meta', () => {
    const fromId = String(createShapeId('from'));
    const toId = String(createShapeId('to'));
    editor.__shapes.set(fromId, {
      id: fromId,
      typeName: 'shape',
      type: 'geo',
      x: 0,
      y: 0,
      index: 'a1',
      meta: {},
      props: { w: 80, h: 40 },
    });
    editor.__shapes.set(toId, {
      id: toId,
      typeName: 'shape',
      type: 'geo',
      x: 200,
      y: 0,
      index: 'a2',
      meta: {},
      props: { w: 80, h: 40 },
    });

    const result = connectAgentShapes('author-3', {
      from: fromId,
      to: toId,
      kind: 'flow',
      label: 'next',
    });
    expect(result.connectorShapeId.length).toBeGreaterThan(0);
    const created = editor.createShape.mock.calls.at(-1)?.[0] as StubShape;
    expect(created.type).toBe('arrow');
    expect(readConnectorKind(created.meta)).toBe('flow');
    expect(created.meta[AGENT_SHAPE_PROVENANCE_META_KEY]).toBe('author-3');
    // The label is stored as richText, never a plain `text` prop: tldraw's
    // arrow schema rejects `props.text` with "Unexpected property", which
    // previously failed every labeled connector at validation time.
    expect(created.props.text).toBeUndefined();
    expect(created.props.richText).toBeDefined();
  });

  it('connect_shapes moves a label that cannot fit on the arrow to a text shape beside it', () => {
    // Regression (owner screenshot): bound-arrow label pills wrap to the
    // arrow's length, so labels between tightly-packed shapes rendered as
    // mid-word fragments ("downli nk").
    const fromId = String(createShapeId('tight-a'));
    const toId = String(createShapeId('tight-b'));
    for (const [id, x] of [
      [fromId, 0],
      [toId, 200],
    ] as const) {
      editor.__shapes.set(id, {
        id,
        typeName: 'shape',
        type: 'geo',
        x,
        y: 0,
        index: id,
        meta: {},
        props: { w: 80, h: 40 },
      });
    }

    const result = connectAgentShapes('author-6', {
      from: fromId,
      to: toId,
      kind: 'flow',
      label: 'Telemetry downlink stream',
    });
    expect(result.labelShapeId).toBeDefined();

    const arrow = editor.__shapes.get(result.connectorShapeId)!;
    expect(arrow.type).toBe('arrow');
    // The pill stays off the arrow so tldraw cannot wrap it mid-word.
    expect(arrow.props.richText).toBeUndefined();

    const labelShape = editor.__shapes.get(result.labelShapeId!)!;
    expect(labelShape.type).toBe('text');
    expect(labelShape.props.richText).toBeDefined();
    expect(readShapeProvenance(labelShape)).toBe('author-6');
    // Fixed width sized to the whole label: no wrapping.
    expect(labelShape.props.autoSize).toBe(false);
    expect(labelShape.props.w as number).toBeGreaterThanOrEqual(
      'Telemetry downlink stream'.length * 11);
  });

  it('connect_shapes resolves shapes drawn with model-assigned ids', () => {
    // Draw two shapes with the logical ids a model assigns.
    drawAgentShapes('author-4', [
      { kind: 'box', id: 'ignition', geometry: { kind: 'rect', x: 0, y: 0, w: 80, h: 40 } },
      { kind: 'ellipse', id: 'ascent', geometry: { kind: 'rect', x: 200, y: 0, w: 80, h: 40 } },
    ]);
    expect(editor.__shapes.has(String(createShapeId('ignition')))).toBe(true);
    expect(editor.__shapes.has(String(createShapeId('ascent')))).toBe(true);

    // A model connects them by the same raw ids it assigned. Before the fix
    // this threw "from shape 'ignition' was not found" because draw_shapes
    // discarded the id and asShapeId did not prefix a raw id.
    const result = connectAgentShapes('author-4', {
      from: 'ignition',
      to: 'ascent',
      kind: 'flow',
      label: 'Gravity Turn',
    });
    expect(result.connectorShapeId.length).toBeGreaterThan(0);
    const arrow = editor.__shapes.get(result.connectorShapeId)!;
    expect(arrow.type).toBe('arrow');
  });

  it('toShapeId normalizes raw and already-formatted ids without double-prefixing', () => {
    expect(String(toShapeId('ignition'))).toBe('shape:ignition');
    expect(String(toShapeId('shape:ignition'))).toBe('shape:ignition');
    expect(String(toShapeId(String(createShapeId('node-1'))))).toBe('shape:node-1');
  });

  it('group_shapes and frame_shapes compose selections with provenance', () => {
    const a = String(createShapeId('a'));
    const b = String(createShapeId('b'));
    for (const [id, x] of [[a, 0], [b, 120]] as const) {
      editor.__shapes.set(id, {
        id,
        typeName: 'shape',
        type: 'geo',
        x,
        y: 0,
        index: id,
        meta: { [AGENT_SHAPE_PROVENANCE_META_KEY]: 'author-4' },
        props: { w: 80, h: 40 },
      });
    }

    const grouped = groupAgentShapes('author-4', { shapeIds: [a, b] });
    expect(grouped.groupId.length).toBeGreaterThan(0);
    expect(editor.groupShapes).toHaveBeenCalled();

    const framed = frameAgentShapes('author-4', { shapeIds: [a, b], name: 'Wireframe' });
    expect(framed.frameId.length).toBeGreaterThan(0);
    expect(editor.reparentShapes).toHaveBeenCalled();
  });

  it('draw_shapes stencil path is registered on drawing tools', () => {
    const drawTool = DRAWING_TOOLS.find((entry) => entry.declaration.name === 'draw_shapes');
    expect(drawTool?.declaration.parameters.properties.stencil).toBeDefined();
  });
});

/**
 * Iteration 5 regression coverage (owner screenshots): a radial arrange
 * spaced real 200px shapes by guessed default sizes and piled them on top
 * of each other, and it left every diagram edge arrow stranded at its old
 * position (an orphaned line with floating labels).
 */
describe('arrange uses real sizes and moves edge arrows with their nodes (iteration 5)', () => {
  let editor: StubEditor;

  beforeEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    bindEngineCapabilities(makeCapabilities(true));
    editor = makeStubEditor();
    bindEditor(editor as never);
  });

  afterEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
  });

  function addNode(id: string, x: number, y: number, w: number, h: number): string {
    const shapeId = String(createShapeId(id));
    editor.__shapes.set(shapeId, {
      id: shapeId,
      typeName: 'shape',
      type: 'geo',
      x,
      y,
      index: shapeId,
      meta: { [AGENT_SHAPE_PROVENANCE_META_KEY]: 'author-5' },
      props: { w, h },
    });
    return shapeId;
  }

  function addEdgeArrow(id: string, from: string, to: string): string {
    const shapeId = String(createShapeId(id));
    editor.__shapes.set(shapeId, {
      id: shapeId,
      typeName: 'shape',
      type: 'arrow',
      x: 0,
      y: 0,
      index: shapeId,
      meta: {
        [AGENT_SHAPE_PROVENANCE_META_KEY]: 'author-5',
        [AGENT_EDGE_FROM_META_KEY]: from,
        [AGENT_EDGE_TO_META_KEY]: to,
      },
      props: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
    });
    return shapeId;
  }

  function rectOf(shapeId: string): { x: number; y: number; w: number; h: number } {
    const shape = editor.__shapes.get(shapeId)!;
    return {
      x: shape.x,
      y: shape.y,
      w: shape.props.w as number,
      h: shape.props.h as number,
    };
  }

  it('radial arrange spaces real-sized shapes without overlap', () => {
    const hub = addNode('hub', 0, 0, 180, 90);
    const orbitIds = ['o1', 'o2', 'o3', 'o4', 'o5', 'o6'].map((id, index) =>
      addNode(id, index * 30, index * 20, 200, 70));

    arrangeAgentShapes('author-5', { shapeIds: [hub,...orbitIds], layout: 'radial' });

    const rects = [hub,...orbitIds].map(rectOf);
    function intersects(a: (typeof rects)[0], b: (typeof rects)[0]): boolean {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        expect(intersects(rects[i]!, rects[j]!)).toBe(false);
      }
    }
  });

  it('flow arrange re-routes an edge arrow between its moved nodes', () => {
    const a = addNode('node-a', 0, 0, 120, 60);
    const b = addNode('node-b', 600, 400, 120, 60);
    const arrow = addEdgeArrow('edge-ab', 'node-a', 'node-b');

    arrangeAgentShapes('author-5', { shapeIds: [a, b], layout: 'flow' });

    const rectA = rectOf(a);
    const rectB = rectOf(b);
    // Flow puts both nodes on one row.
    expect(rectA.y).toBeCloseTo(rectB.y, 5);
    expect(rectB.x).toBeGreaterThan(rectA.x + rectA.w);

    const moved = editor.__shapes.get(arrow)!;
    const start = moved.props.start as { x: number; y: number };
    const end = moved.props.end as { x: number; y: number };
    const fromPoint = { x: moved.x + start.x, y: moved.y + start.y };
    const toPoint = { x: moved.x + end.x, y: moved.y + end.y };
    // The arrow now runs between the two new boxes, clipped to their
    // borders, instead of staying stranded at its old position.
    expect(fromPoint.x).toBeGreaterThanOrEqual(rectA.x + rectA.w - 0.01);
    expect(fromPoint.x).toBeLessThanOrEqual(rectB.x);
    expect(toPoint.x).toBeLessThanOrEqual(rectB.x + 0.01);
    expect(toPoint.x).toBeGreaterThanOrEqual(rectA.x + rectA.w);
    expect(fromPoint.y).toBeCloseTo(rectA.y + rectA.h / 2, 5);
    expect(toPoint.y).toBeCloseTo(rectB.y + rectB.h / 2, 5);
  });

  it('edge arrows listed in shapeIds re-route instead of becoming layout nodes', () => {
    const a = addNode('node-a2', 0, 0, 120, 60);
    const b = addNode('node-b2', 500, 300, 120, 60);
    const arrow = addEdgeArrow('edge-ab2', 'node-a2', 'node-b2');

    const result = arrangeAgentShapes('author-5', {
      shapeIds: [a, b, arrow],
      layout: 'flow',
    });
    expect(result.arrangedShapeIds).toHaveLength(3);

    const rectA = rectOf(a);
    const rectB = rectOf(b);
    expect(rectA.y).toBeCloseTo(rectB.y, 5);

    const moved = editor.__shapes.get(arrow)!;
    const start = moved.props.start as { x: number; y: number };
    const fromPoint = { x: moved.x + start.x, y: moved.y + start.y };
    expect(fromPoint.x).toBeGreaterThanOrEqual(rectA.x + rectA.w - 0.01);
  });

  it('returns a note telling the model the layout is already applied', () => {
    const a = addNode('node-a3', 0, 0, 120, 60);
    const b = addNode('node-b3', 400, 200, 120, 60);

    const result = arrangeAgentShapes('author-6', {
      shapeIds: [a, b],
      layout: 'radial',
    });
    // Regression: without this note the model redraws the whole diagram
    // under fresh ids after arranging, leaving a duplicate copy on canvas.
    expect(result.note).toContain('in place');
    expect(result.note).toContain('Do not redraw');
    expect(result.note).toContain('radial');
  });
});
