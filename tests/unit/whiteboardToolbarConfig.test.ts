import { describe, it, expect } from 'vitest';
import {
  CAREER_WHITEBOARD_TOOLBAR_DEFAULTS,
  parseWhiteboardToolbarConfig,
  resolveWhiteboardToolbarConfig,
} from '../../src/engines/tldraw/toolbar/toolbarConfig';
import { LAYERS_TOOL_ID } from '../../src/engines/tldraw/tools/layersEvents';
import { VOICE_TOOL_ID } from '../../src/engines/tldraw/tools/voiceEvents';
import {
  AUTO_ARRANGE_TOOL_ID,
  RESET_CANVAS_TOOL_ID,
} from '../../src/engines/tldraw/tools/layoutActionEvents';
import { CONTEXT_ACTIONS_TOOL_ID } from '../../src/engines/tldraw/tools/contextActionsEvents';

describe('resolveWhiteboardToolbarConfig', () => {
  it('uses career defaults: select, draw, hand, layers, voice + layout actions', () => {
    const resolved = resolveWhiteboardToolbarConfig;
    expect(CAREER_WHITEBOARD_TOOLBAR_DEFAULTS).toEqual([
      'select',
      'draw',
      'hand',
      LAYERS_TOOL_ID,
      VOICE_TOOL_ID,
      AUTO_ARRANGE_TOOL_ID,
      RESET_CANVAS_TOOL_ID,
    ]);
    expect(resolved().toolbarTools).toEqual([
      'select',
      'draw',
      'hand',
      LAYERS_TOOL_ID,
      VOICE_TOOL_ID,
      AUTO_ARRANGE_TOOL_ID,
      RESET_CANVAS_TOOL_ID,
    ]);
    expect(resolved().enableLayersPanel).toBe(true);
    expect(resolved().enableVoiceTool).toBe(true);
    expect(resolved().showAutoArrangeTopBar).toBe(true);
    expect(resolved().showResetTopBar).toBe(true);
    expect(resolved().showAutoArrangeToolbar).toBe(true);
    expect(resolved().showResetToolbar).toBe(true);
  });

  it('honours tools order and exclude', () => {
    const resolved = resolveWhiteboardToolbarConfig({
      toolbarConfig: {
        tools: ['hand', 'select', 'voice', 'draw', 'layers'],
        exclude: ['draw'],
      },
    });
    expect(resolved.toolbarTools).toEqual(['hand', 'select', 'voice', 'layers']);
  });

  it('maps legacy enableVoiceTool enableLayersPanel booleans', () => {
    const resolved = resolveWhiteboardToolbarConfig({
      enableVoiceTool: false,
      enableLayersPanel: false,
    });
    expect(resolved.enableVoiceTool).toBe(false);
    expect(resolved.enableLayersPanel).toBe(false);
    expect(resolved.toolbarTools).not.toContain(VOICE_TOOL_ID);
    expect(resolved.toolbarTools).not.toContain(LAYERS_TOOL_ID);
  });

  it('places layout actions topbar-only when configured', () => {
    const resolved = resolveWhiteboardToolbarConfig({
      toolbarConfig: {
        tools: ['select', 'draw', 'hand', 'auto-arrange', 'reset'],
        layoutActionPlacement: 'topbar',
      },
    });
    expect(resolved.showAutoArrangeToolbar).toBe(false);
    expect(resolved.showResetToolbar).toBe(false);
    expect(resolved.showAutoArrangeTopBar).toBe(true);
    expect(resolved.showResetTopBar).toBe(true);
    expect(resolved.toolbarTools).toEqual(['select', 'draw', 'hand']);
  });

  it('appends site-actions when enableContextActionsTool is true', () => {
    const resolved = resolveWhiteboardToolbarConfig({
      enableContextActionsTool: true,
      toolbarConfig: {
        tools: ['select', 'draw', 'hand'],
      },
    });
    expect(resolved.toolbarTools).toContain(CONTEXT_ACTIONS_TOOL_ID);
    expect(resolved.enableContextActionsTool).toBe(true);
  });

  it('includes customActions in toolbar order', () => {
    const resolved = resolveWhiteboardToolbarConfig({
      toolbarConfig: {
        tools: ['select', 'hand'],
        customActions: [{ id: 'publish', label: 'Publish', placement: 'toolbar' }],
      },
    });
    expect(resolved.toolbarTools).toEqual(['select', 'hand', 'publish']);
  });

  it('allows draw tool when drawingEnabled true for career hosts', () => {
    const resolved = resolveWhiteboardToolbarConfig({
      toolbarConfig: {
        drawingEnabled: true,
        tools: ['select', 'draw', 'hand', 'voice'],
      },
    });
    expect(resolved.drawingEnabled).toBe(true);
    expect(resolved.toolbarTools).toContain('draw');
  });

  it('disables draw tool and sets drawingEnabled false when configured', () => {
    const resolved = resolveWhiteboardToolbarConfig({
      toolbarConfig: {
        drawingEnabled: false,
        tools: ['select', 'draw', 'hand', 'voice'],
      },
    });
    expect(resolved.drawingEnabled).toBe(false);
    expect(resolved.toolbarTools).toEqual(['select', 'hand', 'voice']);
  });
});

describe('parseWhiteboardToolbarConfig', () => {
  it('parses JSON attribute strings', () => {
    const parsed = parseWhiteboardToolbarConfig(
      '{"tools":["select","voice"],"layoutActionPlacement":"both"}');
    expect(parsed).toEqual({
      tools: ['select', 'voice'],
      layoutActionPlacement: 'both',
    });
  });

  it('returns null for invalid JSON', () => {
    expect(parseWhiteboardToolbarConfig('{not-json')).toBeNull();
    expect(parseWhiteboardToolbarConfig('')).toBeNull();
  });
});
