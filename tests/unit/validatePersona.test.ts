import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validatePersonaStarterPrompts,
  warnPersonaStarterPrompts,
} from '../../src/choreography/validatePersona';

describe('validatePersonaStarterPrompts', () => {
  it('returns no issues when starterPrompts are populated', () => {
    const issues = validatePersonaStarterPrompts({
      assistantName: 'Mason',
      voiceGreeting: 'Hi there',
      starterPrompts: [{ emoji: '💼', text: 'Show me jobs' }],
    });
    expect(issues).toEqual([]);
  });

  it('returns no issues for generic default persona', () => {
    const issues = validatePersonaStarterPrompts({
      assistantName: 'Assistant',
    });
    expect(issues).toEqual([]);
  });

  it('warns when custom persona lacks starterPrompts (helios regression)', () => {
    const issues = validatePersonaStarterPrompts(
      {
        assistantName: 'Mason',
        voiceGreeting: 'Welcome to Helios careers',
      },
      { tenant: 'helios', welcomeMessage: 'Try one of these prompts' });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe('STARTER_PROMPTS_EMPTY');
    expect(issues[0]?.message).toContain('starterPrompts is empty');
  });
});

describe('warnPersonaStarterPrompts', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs persona validation warning to console', () => {
    warnPersonaStarterPrompts(
      { assistantName: 'Sandy', voiceGreeting: 'Hello' },
      { tenant: 'archipelago' });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('persona validation'));
  });
});
