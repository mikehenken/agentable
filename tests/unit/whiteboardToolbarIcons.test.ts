import { describe, expect, it } from 'vitest';
import {
  ATTACH_TOOL_ICON_ID,
  DOCK_MENU_TOOL_ICON_ID,
  RECENT_ACTIVITY_TOOL_ICON_ID,
  SCREENSHOT_TOOL_ICON_ID,
  resolveWhiteboardToolbarIconId,
  whiteboardToolbarAssetUrls,
} from '../../src/engines/tldraw/voice/whiteboardToolbarIcons';

describe('whiteboardToolbarIcons', () => {
  it('maps career customAction lucide names to registered icon ids', () => {
    expect(resolveWhiteboardToolbarIconId('paperclip')).toBe(ATTACH_TOOL_ICON_ID);
    expect(resolveWhiteboardToolbarIconId('clock')).toBe(RECENT_ACTIVITY_TOOL_ICON_ID);
    expect(resolveWhiteboardToolbarIconId('camera')).toBe(SCREENSHOT_TOOL_ICON_ID);
    expect(resolveWhiteboardToolbarIconId('layout-grid')).toBe(DOCK_MENU_TOOL_ICON_ID);
  });

  it('registers SVG asset urls for custom toolbar icons', () => {
    const icons = whiteboardToolbarAssetUrls.icons ?? {};
    expect(icons[ATTACH_TOOL_ICON_ID]).toMatch(/^data:image\/svg\+xml,/);
    expect(icons[RECENT_ACTIVITY_TOOL_ICON_ID]).toMatch(/^data:image\/svg\+xml,/);
    expect(icons[SCREENSHOT_TOOL_ICON_ID]).toMatch(/^data:image\/svg\+xml,/);
    expect(icons[DOCK_MENU_TOOL_ICON_ID]).toMatch(/^data:image\/svg\+xml,/);
  });
});
