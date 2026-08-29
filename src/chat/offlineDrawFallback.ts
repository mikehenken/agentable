/**
 * Deterministic offline chat-to-draw fallback.
 *
 * `ChatPanel` falls back to this when no live chat client resolves (no
 * `chatProxyUrl` and no dev API key configured, see `ChatPanel.tsx`). The
 * old behavior returned a static mock string. That is misleading for a
 * "chat-to-draw" product surface: a visitor without a live endpoint
 * configured should still see the draw pipeline actually work end to end,
 * not just read a placeholder sentence.
 *
 * Draws one deterministic, on-brand `draw_shapes` call built for this page:
 * a hand-composed launch-sequence sketch matching the "Sketch a 3-stage
 * launch-sequence flow" starter prompt (see
 * `src/chat/fixtures/apogeeAerospace.ts`). Earlier drafts
 * of this module reused the unrelated P8 "agent draw and see" demo's
 * Northstar Atelier fixtures, which drew a creative-agency workflow and an
 * internal implementation string ("Agent-stamped marks carry
 * meta.agentableAgent") onto this aerospace-systems page, and then a
 * follow-up draft used the auto-layout diagram compiler with fixed-size
 * boxes that overflowed their labels. This module now draws a dedicated,
 * hand-sized, explicit-shapes fixture instead of either.
 *
 * Executes through the same `executeTool('draw_shapes', ...)` path the live
 * Gemini clients use, bound to the same `CHAT_AGENT_TOOL_CONTEXT` used by
 * `geminiChatClient.ts`, so provenance stamping and tool-call telemetry stay
 * consistent whichever path drew a mark.
 *
 * When the mounted engine has no draw capability (most gallery examples use
 * the legacy CanvasShell substrate, not the tldraw whiteboard), drawing a
 * shape is meaningless, so this falls back to the previous plain-text
 * "not configured" notice instead of attempting a draw that would only
 * return a capability refusal.
 */
import { APOGEE_LAUNCH_SEQUENCE_SHAPES } from './fixtures/apogeeAerospace';
import { withAgentToolContextAsync } from '../agents/agentContext';
import { isDrawCapabilityAvailable } from '../agents/engineBridge';
import { executeTool } from '../agents/tools/canvasTools';
// Import the event name from the constants module directly (not the
// choreography barrel, which re-exports engine-specific helpers) so the
// engine-agnostic chat layer stays free of any tldraw import.
import { FIT_AGENT_DRAWING_EVENT } from '../choreography/constants';
import { CHAT_AGENT_TOOL_CONTEXT } from './geminiChatClient';

export interface OfflineDrawFallbackToolCall {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
}

export interface OfflineDrawFallbackResult {
  /** Assistant-facing text to append to the transcript. */
  text: string;
  /** Tool calls executed during the fallback, in order. */
  toolCalls: OfflineDrawFallbackToolCall[];
}

const NOT_CONFIGURED_TEXT =
  '(Chat is not configured for this preview. Set VITE_LANDI_CHAT_PROXY_URL, VITE_GEMINI_API_KEY, or a persona chatProxyUrl for live responses.)';

/**
 * Execute one tool call bound to the chat agent context, then mirror it via
 * the same `landi:tool-call` window event the live clients dispatch, so
 * `ChatPanel`'s existing tool-call listener renders the inline echo card
 * without this module needing to know anything about chat UI state.
 */
async function runOfflineTool(
  name: string,
  args: Record<string, unknown>,
): Promise<OfflineDrawFallbackToolCall> {
  const result = await withAgentToolContextAsync(CHAT_AGENT_TOOL_CONTEXT, () =>
    executeTool(name, args),
  );
  window.dispatchEvent(
    new CustomEvent('landi:tool-call', {
      detail: { name, args, ok: result.ok, source: 'chat' },
      bubbles: true,
      composed: true,
    }),
  );
  return { name, args, ok: result.ok };
}

/**
 * Run the deterministic offline draw fallback. Safe to call repeatedly:
 * clears the fallback's own prior marks first (scoped to
 * `CHAT_AGENT_TOOL_CONTEXT.agentId`) so retyping a message redraws the same
 * fixture instead of stacking additional copies on the canvas.
 */
export async function runOfflineDrawFallback(): Promise<OfflineDrawFallbackResult> {
  if (!isDrawCapabilityAvailable()) {
    return { text: NOT_CONFIGURED_TEXT, toolCalls: [] };
  }

  const toolCalls: OfflineDrawFallbackToolCall[] = [];

  toolCalls.push(
    // scope 'all': the default 'currentTurn' reads the chat turn ledger,
    // which offline mode never populates — without it a retyped message
    // stacks a second copy of the sketch instead of redrawing.
    await runOfflineTool('clear_agent_drawings', {
      agentId: CHAT_AGENT_TOOL_CONTEXT.agentId,
      scope: 'all',
    }),
  );

  const drawArgs: Record<string, unknown> = {
    shapes: APOGEE_LAUNCH_SEQUENCE_SHAPES,
  };
  const drawCall = await runOfflineTool('draw_shapes', drawArgs);
  toolCalls.push(drawCall);

  if (drawCall.ok) {
    // Reveal the whole sketch. The hand-composed launch sequence is wider
    // than the default viewport, and the chat panel covers the canvas's
    // left half, so without this the visitor only sees the first node or
    // two. The tldraw shell listens for this event and zooms to fit the
    // marks stamped with this agent id. Dispatched only on the offline demo
    // path; the live persona lays diagrams out within the current viewport.
    window.dispatchEvent(
      new CustomEvent(FIT_AGENT_DRAWING_EVENT, {
        detail: { agentId: CHAT_AGENT_TOOL_CONTEXT.agentId },
      }),
    );
  }

  const ok = drawCall.ok;
  const text = ok
    ? 'Offline demo mode: no live chat endpoint is configured, so here is a deterministic sample sketch instead of a real answer. Connect a chatProxyUrl or a dev API key for live responses.'
    : 'Offline demo mode: no live chat endpoint is configured, and the sample sketch could not be drawn on this canvas. Connect a chatProxyUrl or a dev API key for live responses.';

  return { text, toolCalls };
}
