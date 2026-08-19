import { describe, it, expect } from 'vitest';
import {
  DEFAULT_VOICE_GREETING_MODE,
  VOICE_GREETING_MODES,
  parseVoiceGreetingMode,
  resolveConnectGreeting,
} from '../../src/voice/greetingMode';

describe('parseVoiceGreetingMode (SC1)', () => {
  it('accepts agent-first and user-first', () => {
    expect(parseVoiceGreetingMode('agent-first')).toEqual({ ok: true, value: 'agent-first' });
    expect(parseVoiceGreetingMode('user-first')).toEqual({ ok: true, value: 'user-first' });
  });

  it('normalizes casing and whitespace', () => {
    expect(parseVoiceGreetingMode(' Agent-First ')).toEqual({ ok: true, value: 'agent-first' });
  });

  it('defaults empty input to agent-first', () => {
    expect(parseVoiceGreetingMode(undefined)).toEqual({
      ok: true,
      value: DEFAULT_VOICE_GREETING_MODE,
    });
    expect(parseVoiceGreetingMode('')).toEqual({ ok: true, value: 'agent-first' });
  });

  it('rejects invalid enum values', () => {
    const result = parseVoiceGreetingMode('both-first');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('agent-first');
      expect(result.error).toContain('both-first');
    }
  });

  it('exports the canonical mode list', () => {
    expect(VOICE_GREETING_MODES).toEqual(['agent-first', 'user-first']);
  });
});

describe('resolveConnectGreeting', () => {
  it('returns trimmed voiceGreeting in agent-first mode', () => {
    expect(resolveConnectGreeting('agent-first', ' Hello there ')).toBe('Hello there');
  });

  it('returns undefined for user-first even when voiceGreeting is set', () => {
    expect(resolveConnectGreeting('user-first', 'Hello')).toBeUndefined();
  });

  it('returns undefined for agent-first with empty greeting', () => {
    expect(resolveConnectGreeting('agent-first', ' ')).toBeUndefined();
  });
});
