/**
 * Offline chat-to-draw fallback (iteration 2).
 *
 * Covers: draws the dedicated Apogee Aerospace fixture via the bound
 * CHAT_AGENT_TOOL_CONTEXT (not the unrelated Northstar Atelier P8-demo
 * fixture), is idempotent on repeat, dispatches the same `landi:tool-call`
 * event the live clients dispatch, and falls back to a plain notice with no
 * draw attempt when the mounted engine cannot draw.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runOfflineDrawFallback } from '../../src/chat/offlineDrawFallback';
import { CHAT_AGENT_TOOL_CONTEXT } from '../../src/chat/geminiChatClient';
import { FIT_AGENT_DRAWING_EVENT } from '../../src/choreography/constants';
import { APOGEE_LAUNCH_SEQUENCE_SHAPES } from '../../src/chat/fixtures/apogeeAerospace';
import {
  bindEngineCapabilities,
  resetEngineCapabilitiesForTests,
} from '../../src/agents/engineBridge';
import {
  bindEditor,
  __resetPanelShapeApiForTests__,
} from '../../src/engines/tldraw/shapes/panelShapeApi';
import { readShapeProvenance } from '../../src/engines/tldraw/agentDrawing/agentDrawingApi';
import type { EngineCapabilities } from '../../src/engine/types';

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

function makeCapabilities(draw: boolean): EngineCapabilities {
  return { frames: true, draw, minimap: true, infinitePan: true, nativeSnapshots: true };
}

function makeStubEditor (){
  const shapes = new Map<string, StubShape>();
  return {
    __shapes: shapes,
    getShape: vi.fn((id: string) => shapes.get(String(id))),
    createShape: vi.fn((shape: Omit<StubShape, 'typeName' | 'index'>) => {
      const id = String(shape.id);
      shapes.set(id, {...shape,
        id,
        typeName: 'shape',
        index: `a${shapes.size + 1}`,
        meta: shape.meta ?? {},
        props: shape.props ?? {},
      });
    }),
    deleteShapes: vi.fn((ids: string[]) => {
      for (const id of ids) shapes.delete(String(id));
    }),
    getShapePageBounds: vi.fn((id: string) => {
      const shape = shapes.get(String(id));
      if (!shape) return null;
      return { x: shape.x, y: shape.y, w: 400, h: 300 };
    }),
    getCurrentPageShapes: vi.fn(() => [...shapes.values()]),
    getViewportPageBounds: vi.fn(() => ({ x: 0, y: 0, w: 1200, h: 800 })),
  };
}

describe('runOfflineDrawFallback', () => {
  afterEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    vi.restoreAllMocks();
  });

  it('returns a plain not-configured notice and attempts no draw when the engine cannot draw', async () => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    bindEngineCapabilities(makeCapabilities(false));

    const fitEvents: CustomEvent[] = [];
    const onFit = (e: Event) => fitEvents.push(e as CustomEvent);
    window.addEventListener(FIT_AGENT_DRAWING_EVENT, onFit);

    try {
      const result = await runOfflineDrawFallback();

      expect(result.toolCalls).toHaveLength(0);
      expect(result.text.toLowerCase()).toContain('not configured');
       // Nothing was drawn, so the camera must not be asked to fit anything.
      expect(fitEvents).toHaveLength(0);
    } finally {
      window.removeEventListener(FIT_AGENT_DRAWING_EVENT, onFit);
    }
  });

  it('draws the Apogee Aerospace launch-sequence fixture via the bound chat agent context', async () => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    bindEngineCapabilities(makeCapabilities(true));
    const editor = makeStubEditor();
    bindEditor(editor as never);

    const events: CustomEvent[] = [];
    const onToolCall = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener('landi:tool-call', onToolCall);

    const fitEvents: CustomEvent[] = [];
    const onFit = (e: Event) => fitEvents.push(e as CustomEvent);
    window.addEventListener(FIT_AGENT_DRAWING_EVENT, onFit);

    try {
      const result = await runOfflineDrawFallback();

      expect(result.text).toContain('Offline demo mode');
      expect(result.toolCalls.map((c) => c.name)).toEqual(['clear_agent_drawings', 'draw_shapes']);
      for (const call of result.toolCalls) {
        expect(call.ok).toBe(true);
      }

       // Proves the fixture drawn is this page's own Apogee Aerospace
       // composition, not the unrelated P8-demo Northstar Atelier fixture,
       // and not a rigid auto-layout diagram (explicit shapes only).
      expect(result.toolCalls[1].args).toEqual({ shapes: APOGEE_LAUNCH_SEQUENCE_SHAPES });
      const serialized = JSON.stringify(result.toolCalls);
      expect(serialized).not.toContain('Northstar');
      expect(serialized).not.toContain('meta.agentableAgent');
      expect(serialized).toContain('Halcyon-7');
      expect(serialized).toContain('Stage 2 Separation');

       // One created shape per fixture entry (5 nodes + 5 labels + 4 arrows
       // + 3 freehand strokes + 1 annotation = 18), all attributed to the
       // chat agent context.
      expect(editor.createShape.mock.calls.length).toBe(APOGEE_LAUNCH_SEQUENCE_SHAPES.length);
      for (const call of editor.createShape.mock.calls) {
        expect(readShapeProvenance(call[0] as never)).toBe(CHAT_AGENT_TOOL_CONTEXT.agentId);
      }

      expect(events.length).toBeGreaterThan(0);
      for (const event of events) {
        expect(event.detail.source).toBe('chat');
      }

       // After a successful draw, ask the engine to zoom to fit this agent's
       // marks so the whole (wide) sketch is revealed rather than a fragment.
      expect(fitEvents).toHaveLength(1);
      expect(fitEvents[0].detail.agentId).toBe(CHAT_AGENT_TOOL_CONTEXT.agentId);
    } finally {
      window.removeEventListener('landi:tool-call', onToolCall);
      window.removeEventListener(FIT_AGENT_DRAWING_EVENT, onFit);
    }
  });

  it('uses freehand pen strokes for organic accents, not just a rigid row of boxes', () => {
    const freehandCount = APOGEE_LAUNCH_SEQUENCE_SHAPES.filter(
      (shape) => shape.kind === 'freehand').length;
    expect(freehandCount).toBeGreaterThanOrEqual(2);
  });

  it('mixes ellipses and boxes, each sized wide enough for its own label so no label overflows', () => {
    const geoShapes = APOGEE_LAUNCH_SEQUENCE_SHAPES.filter(
      (shape) => (shape.kind === 'box' || shape.kind === 'ellipse') && shape.geometry.kind === 'rect');
    const kinds = new Set(geoShapes.map((shape) => shape.kind));
    expect(kinds.has('box')).toBe(true);
    expect(kinds.has('ellipse')).toBe(true);

    for (const shape of geoShapes) {
      if (shape.geometry.kind !== 'rect') continue;
       // A generous floor - short single-word labels like "Terminal Count"
       // or "Stage 2 Separation" need real room, not the old fixed 120px
       // default that caused text to spill below its box.
      expect(shape.geometry.w).toBeGreaterThanOrEqual(180);
      expect(shape.geometry.h).toBeGreaterThanOrEqual(80);
    }
  });

  it('never lets two node boxes/ellipses overlap, and gives arrows real breathing room', () => {
    const geoShapes = APOGEE_LAUNCH_SEQUENCE_SHAPES.filter(
      (shape) => (shape.kind === 'box' || shape.kind === 'ellipse') && shape.geometry.kind === 'rect') as Array<{ geometry: { kind: 'rect'; x: number; y: number; w: number; h: number } }>;

    function intersects(
      a: { x: number; y: number; w: number; h: number },
      b: { x: number; y: number; w: number; h: number }): boolean {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    for (let i = 0; i < geoShapes.length; i += 1) {
      for (let j = i + 1; j < geoShapes.length; j += 1) {
        expect(intersects(geoShapes[i]!.geometry, geoShapes[j]!.geometry)).toBe(false);
      }
    }

    const arrows = APOGEE_LAUNCH_SEQUENCE_SHAPES.filter(
      (shape) => shape.kind === 'arrow' && shape.geometry.kind === 'segment');
    expect(arrows.length).toBeGreaterThanOrEqual(4);
    for (const arrow of arrows) {
      if (arrow.geometry.kind !== 'segment') continue;
      const dx = arrow.geometry.to.x - arrow.geometry.from.x;
      const dy = arrow.geometry.to.y - arrow.geometry.from.y;
      expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(60);
    }
  });

  it('is idempotent on repeat: retyping a message redraws instead of stacking additional shapes', async () => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    bindEngineCapabilities(makeCapabilities(true));
    const editor = makeStubEditor();
    bindEditor(editor as never);

    await runOfflineDrawFallback();
    const countAfterFirst = editor.getCurrentPageShapes.length;
    expect(countAfterFirst).toBeGreaterThan(0);

    await runOfflineDrawFallback();
    const countAfterSecond = editor.getCurrentPageShapes.length;

    expect(countAfterSecond).toBe(countAfterFirst);
  });
});
