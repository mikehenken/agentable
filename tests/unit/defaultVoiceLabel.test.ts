/**
 * Exhaustive label resolver — every VoiceState produces a defined string.
 * The `never` default branch is the compile-time guard; this is the
 * runtime guard.
 */
import { describe, it, expect } from 'vitest';
import { defaultVoiceLabel } from '../../src/react-canvas/useVoiceCall';
import type { VoiceState } from '../../src/shared/voiceKernel';

const ALL_STATES: VoiceState[] = ['idle', 'connecting', 'listening', 'speaking', 'error'];

describe('defaultVoiceLabel', () => {
  it('returns the idle label for `idle` state', () => {
    expect(defaultVoiceLabel('idle', 'Talk')).toBe('Talk');
  });

  it('uses default idle label when none supplied', () => {
    expect(defaultVoiceLabel('idle')).toBe('Talk');
  });

  it('returns "Connecting…" while connecting', () => {
    expect(defaultVoiceLabel('connecting')).toMatch(/Connecting/);
  });

  it('returns "End call" while listening or speaking', () => {
    expect(defaultVoiceLabel('listening')).toBe('End call');
    expect(defaultVoiceLabel('speaking')).toBe('End call');
  });

  it('returns "Try again" on error', () => {
    expect(defaultVoiceLabel('error')).toBe('Try again');
  });

  it('produces a non-empty string for EVERY state', () => {
    for (const s of ALL_STATES) {
      const label = defaultVoiceLabel(s);
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
