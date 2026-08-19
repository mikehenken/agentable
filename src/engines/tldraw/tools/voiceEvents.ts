/** tldraw voice toolbar tool id — toggles Gemini Live via the voice kernel. */
export const VOICE_TOOL_ID = 'voice' as const;

export const WHITEBOARD_VOICE_TOGGLE_EVENT = 'landi-whiteboard-voice-toggle';

/** Notify listeners (optional) when the toolbar voice tool is activated. */
export function emitWhiteboardVoiceToggle(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(WHITEBOARD_VOICE_TOGGLE_EVENT, {
      bubbles: true,
      composed: true,
    }));
}
