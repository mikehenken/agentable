/**
 * Post-draw canvas review — exit gate and layout claim stripping.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCanvasCheckText,
  CANVAS_DRAW_TOOLS,
  CLEAR_FORBIDDEN_LAYOUT_FIX_ERROR,
  runPostDrawExitGate,
  stripFalseLayoutClaims,
} from '../../src/chat/postDrawCanvasReview';
import { CHAT_AGENT_TOOL_CONTEXT } from '../../src/chat/geminiChatClient';
import {
  bindEngineCapabilities,
  resetEngineCapabilitiesForTests,
} from '../../src/agents/engineBridge';
import {
  bindEditor,
  __resetPanelShapeApiForTests__,
} from '../../src/engines/tldraw/shapes/panelShapeApi';
import type { EngineCapabilities } from '../../src/engine/types';
import * as canvasTools from '../../src/agents/tools/canvasTools';

function makeCapabilities(): EngineCapabilities {
  return { frames: true, draw: true, minimap: true, infinitePan: true, nativeSnapshots: true };
}

describe('postDrawCanvasReview', () => {
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

  it('exports CANVAS_DRAW_TOOLS including draw_shapes and arrange', () => {
    expect(CANVAS_DRAW_TOOLS.has('draw_shapes')).toBe(true);
    expect(CANVAS_DRAW_TOOLS.has('arrange')).toBe(true);
    expect(CANVAS_DRAW_TOOLS.has('read_canvas')).toBe(false);
  });

  it('stripFalseLayoutClaims removes clean-layout claims when review incomplete', () => {
    expect(stripFalseLayoutClaims('The diagram looks clean with no overlaps.', false)).toBe(
      'The diagram with.');
    expect(stripFalseLayoutClaims('Done.', true)).toBe('Done.');
  });

  it('buildCanvasCheckText includes lint findings and forbids clear during overlap repair', () => {
    const text = buildCanvasCheckText(['box A overlaps box B'], true);
    expect(text).toContain('Layout checks flagged');
    expect(text).toContain('box A overlaps box B');
    expect(text).toContain('forbidden');
    expect(CLEAR_FORBIDDEN_LAYOUT_FIX_ERROR).toContain('Do not clear');
  });

  it('runPostDrawExitGate skips when no live drawing', async () => {
    const contents: Array<{ role: string; parts?: unknown[] }> = [];
    const result = await runPostDrawExitGate({
      contents: contents as never,
      toolContext: CHAT_AGENT_TOOL_CONTEXT,
      hasLiveDrawing: false,
      postDrawReviewComplete: false,
      canvasChecksLeft: 2,
    });
    expect(result.shouldContinue).toBe(false);
    expect(result.postDrawReviewComplete).toBe(false);
    expect(result.layoutFixActive).toBe(false);
  });

  it('runPostDrawExitGate marks review complete when probe finds no lints', async () => {
    const originalExecute = canvasTools.executeTool;
    vi.spyOn(canvasTools, 'executeTool').mockImplementation(async (name, args) => {
      if (name === 'read_canvas') {
        return {
          ok: true,
          result: {
            region: { x: 0, y: 0, w: 800, h: 600 },
            shapes: [],
          },
        };
      }
      return originalExecute(name, args);
    });

    const toolStarts: string[] = [];
    const result = await runPostDrawExitGate({
      contents: [] as never,
      toolContext: CHAT_AGENT_TOOL_CONTEXT,
      hasLiveDrawing: true,
      postDrawReviewComplete: false,
      canvasChecksLeft: 2,
      hooks: {
        onToolStart: (name) => {
          toolStarts.push(name);
        },
      },
    });

    expect(toolStarts).toEqual(['read_canvas']);
    expect(result.shouldContinue).toBe(false);
    expect(result.postDrawReviewComplete).toBe(true);
  });

  it('runPostDrawExitGate injects canvas check and continues when lints remain', async () => {
    vi.spyOn(canvasTools, 'executeTool').mockImplementation(async (name) => {
      if (name === 'read_canvas') {
        return {
          ok: true,
          result: {
            region: { x: 0, y: 0, w: 800, h: 600 },
            shapes: [
              {
                id: 'shape:a',
                nativeType: 'geo',
                kind: 'box',
                geometry: { kind: 'rect', x: 0, y: 0, w: 100, h: 40 },
                text: 'AWS',
                zOrder: 1,
                agentId: CHAT_AGENT_TOOL_CONTEXT.agentId,
              },
              {
                id: 'shape:b',
                nativeType: 'geo',
                kind: 'box',
                geometry: { kind: 'rect', x: 10, y: 10, w: 100, h: 40 },
                text: 'GCP',
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
      return { ok: false, error: 'unexpected tool' };
    });

    const contents: Array<{ role: string; parts?: Array<{ text?: string }> }> = [];
    const result = await runPostDrawExitGate({
      contents: contents as never,
      toolContext: CHAT_AGENT_TOOL_CONTEXT,
      hasLiveDrawing: true,
      postDrawReviewComplete: false,
      canvasChecksLeft: 2,
    });

    expect(result.shouldContinue).toBe(true);
    expect(result.canvasChecksLeft).toBe(1);
    expect(result.layoutFixActive).toBe(true);
    expect(contents.length).toBe(1);
    expect(contents[0]?.parts?.[0]?.text).toContain('[Canvas check]');
  });
});

describe('geminiChatClient post-draw hard gate', () => {
  beforeEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    bindEngineCapabilities(makeCapabilities());
    bindEditor({
      getCurrentPageId: vi.fn(() => 'page:page'),
      getShape: vi.fn(),
      createShape: vi.fn(),
      deleteShapes: vi.fn(),
      getShapePageBounds: vi.fn(),
      getCurrentPageShapes: vi.fn(() => []),
      getViewportPageBounds: vi.fn(() => ({ x: 0, y: 0, w: 1200, h: 800 })),
    } as never);
  });

  afterEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    vi.restoreAllMocks();
  });

  it('runs programmatic read_canvas before accepting final text after draw_shapes', async () => {
    const { createChatClient } = await import('../../src/chat/geminiChatClient');

    vi.spyOn(canvasTools, 'executeTool').mockImplementation(async (name, args) => {
      if (name === 'draw_shapes') {
        return { ok: true, result: { createdShapeIds: ['shape:box1', 'shape:box2'] } };
      }
      if (name === 'group_shapes') {
        return { ok: true, result: { groupId: 'shape:group1' } };
      }
      if (name === 'read_canvas') {
        return {
          ok: true,
          result: {
            region: { x: 0, y: 0, w: 800, h: 600 },
            shapes: [],
          },
        };
      }
      if (name === 'screenshot_canvas') {
        return {
          ok: true,
          result: { dataUrl: 'data:image/png;base64,abc123' },
        };
      }
      return { ok: false, error: `unexpected ${name}` };
    });

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
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'VPC peering diagram is on the canvas.' }] } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const progressEvents: Array<{ type: string; name?: string }> = [];
    const client = createChatClient({
      proxyUrl: 'https://example.test/chat',
      systemInstruction: 'test persona',
    });

    const result = await client.send([], 'draw vpc peering', {
      onProgress: (event) => {
        if (event.type === 'tool-start' || event.type === 'tool-complete') {
          progressEvents.push({ type: event.type, name: event.name });
        }
      },
    });

    expect(result.toolCalls.some((call) => call.name === 'draw_shapes' && call.ok)).toBe(true);
    expect(result.toolCalls.some((call) => call.name === 'group_shapes' && call.ok)).toBe(true);
    expect(result.toolCalls.some((call) => call.name === 'read_canvas' && call.ok)).toBe(true);
    expect(progressEvents.some((event) => event.name === 'read_canvas')).toBe(true);
    expect(progressEvents.some((event) => event.name === 'group_shapes')).toBe(true);
    expect(result.text).toContain('VPC peering');
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
