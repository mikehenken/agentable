/**
 * integration: operator-mode enforcement is agent-scoped so scoped chat
 * agents coexist with the canvas-wide operator on the same page session.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createChatClient, CHAT_AGENT_TOOL_CONTEXT } from '../../src/chat/geminiChatClient';
import {
  bindEngineCapabilities,
  resetEngineCapabilitiesForTests,
} from '../../src/agents/engineBridge';
import {
  bindOperatorModeEnforcement,
  resetOperatorModeBridgeForTests,
  unbindOperatorModeEnforcement,
} from '../../src/agents/surface/operatorModeBridge';
import {
  bindOperatorRegistration,
  OPERATOR_TOOL_CONTEXT,
  resetOperatorRegistrationBridgeForTests,
  unbindOperatorRegistration,
} from '../../src/agents/surface/operatorRegistrationBridge';
import { OPERATOR_AGENT_ID } from '../../src/agents/surface/constants';
import { withAgentToolContextAsync } from '../../src/agents/agentContext';
import { getFunctionDeclarations } from '../../src/agents/tools/canvasTools';
import type { EngineCapabilities } from '../../src/engine/types';

function makeCapabilities(): EngineCapabilities {
  return { frames: true, draw: true, minimap: true, infinitePan: true, nativeSnapshots: true };
}

describe('operator mode chat path coexistence', () => {
  beforeEach(() => {
    resetOperatorModeBridgeForTests();
    resetOperatorRegistrationBridgeForTests();
    resetEngineCapabilitiesForTests();
    bindEngineCapabilities(makeCapabilities());
    bindOperatorModeEnforcement('ask');
    bindOperatorRegistration('ask');
  });

  afterEach(() => {
    unbindOperatorRegistration();
    unbindOperatorModeEnforcement();
    resetOperatorRegistrationBridgeForTests();
    resetOperatorModeBridgeForTests();
    resetEngineCapabilitiesForTests();
    vi.restoreAllMocks();
  });

  it('does not filter chat tool offers when operator surface is mounted', () => {
    const names = getFunctionDeclarations().map((entry) => entry.name);
    expect(names).toContain('draw_shapes');
    expect(names).toContain('open_chat');
  });

  it('filters operator tool offers when building declarations for the operator agent', () => {
    const names = getFunctionDeclarations({ agentId: OPERATOR_AGENT_ID }).map((entry) => entry.name);
    expect(names).toContain('knowledge_search');
    expect(names).not.toContain('fill_panel');
    expect(names).not.toContain('draw_shapes');
  });

  it('allows scoped chat agent tool calls while operator ask mode is bound', async () => {
    const canvasTools = await import('../../src/agents/tools/canvasTools');
    const executeToolSpy = vi.spyOn(canvasTools, 'executeTool').mockResolvedValue({ ok: true, result: 'scoped agent ok' });

    let round = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
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
                        id: 'call-draw',
                        name: 'draw_shapes',
                        args: { shapes: [{ type: 'rectangle', x: 0, y: 0, w: 10, h: 10 }] },
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } });
      }

      const body = JSON.parse(String(init?.body)) as {
        contents?: Array<{ parts?: Array<{ functionResponse?: { response?: { error?: string } } }> }> };
      const errorPart = body.contents
        ?.flatMap((entry) => entry.parts ?? []).find((part) => part.functionResponse?.response?.error !== undefined);
      expect(errorPart?.functionResponse?.response?.error).toBeUndefined();

      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'Drew on the canvas.' }] } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createChatClient({
      proxyUrl: 'https://example.test/chat',
      systemInstruction: 'test persona',
    });

    const result = await client.send([], 'draw a rectangle on the canvas');
    expect(executeToolSpy).toHaveBeenCalledWith(
      'draw_shapes',
      expect.objectContaining({ shapes: expect.any(Array) }));
    // draw_shapes triggers the post-draw review, which reads the canvas back
    // (draw -> see); both run under the scoped chat agent context.
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0]?.name).toBe('draw_shapes');
    expect(result.toolCalls[0]?.ok).toBe(true);
    expect(result.toolCalls[1]?.name).toBe('read_canvas');
    expect(CHAT_AGENT_TOOL_CONTEXT.agentId).toBe('agentable-chat-agent');

    executeToolSpy.mockRestore();
  });

  it('denies operator-context draw_shapes through executeTool when Ask mode is bound', async () => {
    const { executeTool } = await import('../../src/agents/tools/canvasTools');
    const denied = await withAgentToolContextAsync(OPERATOR_TOOL_CONTEXT, async () =>
      executeTool('draw_shapes', { shapes: [] }));
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error).toContain('operator mode "ask"');
  });
});
