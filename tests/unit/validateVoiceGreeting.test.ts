import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateVoiceGreetingConfig,
  warnVoiceGreetingConfig,
} from '../../src/choreography/validateVoiceGreeting';

describe('validateVoiceGreetingConfig', () => {
  it('returns no issues for user-first with empty greeting', () => {
    const issues = validateVoiceGreetingConfig({
      greetingMode: 'user-first',
      voiceGreeting: '',
    });
    expect(issues).toEqual([]);
  });

  it('returns no issues for agent-first with greeting text', () => {
    const issues = validateVoiceGreetingConfig({
      greetingMode: 'agent-first',
      voiceGreeting: 'Welcome aboard.',
    });
    expect(issues).toEqual([]);
  });

  it('warns on agent-first with empty greeting (SC2)', () => {
    const issues = validateVoiceGreetingConfig(
      {
        assistantName: 'Mason',
        greetingMode: 'agent-first',
        voiceGreeting: '',
      },
      { tenant: 'moss' });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe('AGENT_FIRST_EMPTY_GREETING');
    expect(issues[0]?.message).toContain('agent-first');
    expect(issues[0]?.message).toContain('voiceGreeting is empty');
  });

  it('flags invalid greetingMode from embed document', () => {
    const issues = validateVoiceGreetingConfig(
      { voiceGreeting: 'Hi' },
      { rawGreetingMode: 'invalid-mode' });
    expect(issues.some((i) => i.code === 'GREETING_MODE_INVALID')).toBe(true);
  });

  it('skips empty-greeting warning for generic library default persona', () => {
    const issues = validateVoiceGreetingConfig({
      assistantName: 'Assistant',
      voiceGreeting: '',
    });
    expect(issues).toEqual([]);
  });
});

describe('warnVoiceGreetingConfig', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs agent-first empty greeting warning to console', () => {
    warnVoiceGreetingConfig(
      {
        assistantName: 'Sandy',
        greetingMode: 'agent-first',
        voiceGreeting: '',
      },
      { tenant: 'sandals' });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('greetingMode is "agent-first"'));
  });
});
