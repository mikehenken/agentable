/**
 * 
 * Shared voice transcript merge for chat surfaces (D44).
 *
 * Coalesces incremental Gemini Live fragments into one bubble per role
 * within a 1.5s window — same policy as ChatPanel's window-event path.
 */
import type { 
  ChatMessage 
} from '../chat/geminiChatClient';

export interface VoiceTranscriptDetail {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export function applyVoiceTranscriptToMessages(
  prev: readonly ChatMessage[],
  detail: VoiceTranscriptDetail,
): ChatMessage[] {
  if (!detail.text.trim()) {
    return [
      ...prev
    ];
  }
  const last = prev[prev.length - 1];
  const now = Date.now();
  const lastTime = last ? new Date(last.createdAt).getTime() : 0;
  if (
    last &&
    last.source === 'voice' &&
    last.role === detail.role &&
    now - lastTime < 1500
  ) {
    return prev.map((message, index) =>
      index === prev.length - 1
        ? {
            ...message,
            text: `${message.text} ${detail.text}`.trim(),
            createdAt: detail.timestamp,
          }
        : message,
    );
  }
  return [
    ...prev,
    {
      id: `voice-${detail.role}-${now.toString(36)}`,
      role: detail.role,
      text: detail.text,
      source: 'voice',
      createdAt: detail.timestamp,
    },
  ];
}
