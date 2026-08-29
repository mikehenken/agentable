/**
 * automated checks: digest shape slice and delta integration.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createActivityLog, resetActivityLogCounterForTests } from '../../src/agents/activity';
import {
  computeDigestDelta,
  createDigestCompiler,
  type DigestShapeSummary,
  type WorkspaceDigest,
} from '../../src/agents/digest';
import {
  bindDigestShapeCollector,
  getDigestShapeSlice,
  resetDigestShapeBridgeForTests,
} from '../../src/engines/tldraw/digest/digestShapeBridge';
import { buildDigestShapeSummary } from '../../src/agents/digestShapes';
import {
  bindDrawingActivityLog,
  recordDrawShapesActivity,
  resetDrawingActivityLogForTests,
} from '../../src/agents/drawingActivity';
import { collectDigestShapeSummaries } from '../../src/engines/tldraw/digest/digestShapeCollector';
import { bindEditor, unbindEditor } from '../../src/engines/tldraw/shapes/panelShapeApi';

type StubShape = {
  id: string;
  type: string;
  typeName: 'shape';
  x: number;
  y: number;
  index: string;
  parentId?: string;
  meta: Record<string, unknown>;
  props: Record<string, unknown>;
};

type StubEditor = {
  __shapes: Map<string, StubShape>;
  getCurrentPageShapes: () => StubShape[];
  getShapePageBounds: (id: string) => { x: number; y: number; w: number; h: number } | null;
  getViewportPageBounds?: () => { x: number; y: number; w: number; h: number };
  store: { listen: ReturnType<typeof vi.fn> };
};

function makeShape(
  id: string,
  type: string,
  overrides: Partial<StubShape> = {}): StubShape {
  return {
    id,
    type,
    typeName: 'shape',
    x: 0,
    y: 0,
    index: 'a1',
    meta: {},
    props: type === 'geo' ? { geo: 'rectangle', w: 120, h: 80 }: {},...overrides,
  };
}

function makeEditor(initial: StubShape[] = []): StubEditor {
  const shapes = new Map<string, StubShape>(initial.map((shape) => [shape.id, shape]));
  return {
    __shapes: shapes,
    getCurrentPageShapes: () => [...shapes.values()],
    getShapePageBounds: (id: string) => {
      const shape = shapes.get(id);
      if (!shape) return null;
      const w = Number(shape.props.w ?? 80);
      const h = Number(shape.props.h ?? 40);
      return { x: shape.x, y: shape.y, w, h };
    },
    store: {
      listen: vi.fn(() => ()=> undefined),
    },
  };
}

function baseDigest(shapes: DigestShapeSummary[] = []): WorkspaceDigest {
  return {
    user: { id: 'user-1' },
    contexts: [],
    agents: [],
    jobs: [],
    pendingApprovals: [],
    recentActivity: [],
    shapes,
  };
}

describe(' digest shape delta integration', () => {
  beforeEach(() => {
    resetDigestShapeBridgeForTests();
    resetDrawingActivityLogForTests();
    resetActivityLogCounterForTests();
    unbindEditor();
  });

  afterEach(() => {
    resetDigestShapeBridgeForTests();
    unbindEditor();
  });

  it('computeDigestDelta reports new, changed, and removed shape ids', () => {
    const first = baseDigest([
      buildDigestShapeSummary({
        id: 'shape:a',
        nativeType: 'geo',
        kind: 'box',
        label: 'Header',
        agentId: 'agent-1',
        revisionPayload: { x: 0, y: 0 },
      }),
    ]);
    const second = baseDigest([
      buildDigestShapeSummary({
        id: 'shape:a',
        nativeType: 'geo',
        kind: 'box',
        label: 'Header',
        agentId: 'agent-1',
        revisionPayload: { x: 40, y: 0 },
      }),
      buildDigestShapeSummary({
        id: 'shape:b',
        nativeType: 'arrow',
        kind: 'arrow',
        label: 'arrow',
        agentId: 'agent-1',
        revisionPayload: { from: 'shape:a', to: 'shape:b' },
      }),
    ]);

    const delta = computeDigestDelta(first, second);
    expect(delta.changed).toBe(true);
    expect(delta.newShapes).toEqual(['shape:b']);
    expect(delta.changedShapes).toEqual(['shape:a']);
    expect(delta.removedShapes).toEqual([]);
    expect(delta.patch.shapes?.map((shape) => shape.id).sort()).toEqual(['shape:a', 'shape:b']);

    const removal = computeDigestDelta(second, first);
    expect(removal.removedShapes).toEqual(['shape:b']);
    expect(removal.changedShapes).toEqual(['shape:a']);
  });

  it('compiler deltaFor includes shape changes in per-agent delivery', () => {
    const compiler = createDigestCompiler();
    const baseline = {
      user: { id: 'u1' },
      contexts: [],
      agents: [{ id: 'a1', kind: 'chat' as const, label: 'Chat', status: 'idle' as const }],
      recentActivity: [],
      shapes: [
        buildDigestShapeSummary({
          id: 'shape:1',
          nativeType: 'geo',
          kind: 'box',
          label: 'nav',
          agentId: 'a1',
          revisionPayload: { x: 0 },
        }),
      ],
      changeBatchId: 'batch-1',
    };

    compiler.deltaFor('a1', baseline);

    const { delta } = compiler.deltaFor('a1', {...baseline,
      changeBatchId: 'batch-2',
      shapes: [
        buildDigestShapeSummary({
          id: 'shape:1',
          nativeType: 'geo',
          kind: 'box',
          label: 'nav',
          agentId: 'a1',
          revisionPayload: { x: 120 },
        }),
        buildDigestShapeSummary({
          id: 'shape:2',
          nativeType: 'text',
          kind: 'text',
          label: 'Hero',
          agentId: 'a1',
          revisionPayload: { text: 'Hero' },
        }),
      ],
    });

    expect(delta.newShapes).toEqual(['shape:2']);
    expect(delta.changedShapes).toEqual(['shape:1']);
    expect(delta.patch.shapes).toHaveLength(2);
  });

  it('collects agent-authored marks from the tldraw editor binding', () => {
    const editor = makeEditor([
      makeShape('shape:panel:chat', 'panel', {
        props: { panelId: 'chat', w: 360, h: 420 },
      }),
      makeShape('shape:mark-1', 'geo', {
        meta: { agentableAgent: 'agent-1' },
        x: 10,
        y: 20,
      }),
    ]);

    bindEditor(editor as unknown as Parameters<typeof bindEditor>[0]);
    const summaries = collectDigestShapeSummaries(
      editor as unknown as Parameters<typeof collectDigestShapeSummaries>[0]);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.id).toBe('shape:mark-1');
    expect(summaries[0]?.agentId).toBe('agent-1');
    expect(summaries[0]?.kind).toBe('box');
  });

  it('digest shape bridge bumps change batches on store updates', () => {
    const editor = makeEditor([
      makeShape('shape:mark-1', 'geo', {
        meta: { agentableAgent: 'agent-1' },
        props: { geo: 'rectangle', w: 80, h: 40 },
      }),
    ]);

    bindDigestShapeCollector(editor as unknown as Parameters<typeof bindDigestShapeCollector>[0]);
    // Capture the slice value now (batch 1); holding the function and calling
    // it later would read post-update state and make the bump check vacuous.
    const first = getDigestShapeSlice();
    expect(first?.changeBatchId).toBe('digest-shapes:1');
    expect(first?.shapes).toHaveLength(1);

    editor.__shapes.set(
      'shape:mark-2',
      makeShape('shape:mark-2', 'text', {
        meta: { agentableAgent: 'agent-1' },
        props: { text: 'Note' },
      }));
    const listenCall = editor.store.listen.mock.calls[0];
    const onStoreChange = listenCall?.[0] as (() => void) | undefined;
    onStoreChange?.();

    const second = getDigestShapeSlice();
    expect(second?.changeBatchId).not.toBe(first?.changeBatchId);
    expect(second?.shapes).toHaveLength(2);
  });

  it('records drawing activity verbs for digest recency', () => {
    const activity = createActivityLog();
    bindDrawingActivityLog(activity);

    recordDrawShapesActivity('agent-1', {
      agentId: 'agent-1',
      createdShapeIds: ['shape:a', 'shape:b'],
    });

    const entries = activity.getEntries;
    expect(entries().some((entry) => entry.verb === 'draw_shapes')).toBe(true);
    expect(entries().some((entry) => entry.target === '2 shapes')).toBe(true);
  });
});
