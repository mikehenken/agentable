import { describe, it, expect } from 'vitest';
import {
  mapAiPersonaState,
  parseAiPersonaVisualConfig,
} from '../../src/components/ai-persona';
import {
  CAREER_WHITEBOARD_TOOLBAR_DEFAULTS,
} from '../../src/engines/tldraw/toolbar/toolbarConfig';
import { VOICE_TOOL_ID } from '../../src/engines/tldraw/tools/voiceEvents';
import { VOICE_TOOL_ICON_ID } from '../../src/engines/tldraw/voice/voiceToolbarIcon';

describe('mapAiPersonaState', () => {
  it('maps voice lifecycle to persona states', () => {
    expect(mapAiPersonaState({ voiceState: 'idle' })).toBe('idle');
    expect(mapAiPersonaState({ voiceState: 'connecting' })).toBe('thinking');
    expect(mapAiPersonaState({ voiceState: 'listening' })).toBe('listening');
    expect(mapAiPersonaState({ voiceState: 'speaking' })).toBe('speaking');
    expect(mapAiPersonaState({ voiceState: 'error' })).toBe('idle');
  });

  it('prefers asleep when idle and preferAsleepWhenIdle is set', () => {
    expect(
      mapAiPersonaState({ voiceState: 'idle', preferAsleepWhenIdle: true })).toBe('asleep');
  });

  it('maps chat awaiting reply to thinking when voice is idle', () => {
    expect(
      mapAiPersonaState({ voiceState: 'idle', isAwaitingReply: true })).toBe('thinking');
  });

  it('honours explicit override', () => {
    expect(
      mapAiPersonaState({
        voiceState: 'listening',
        override: 'asleep',
      })).toBe('asleep');
  });
});

describe('parseAiPersonaVisualConfig', () => {
  it('parses sandals career visual defaults', () => {
    expect(
      parseAiPersonaVisualConfig({
        type: 'halo',
        showInChat: true,
        showInHeader: true,
      })).toEqual({
      type: 'halo',
      showInChat: true,
      showInHeader: true,
    });
  });

  it('rejects invalid payloads', () => {
    expect(parseAiPersonaVisualConfig(null)).toBeNull();
    expect(parseAiPersonaVisualConfig({})).toBeNull();
    expect(parseAiPersonaVisualConfig({ type: '' })).toBeNull();
  });
});

describe('career toolbar voice tool', () => {
  it('includes voice in default career toolbar config', () => {
    expect(CAREER_WHITEBOARD_TOOLBAR_DEFAULTS).toContain(VOICE_TOOL_ID);
    expect(VOICE_TOOL_ICON_ID).toBe('microphone');
  });
});
