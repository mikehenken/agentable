import { useMemo } from 'react';
import { useVoiceCall } from '../../hooks/useVoiceCall';
import { mapAiPersonaState, type MapAiPersonaStateInput } from './mapPersonaState';
import type { AiPersonaState } from './types';

export interface UseAiPersonaStateOptions {
  isAwaitingReply?: boolean;
  preferAsleepWhenIdle?: boolean;
  override?: AiPersonaState;
}

/**
 * Live AiPersona state from the voice kernel (+ optional chat awaiting).
 */
export function useAiPersonaState(options: UseAiPersonaStateOptions = {}): {
  state: AiPersonaState;
  level: number;
  voiceState: ReturnType<typeof useVoiceCall>['state'];
} {
  const voice = useVoiceCall();
  const state = useMemo(
    () =>
      mapAiPersonaState({
        voiceState: voice.state,
        isAwaitingReply: options.isAwaitingReply,
        preferAsleepWhenIdle: options.preferAsleepWhenIdle,
        override: options.override,
      } satisfies MapAiPersonaStateInput),
    [
      voice.state,
      options.isAwaitingReply,
      options.preferAsleepWhenIdle,
      options.override,
    ],
  );

  return {
    state,
    level: voice.level,
    voiceState: voice.state,
  };
}
