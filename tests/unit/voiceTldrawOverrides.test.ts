import { describe, it, expect, vi } from 'vitest';
import { voiceTldrawOverrides } from '../../src/engines/tldraw/voiceTldrawOverrides';
import { VOICE_TOOL_ID } from '../../src/engines/tldraw/tools/voiceEvents';
import {
  VOICE_TOOL_ICON_ID,
  whiteboardVoiceAssetUrls,
} from '../../src/engines/tldraw/voice/voiceToolbarIcon';
import { CAREER_WHITEBOARD_TOOLBAR_DEFAULTS } from '../../src/engines/tldraw/toolbar/toolbarConfig';

describe('voice toolbar tool', () => {
  it('career defaults include the voice tool id', () => {
    expect(CAREER_WHITEBOARD_TOOLBAR_DEFAULTS).toContain(VOICE_TOOL_ID);
    expect([...CAREER_WHITEBOARD_TOOLBAR_DEFAULTS]).toEqual([
      'select',
      'draw',
      'hand',
      'layers',
      'voice',
      'auto-arrange',
      'reset',
    ]);
  });

  it('registers a microphone icon (not the invalid audio help fallback)', () => {
    const tools: Record<string, unknown> = {};
    const editor = {
      getCurrentToolId: () => 'select',
      setCurrentTool: vi.fn(),
    };
    const result = voiceTldrawOverrides.tools?.(
      editor as never,
      tools as never,
      {} as never) as Record<string, { id: string; icon: string; label: string }>;

    expect(result[VOICE_TOOL_ID]).toMatchObject({
      id: VOICE_TOOL_ID,
      icon: VOICE_TOOL_ICON_ID,
      label: 'tools.voice',
    });
    expect(result[VOICE_TOOL_ID].icon).toBe('microphone');
    expect(result[VOICE_TOOL_ID].icon).not.toBe('audio');
  });

  it('exposes a data-url microphone asset for Tldraw assetUrls', () => {
    expect(whiteboardVoiceAssetUrls.icons?.[VOICE_TOOL_ICON_ID]).toMatch(
      /^data:image\/svg\+xml,/);
  });
});
