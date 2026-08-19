/**
 * Voice kernel → host.telemetry bridge (D55 / P15-T2).
 */
import { ensureVoiceKernel, type VoiceState } from '../shared/voiceKernel';
import { buildVoiceTelemetryEvent, type TelemetryEmit } from './emit';
import type { VoiceTelemetryOutcome } from './types';

let voiceSessionCounter = 0;

function nextVoiceSessionId(): string {
  voiceSessionCounter += 1;
  return `voice-${voiceSessionCounter}`;
}

function mapVoiceTransition(
  previous: VoiceState,
  next: VoiceState): VoiceTelemetryOutcome | null {
  if (next === 'listening' && previous === 'connecting') {
    return 'connected';
  }
  if (next === 'error') {
    return 'error';
  }
  if (next === 'connecting' && previous === 'error') {
    return 'reconnected';
  }
  if (next === 'idle' && (previous === 'listening' || previous === 'speaking' || previous === 'error')) {
    return 'dropped';
  }
  return null;
}

function voiceErrorCodesForState(
  outcome: VoiceTelemetryOutcome,
  errorMessage: string | undefined): readonly ['VOICE_CONNECT_FAILED'] | readonly ['VOICE_RECONNECT_EXHAUSTED'] | undefined {
  if (outcome !== 'error' && outcome !== 'dropped') {
    return undefined;
  }
  if (errorMessage !== undefined && errorMessage.toLowerCase().includes('reconnect')) {
    return ['VOICE_RECONNECT_EXHAUSTED'];
  }
  if (outcome === 'error') {
    return ['VOICE_CONNECT_FAILED'];
  }
  return undefined;
}

/**
 * Subscribe to the shared voice kernel and emit structured voice telemetry.
 * Returns an unsubscribe function.
 */
export function bindVoiceTelemetry(emit: TelemetryEmit): () => void {
  const kernel = ensureVoiceKernel();
  let previousState = kernel.voice.getSnapshot().state;
  let sessionId = nextVoiceSessionId();

  return kernel.voice.subscribe((snapshot) => {
    const outcome = mapVoiceTransition(previousState, snapshot.state);
    if (outcome === 'connected' && previousState === 'idle') {
      sessionId = nextVoiceSessionId();
    }
    previousState = snapshot.state;

    if (outcome === null) {
      return;
    }

    emit(
      buildVoiceTelemetryEvent({
        outcome,
        sessionId: sessionId(),
        errorCodes: voiceErrorCodesForState(outcome, snapshot.errorMessage),
      }));
  });
}

/** Test-only reset for deterministic session ids. */
export function resetVoiceTelemetrySessionCounterForTests(): void {
  voiceSessionCounter = 0;
}
