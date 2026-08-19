/** Reserved panel id for the active chat surface (02 section 10). */
export const CHAT_PANEL_ID = 'chat';

/** User-visible prompt handback: inserts text and focuses chat. */
export const CHAT_PROMPT_EVENT = 'landi:chat-prompt';

/** Restore surface the chat panel before handback. */
export const OPEN_CHAT_EVENT = 'agentable:open-chat';

/** Focus the chat composer without sending (existing contract). */
export const FOCUS_CHAT_INPUT_EVENT = 'landi:focus-chat-input';

/**
 * Append a message to the chat transcript without invoking the LLM or
 * toggling the Thinking state. Used by scripted gallery demos (P8).
 */
export const CHAT_TRANSCRIPT_INJECT_EVENT = 'landi:chat-transcript-inject';

/**
 * Ask the mounted drawing engine to zoom its camera to fit every mark an
 * agent just drew. `detail.agentId` scopes the fit to that agent's shapes
 * (matched on the `agentableAgent` provenance meta key). Engine-neutral: the
 * chat layer dispatches it, the tldraw shell handles it, and a DOM engine
 * with no camera simply has no listener. Used by the offline chat-to-draw
 * demo, whose hand-composed sketch is wider than the default viewport.
 */
export const FIT_AGENT_DRAWING_EVENT = 'agentable:fit-agent-drawing';

export function isChatPanelId(panelId: string): boolean {
  return panelId === CHAT_PANEL_ID;
}
