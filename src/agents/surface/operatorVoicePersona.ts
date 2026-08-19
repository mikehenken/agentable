/**
 * Resolve voice persona for operator-surface Gemini Live mount.
 * Operator shell sits outside CanvasProvider — read whiteboard embed attributes.
 */
import { resolveWhiteboardChatCredentials } from '../../chat/whiteboardChatCredentials';
import type { VoicePersonaConfig } from '../../voice/geminiLiveClient';

const DEFAULT_OPERATOR_VOICE_PROMPT =
  'You are the canvas-wide operator agent. Respect Ask/Build/Draw mode tool scope. Be concise on voice.';

export function resolveOperatorVoicePersona(): VoicePersonaConfig {
  const creds = resolveWhiteboardChatCredentials();
  const whiteboard = document.querySelector('agentable-whiteboard');
  const attrPrompt = whiteboard?.getAttribute('system-prompt')?.trim() ?? '';
  const systemPrompt =
    attrPrompt.length > 0
      ? `${DEFAULT_OPERATOR_VOICE_PROMPT}\n\n${attrPrompt}`
      : creds.systemInstruction.length > 0
        ? `${DEFAULT_OPERATOR_VOICE_PROMPT}\n\n${creds.systemInstruction}`
        : DEFAULT_OPERATOR_VOICE_PROMPT;

  const voiceGreeting = whiteboard?.getAttribute('voice-greeting')?.trim() || undefined;
  const greetingMode = whiteboard?.getAttribute('voice-greeting-mode')?.trim() || undefined;

  return {
    systemPrompt,
    voiceGreeting,
    greetingMode: greetingMode === 'user-first' || greetingMode === 'agent-first'
      ? greetingMode
      : undefined,
  };
}
