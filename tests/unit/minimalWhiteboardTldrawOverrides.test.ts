import { describe, it, expect } from 'vitest';
import { WHITEBOARD_TOOLBAR_TOOL_IDS } from '../../src/engines/tldraw/minimalWhiteboardTldrawOverrides';
import { VOICE_TOOL_ID } from '../../src/engines/tldraw/tools/voiceEvents';
import { LAYERS_TOOL_ID } from '../../src/engines/tldraw/tools/layersEvents';
import {
  AUTO_ARRANGE_TOOL_ID,
  RESET_CANVAS_TOOL_ID,
} from '../../src/engines/tldraw/tools/layoutActionEvents';

describe('minimalWhiteboardTldrawOverrides', () => {
  it('allows career defaults including layers, voice, and layout actions', () => {
    expect([...WHITEBOARD_TOOLBAR_TOOL_IDS]).toEqual([
      'select',
      'draw',
      'hand',
      LAYERS_TOOL_ID,
      VOICE_TOOL_ID,
      AUTO_ARRANGE_TOOL_ID,
      RESET_CANVAS_TOOL_ID,
    ]);
  });

  it('excludes eraser, arrow, text, sticky, and image tools', () => {
    const allowed = new Set<string>(WHITEBOARD_TOOLBAR_TOOL_IDS);
    for (const id of ['eraser', 'arrow', 'text', 'note', 'asset', 'geo', 'line', 'frame']) {
      expect(allowed.has(id)).toBe(false);
    }
  });

  it('includes voice for Talk to Sandy Gemini Live toolbar entry', () => {
    expect(WHITEBOARD_TOOLBAR_TOOL_IDS).toContain('voice');
  });
});
