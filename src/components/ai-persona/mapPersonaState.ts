import type { VoiceState } from '../../shared/voiceKernel';
import type { AiPersonaState } from './types';

export interface MapAiPersonaStateInput {
  /** Voice kernel transport state. */
  voiceState?: VoiceState;
  /** True while a text chat reply is in flight. */
  isAwaitingReply?: boolean;
  /**
   * When true and voice is idle, map to `asleep` (resting) instead of `idle`.
   * Useful for header chrome after a call ends; chat empty state usually wants `idle`.
   */
  preferAsleepWhenIdle?: boolean;
  /** Explicit override wins over derived mapping. */
  override?: AiPersonaState;
}

/**
 * Map voice + chat lifecycle → AiPersona animation state.
 *
 * Priority: override → voice active states → chat thinking → idle/asleep.
 */
export function mapAiPersonaState(input: MapAiPersonaStateInput = {}): AiPersonaState {
  if (input.override) return input.override;

  const voice = input.voiceState ?? 'idle';
  switch (voice) {
    case 'connecting':
      return 'thinking';
    case 'listening':
      return 'listening';
    case 'speaking':
      return 'speaking';
    case 'error':
      return input.preferAsleepWhenIdle ? 'asleep': 'idle';
    case 'idle':
      break;
    default: {
      const _exhaustive: never = voice;
      return _exhaustive;
    }
  }

  if (input.isAwaitingReply) return 'thinking';
  return input.preferAsleepWhenIdle ? 'asleep': 'idle';
}

/** Parse/normalize a config visual block; invalid payloads → null. */
export function parseAiPersonaVisualConfig(raw: unknown): import('./types').AiPersonaVisualConfig | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const type = typeof record.type === 'string' ? record.type.trim() : '';
  if (!type) return null;
  const config: import('./types').AiPersonaVisualConfig = { type };
  if (typeof record.showInChat === 'boolean') config.showInChat = record.showInChat;
  if (typeof record.showInHeader === 'boolean') config.showInHeader = record.showInHeader;
  return config;
}
