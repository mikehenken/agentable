/**
 * Voice-path parity for the agent tool context binding fix (iteration 2).
 *
 * Mocks `@google/genai` so `ai.live.connect(...)` resolves synchronously and
 * captures the `callbacks` object passed to it, in particular `onmessage`
 * (this is the same closure geminiLiveClient.ts wires up as
 * `handleServerMessage`). The test then invokes that captured callback
 * directly with a synthetic tool-call message - no real WebSocket,
 * microphone, or AudioContext required - to exercise the real tool-execution
 * loop end to end.
 *
 * `client.start` is expected to fail later at the microphone step in this
 * DOM-less test environment; that happens after `ai.live.connect` has
 * already run and captured the callback, so it does not affect this test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveServerMessage } from '@google/genai';

interface CapturedCallbacks {
  onopen?: () => void;
  onmessage?: (msg: LiveServerMessage) => void;
  onerror?: (e: unknown) => void;
  onclose?: () => void;
}

let capturedCallbacks: CapturedCallbacks = {};

vi.mock('@google/genai', () => {
  class FakeGoogleGenAI {
    live = {
      connect: vi.fn(async (config: { callbacks: CapturedCallbacks }) => {
        capturedCallbacks = config.callbacks;
        return {
          close: vi.fn(),
          sendClientContent: vi.fn(),
          sendRealtimeInput: vi.fn(),
          sendToolResponse: vi.fn(),
        };
      }),
    };
    constructor(_options: unknown) {
      void _options;
    }
  }
  return { GoogleGenAI: FakeGoogleGenAI, Modality: { AUDIO: 'AUDIO' } };
});

import { createVoiceClient, VOICE_AGENT_TOOL_CONTEXT } from '../../src/voice/geminiLiveClient';
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
}

function makeCapabilities(): EngineCapabilities {
  return { frames: true, draw: true, minimap: true, infinitePan: true, nativeSnapshots: true };
}

function makeStubEditor() {
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

describe('geminiLiveClient tool-execution agent context binding (voice parity)', () => {
  beforeEach(() => {
    capturedCallbacks = {};
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    bindEngineCapabilities(makeCapabilities());
  });

  afterEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    vi.restoreAllMocks();
  });

  it('binds VOICE_AGENT_TOOL_CONTEXT around executeTool so draw_shapes succeeds instead of throwing "agent tool context is required"', async () => {
    const editor = makeStubEditor();
    bindEditor(editor as never);

    const onToolCall = vi.fn();
    const client = createVoiceClient('dev-key', { systemPrompt: 'test persona' }, { onToolCall });

    await client.start().catch(() => {
      // Expected: getUserMedia is unavailable in this test environment.
      // ai.live.connect already resolved and captured onmessage by then.
    });

    expect(capturedCallbacks.onmessage).toBeTypeOf('function');

    await capturedCallbacks.onmessage!({
      toolCall: {
        functionCalls: [
          {
            id: 'call-1',
            name: 'draw_shapes',
            args: {
              shapes: [{ kind: 'box', geometry: { kind: 'rect', x: 0, y: 0, w: 80, h: 40 } }],
            },
          },
        ],
      },
    } as unknown as LiveServerMessage);

    expect(onToolCall).toHaveBeenCalledTimes(1);
    expect(onToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'draw_shapes', ok: true }));
    expect(editor.createShape).toHaveBeenCalledTimes(1);
    const created = editor.createShape.mock.calls[0][0];
    expect(readShapeProvenance(created)).toBe(VOICE_AGENT_TOOL_CONTEXT.agentId);
    expect(getAgentToolContext).toBeNull();
  });

  it('executes a batch of tool calls sequentially rather than firing them all at once', async () => {
    const editor = makeStubEditor();
    bindEditor(editor as never);

    const client = createVoiceClient('dev-key', { systemPrompt: 'test persona' }, {});
    await client.start().catch(() => {});
    expect(capturedCallbacks.onmessage).toBeTypeOf('function');

    await capturedCallbacks.onmessage!({
      toolCall: {
        functionCalls: [
          {
            id: 'call-1',
            name: 'draw_shapes',
            args: {
              shapes: [{ kind: 'box', geometry: { kind: 'rect', x: 0, y: 0, w: 40, h: 40 } }],
            },
          },
          {
            id: 'call-2',
            name: 'draw_shapes',
            args: {
              shapes: [{ kind: 'box', geometry: { kind: 'rect', x: 60, y: 0, w: 40, h: 40 } }],
            },
          },
        ],
      },
    } as unknown as LiveServerMessage);

    expect(editor.createShape).toHaveBeenCalledTimes(2);
    for (const call of editor.createShape.mock.calls) {
      expect(readShapeProvenance(call[0] as never)).toBe(VOICE_AGENT_TOOL_CONTEXT.agentId);
    }
    expect(getAgentToolContext).toBeNull();
  });
});
