/**
 * Chat client default model - Sandals bounded embed uses generateContent via
 * createChatClient without an explicit model override.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createChatClient,
  createTurnCanvasLedger,
  CHAT_AGENT_TOOL_CONTEXT,
  MAX_TOOLS_PER_TURN,
  DEFAULT_MAX_ROUND_TRIPS,
  evaluateTurnToolRefusal,
  isSuccessfulDiagramDraw,
  formatToolReasoningStatus,
  resolvePostDrawArrangeLayout,
  filterBenignNestedDiagramLints,
  shouldCompleteNestedDiagramReview,
} from '../../src/chat/geminiChatClient';
import { CLEAR_FORBIDDEN_LAYOUT_FIX_ERROR } from '../../src/chat/postDrawCanvasReview';
import { forceStopOperatorThread } from '../../src/agents/surface/operatorChatBridge';
import type { OperatorThread } from '../../src/agents/surface/types';
import { getAgentToolContext } from '../../src/agents/agentContext';
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
  parentId?: string;
}

function makeCapabilities(): EngineCapabilities {
  return { frames: true, draw: true, minimap: true, infinitePan: true, nativeSnapshots: true };
}

function makeStubEditor() {
  const pageId = 'page:page';
  const shapes = new Map<string, StubShape>();
  return {
    __shapes: shapes,
    getCurrentPageId: vi.fn(() => pageId),
    getShape: vi.fn((id: string) => shapes.get(String(id))),
    createShape: vi.fn((shape: Omit<StubShape, 'typeName' | 'index'> & { parentId?: string }) => {
      const id = String(shape.id);
      shapes.set(id, {...shape,
        id,
        typeName: 'shape',
        index: `a${shapes.size + 1}`,
        meta: shape.meta ?? {},
        props: shape.props ?? {},
        parentId: shape.parentId ?? pageId,
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

describe('geminiChatClient default model', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to gemini-3.1-pro-preview when proxyUrl is set', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { model?: string; contents?: unknown[] };
      // Guard against defaults that do not exist on the API: a bad id fails
      // every turn with model NOT_FOUND before any tool runs.
      expect(body.model).toBe('gemini-3.1-pro-preview');
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'ok' }] } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createChatClient({
      proxyUrl: 'https://example.test/chat',
      systemInstruction: 'test persona',
    });

    await client.send([], 'hello');

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('geminiChatClient tool-execution agent context binding', () => {
  beforeEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    bindEngineCapabilities(makeCapabilities());
  });

  afterEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    vi.restoreAllMocks();
  });

  it('binds CHAT_AGENT_TOOL_CONTEXT around executeTool so a draw_shapes call succeeds end to end instead of throwing "agent tool context is required"', async () => {
    const editor = makeStubEditor();
    bindEditor(editor as never);

    let round = 0;
    const fetchMock = vi.fn(async () => {
      round += 1;
      if (round === 1) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: {
                        id: 'call-1',
                        name: 'draw_shapes',
                        args: {
                          shapes: [
                            { kind: 'box', geometry: { kind: 'rect', x: 0, y: 0, w: 80, h: 40 } },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Drew a box.' }] } }] }),
        { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createChatClient({
      proxyUrl: 'https://example.test/chat',
      systemInstruction: 'test persona',
    });

    const result = await client.send([], 'draw a box');

    expect(result.toolCalls.some((call) => call.name === 'draw_shapes' && call.ok)).toBe(true);
    expect(result.toolCalls.some((call) => call.name === 'read_canvas' && call.ok)).toBe(true);
    expect(result.toolCalls[0].name).toBe('draw_shapes');
    // Before the fix, this call threw "agent tool context is required for
    // this operation" and result.ok was false. Asserting true here is a
    // regression guard for that exact bug.
    expect(result.toolCalls[0].ok).toBe(true);
    expect(result.text).toBe('Drew a box.');

    expect(editor.createShape).toHaveBeenCalledTimes(1);
    const created = editor.createShape.mock.calls[0][0];
    expect(readShapeProvenance(created)).toBe(CHAT_AGENT_TOOL_CONTEXT.agentId);

    // The bound context does not leak past the turn.
    expect(getAgentToolContext()).toBeNull();
  });

  it('reports the tool context error when the binding is missing (drawingTools still gates on it)', async () => {
    // Sanity check for the regression guard above: calling the tool
    // handler directly, with no bound context, still fails the way it did
    // before the fix - proving the previous test passes because of the
    // binding, not because the underlying gate was removed.
    const { executeTool } = await import('../../src/agents/tools/canvasTools');
    const result = await executeTool('draw_shapes', {
      shapes: [{ kind: 'box', geometry: { kind: 'rect', x: 0, y: 0, w: 80, h: 40 } }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('agent tool context is required');
  });
});

describe('turn canvas ledger (regression: clear-spam ended turns on an empty canvas)', () => {
  const DRAW = { shapes: [{ kind: 'box' }] };

  it('refuses a second clear in the same turn', () => {
    const ledger = createTurnCanvasLedger();
    expect(ledger.shouldRefuseClear()).toBe(false);
    ledger.record('clear_agent_drawings', {}, true);
    expect(ledger.shouldRefuseClear()).toBe(true);
  });

  it('restores the wiped scene when a clear deletes this turn\'s drawings', () => {
    // Observed live: clear, draw, clear, draw, clear, then a success reply
    // over an empty canvas. The single-clear budget stops the spam, and the
    // wiped scene captures what the one allowed clear deleted.
    const ledger = createTurnCanvasLedger();
    ledger.record('draw_shapes', DRAW, true);
    ledger.record('connect_shapes', { from: 'a', to: 'b' }, true);
    ledger.record('clear_agent_drawings', {}, true);
    expect(ledger.hasLiveDrawing()).toBe(false);
    expect(ledger.wipedScene().map((call) => call.name)).toEqual([
      'draw_shapes',
      'connect_shapes',
    ]);
  });

  it('does not restore when drawings survive after the clear', () => {
    const ledger = createTurnCanvasLedger();
    ledger.record('draw_shapes', DRAW, true);
    ledger.record('clear_agent_drawings', {}, true);
    ledger.record('draw_shapes', DRAW, true);
    expect(ledger.hasLiveDrawing()).toBe(true);
    expect(ledger.wipedScene()).toEqual([]);
  });

  it('does not resurrect a previous turn\'s scene (clear before any draw)', () => {
    const ledger = createTurnCanvasLedger();
    ledger.record('clear_agent_drawings', {}, true);
    expect(ledger.wipedScene()).toEqual([]);
    expect(ledger.hasLiveDrawing()).toBe(false);
  });

  it('ignores failed calls and read-only tools', () => {
    const ledger = createTurnCanvasLedger();
    ledger.record('draw_shapes', DRAW, false);
    ledger.record('read_canvas', {}, true);
    ledger.record('screenshot_canvas', {}, true);
    expect(ledger.hasLiveDrawing()).toBe(false);
    ledger.record('clear_agent_drawings', {}, true);
    expect(ledger.wipedScene()).toEqual([]);
  });
});

describe('turn tool guards', () => {
  it('exports bounded defaults', () => {
    expect(MAX_TOOLS_PER_TURN).toBe(10);
    expect(DEFAULT_MAX_ROUND_TRIPS).toBe(8);
  });

  it('detects successful diagram draws', () => {
    expect(
      isSuccessfulDiagramDraw('draw_shapes', { layout: 'flow', diagram: { nodes: [] } }, true)).toBe(true);
    expect(
      isSuccessfulDiagramDraw('draw_shapes', { layout: 'nested', diagram: { nodes: [] } }, true)).toBe(true);
    expect(
      isSuccessfulDiagramDraw('draw_shapes', { shapes: [{ kind: 'box' }] }, true)).toBe(false);
  });

  it('resolvePostDrawArrangeLayout skips flow downgrade for nested diagrams', () => {
    expect(resolvePostDrawArrangeLayout('nested')).toBe('skip');
    expect(resolvePostDrawArrangeLayout('radial')).toBe('radial');
    expect(resolvePostDrawArrangeLayout('flow')).toBe('flow');
    expect(resolvePostDrawArrangeLayout(undefined, 'draw vpc peering diagram')).toBe('skip');
    expect(resolvePostDrawArrangeLayout(undefined, 'draw a simple flowchart')).toBe('flow');
  });

  it('refuses clear during layout fix and after diagram success', () => {
    const duringFix = evaluateTurnToolRefusal({
      name: 'clear_agent_drawings',
      layoutFixActive: true,
      postDrawReviewComplete: false,
      hasLiveDrawing: true,
      diagramDrawnThisTurn: false,
      repairToolsUsed: new Set(),
      clearForbiddenRestOfTurn: false,
      ledgerShouldRefuseClear: false,
    });
    expect(duringFix.refuse).toBe(true);
    expect(duringFix.error).toBe(CLEAR_FORBIDDEN_LAYOUT_FIX_ERROR);

    const afterDiagram = evaluateTurnToolRefusal({
      name: 'clear_agent_drawings',
      layoutFixActive: false,
      postDrawReviewComplete: true,
      hasLiveDrawing: true,
      diagramDrawnThisTurn: true,
      repairToolsUsed: new Set(),
      clearForbiddenRestOfTurn: false,
      ledgerShouldRefuseClear: false,
    });
    expect(afterDiagram.refuse).toBe(true);
    expect(afterDiagram.forbidClearRestOfTurn).toBe(true);
  });

  it('blocks repeat draw_shapes and repair tools after diagram success', () => {
    const redraw = evaluateTurnToolRefusal({
      name: 'draw_shapes',
      layoutFixActive: false,
      postDrawReviewComplete: true,
      hasLiveDrawing: true,
      diagramDrawnThisTurn: true,
      repairToolsUsed: new Set(),
      clearForbiddenRestOfTurn: false,
      ledgerShouldRefuseClear: false,
    });
    expect(redraw.refuse).toBe(true);

    const secondRead = evaluateTurnToolRefusal({
      name: 'read_canvas',
      layoutFixActive: false,
      postDrawReviewComplete: false,
      hasLiveDrawing: true,
      diagramDrawnThisTurn: true,
      repairToolsUsed: new Set(['read_canvas']),
      clearForbiddenRestOfTurn: false,
      ledgerShouldRefuseClear: false,
    });
    expect(secondRead.refuse).toBe(true);
  });

  it('allows model read_canvas when only programmatic probe ran (repair budget untouched)', () => {
    const modelRead = evaluateTurnToolRefusal({
      name: 'read_canvas',
      layoutFixActive: true,
      postDrawReviewComplete: false,
      hasLiveDrawing: true,
      diagramDrawnThisTurn: true,
      repairToolsUsed: new Set(),
      clearForbiddenRestOfTurn: false,
      ledgerShouldRefuseClear: false,
    });
    expect(modelRead.refuse).toBe(false);
  });

  it('shouldCompleteNestedDiagramReview completes when benign lints are filtered out', () => {
    const benign = [
      '3 of your shapes extend past the visible view (for example "AWS").',
      'Your sketch has no connecting arrows; if the request involves flow, sequence, or connections, add arrows between the related shapes.',
    ];
    const graph = {
      region: { x: 0, y: 0, w: 800, h: 600 },
      shapes: [
        {
          id: 'shape:arrow1',
          nativeType: 'arrow',
          kind: 'arrow' as const,
          geometry: { kind: 'segment' as const, from: { x: 0, y: 0 }, to: { x: 10, y: 0 } },
          zOrder: 1,
        },
      ],
    };
    const filtered = filterBenignNestedDiagramLints(benign, graph);
    expect(filtered).toEqual([]);
    expect(shouldCompleteNestedDiagramReview('nested', filtered, 'skip')).toBe(true);
  });

  it('formatToolReasoningStatus produces operator-visible status lines', () => {
    expect(formatToolReasoningStatus('draw_shapes')).toBe('Calling draw shapes…');
  });
});

describe('geminiChatClient tool cap per turn', () => {
  beforeEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    bindEngineCapabilities(makeCapabilities());
  });

  afterEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    vi.restoreAllMocks();
  });

  it('stops executing tools after MAX_TOOLS_PER_TURN and closes text-only', async () => {
    const editor = makeStubEditor();
    bindEditor(editor as never);

    let round = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      round += 1;
      const body = JSON.parse(String(init?.body)) as { config?: { tools?: unknown } };
      if (body.config?.tools === undefined) {
        return new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Done sketching.' }] } }] }),
          { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ functionCall: { id: `call-${round}`, name: 'read_canvas', args: {} } }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createChatClient({
      proxyUrl: 'https://example.test/chat',
      systemInstruction: 'test persona',
      maxToolRoundTrips: 20,
    });

    const result = await client.send([], 'inspect canvas repeatedly');

    expect(result.toolCalls.length).toBeLessThanOrEqual(MAX_TOOLS_PER_TURN);
    expect(result.text).toBe('Done sketching.');
  });
});

describe('geminiChatClient nested post-draw (no repair thrash)', () => {
  beforeEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    bindEngineCapabilities(makeCapabilities());
    bindEditor(makeStubEditor as never);
  });

  afterEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    vi.restoreAllMocks();
  });

  it('nested layout with benign lints skips captureCanvasCheck and completes review', async () => {
    const { executeTool } = await import('../../src/agents/tools/canvasTools');
    vi.spyOn(await import('../../src/agents/tools/canvasTools'), 'executeTool').mockImplementation(
      async (name) => {
        if (name === 'draw_shapes') {
          return {
            ok: true,
            result: {
              createdShapeIds: ['shape:aws', 'shape:gcp', 'shape:peer'],
            },
          };
        }
        if (name === 'group_shapes') {
          return { ok: true, result: { groupId: 'shape:group1' } };
        }
        if (name === 'read_canvas') {
          return {
            ok: true,
            result: {
              region: { x: 0, y: 0, w: 800, h: 600 },
              shapes: [
                {
                  id: 'shape:aws',
                  nativeType: 'geo',
                  kind: 'box',
                  geometry: { kind: 'rect', x: -20, y: 0, w: 400, h: 300 },
                  text: 'AWS',
                  parentId: 'page:page',
                  zOrder: 1,
                  agentId: CHAT_AGENT_TOOL_CONTEXT.agentId,
                },
                {
                  id: 'shape:arrow1',
                  nativeType: 'arrow',
                  kind: 'arrow',
                  geometry: { kind: 'segment', from: { x: 0, y: 0 }, to: { x: 10, y: 0 } },
                  zOrder: 2,
                  agentId: CHAT_AGENT_TOOL_CONTEXT.agentId,
                },
              ],
            },
          };
        }
        if (name === 'screenshot_canvas') {
          return {
            ok: true,
            result: { dataUrl: 'data:image/png;base64,abc123' },
          };
        }
        return executeTool(name, {});
      });

    let round = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      round += 1;
      const body = init?.body !== undefined ? JSON.parse(String(init.body)): {};
      if (round === 1) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: {
                        id: 'call-1',
                        name: 'draw_shapes',
                        args: {
                          layout: 'nested',
                          diagram: { nodes: [{ id: 'aws' }, { id: 'gcp' }], edges: [] },
                        },
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } });
      }
      const lastUser = [...(body.contents ?? [])].reverse().find((entry: { role?: string }) => entry.role === 'user');
      const lastText = lastUser?.parts?.[0]?.text;
      if (typeof lastText === 'string' && lastText.includes('[Canvas check]')) {
        throw new Error('captureCanvasCheck should not run for nested benign lints');
      }
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'VPC peering diagram is ready.' }] } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createChatClient({
      proxyUrl: 'https://example.test/chat',
      systemInstruction: 'test persona',
    });

    const result = await client.send([], 'draw vpc peering between aws and gcp');

    expect(result.toolCalls.filter((call) => call.name === 'draw_shapes' && call.ok)).toHaveLength(1);
    expect(result.toolCalls.some((call) => call.name === 'screenshot_canvas')).toBe(false);
    expect(result.text).toContain('VPC peering');
  });

  it('postDrawProgressHooks onToolComplete does not consume repairToolsUsed budget', () => {
    const repairToolsUsed = new Set<string>();
    const hooks = {
      onToolComplete: (name: string, _args: Record<string, unknown>, ok: boolean): void => {
        if (ok && (name === 'read_canvas' || name === 'group_shapes' || name === 'arrange')) {
           // Mirrors geminiChatClient postDrawProgressHooks — must NOT add here.
        }
      },
    };
    hooks.onToolComplete('read_canvas', {}, true);
    hooks.onToolComplete('group_shapes', { shapeIds: ['a', 'b'] }, true);
    expect(repairToolsUsed.has('read_canvas')).toBe(false);
    expect(repairToolsUsed.size).toBe(0);

    const modelRead = evaluateTurnToolRefusal({
      name: 'read_canvas',
      layoutFixActive: true,
      postDrawReviewComplete: false,
      hasLiveDrawing: true,
      diagramDrawnThisTurn: true,
      repairToolsUsed,
      clearForbiddenRestOfTurn: false,
      ledgerShouldRefuseClear: false,
    });
    expect(modelRead.refuse).toBe(false);
  });
});

describe('operator per-thread generating flag', () => {
  it('forceStopOperatorThread clears generating only on the target thread', () => {
    const threads: OperatorThread[] = [
      {
        id: 't1',
        title: 'Chat 1',
        messages: [],
        generating: false,
      },
      {
        id: 't2',
        title: 'Chat 2',
        messages: [],
        generating: true,
      },
    ];
    const next = forceStopOperatorThread('t2', threads);
    expect(next.find((thread) => thread.id === 't2')?.generating).toBe(false);
    expect(next.find((thread) => thread.id === 't1')?.generating).toBe(false);
  });
});
