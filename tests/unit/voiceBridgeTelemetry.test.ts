import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  bindVoiceTelemetry,
  resetVoiceTelemetrySessionCounterForTests,
} from '../../src/telemetry/voiceBridge';
import { ensureVoiceKernel, __resetKernelForTests__ } from '../../src/shared/voiceKernel';
import type { VoiceTelemetryEvent } from '../../src/telemetry/types';

describe('bindVoiceTelemetry', () => {
  beforeEach(() => {
    __resetKernelForTests__();
    resetVoiceTelemetrySessionCounterForTests();
  });

  it('emits a connected event carrying a string session id (regression: sessionId was invoked as a function)', () => {
    const emit = vi.fn();
    const unsubscribe = bindVoiceTelemetry(emit);
    const kernel = ensureVoiceKernel();

    kernel.voice._publish({ state: 'connecting' });
    kernel.voice._publish({ state: 'listening' });

    expect(emit).toHaveBeenCalledTimes(1);
    const event = emit.mock.calls[0][0] as VoiceTelemetryEvent;
    expect(event.family).toBe('voice');
    expect(event.outcome).toBe('connected');
    expect(event.sessionId).toBe('voice-1');

    unsubscribe();
  });

  it('emits an error event with error codes and the same session id', () => {
    const emit = vi.fn();
    const unsubscribe = bindVoiceTelemetry(emit);
    const kernel = ensureVoiceKernel();

    kernel.voice._publish({ state: 'connecting' });
    kernel.voice._publish({ state: 'error', errorMessage: 'connect failed' });

    const events = emit.mock.calls.map((call) => call[0] as VoiceTelemetryEvent);
    const errorEvent = events.find((event) => event.outcome === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.sessionId).toBe('voice-1');
    expect(errorEvent!.errorCodes).toEqual(['VOICE_CONNECT_FAILED']);

    unsubscribe();
  });
});
