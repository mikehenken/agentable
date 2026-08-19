/**
 * Career toolbar phase B — routes custom-action events to whiteboard panel intents.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindCareerToolbarCustomActions } from '../../packages/career-pack/src/whiteboard/bindCareerToolbarCustomActions';
import {
  WHITEBOARD_OPEN_PANEL_EVENT,
  WHITEBOARD_SCREENSHOT_CANVAS_EVENT,
} from '../../src/engines/tldraw/tools/whiteboardToolbarPanelEvents';

describe('bindCareerToolbarCustomActions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps dock-menu to journey open-panel intent', () => {
    const dispose = bindCareerToolbarCustomActions;
    const handler = vi.fn();
    window.addEventListener(WHITEBOARD_OPEN_PANEL_EVENT, handler);

    window.dispatchEvent(
      new CustomEvent('landi-whiteboard-custom-action:dock-menu', {
        detail: { id: 'dock-menu' },
        bubbles: true,
      }));

    expect(handler).toHaveBeenCalledTimes(1);
    const detail = (handler.mock.calls[0]?.[0] as CustomEvent).detail as {
      panelId: string;
    };
    expect(detail.panelId).toBe('journey');

    window.removeEventListener(WHITEBOARD_OPEN_PANEL_EVENT, handler);
    dispose();
  });

  it('maps recent-activity to recent-activity panel intent', () => {
    const dispose = bindCareerToolbarCustomActions;
    const handler = vi.fn();
    window.addEventListener(WHITEBOARD_OPEN_PANEL_EVENT, handler);

    window.dispatchEvent(
      new CustomEvent('landi-whiteboard-custom-action:recent-activity', {
        detail: { id: 'recent-activity' },
        bubbles: true,
      }));

    expect(handler).toHaveBeenCalledTimes(1);
    const detail = (handler.mock.calls[0]?.[0] as CustomEvent).detail as {
      panelId: string;
    };
    expect(detail.panelId).toBe('recent-activity');

    window.removeEventListener(WHITEBOARD_OPEN_PANEL_EVENT, handler);
    dispose();
  });

  it('maps screenshot to screenshot canvas intent', () => {
    const dispose = bindCareerToolbarCustomActions;
    const handler = vi.fn();
    window.addEventListener(WHITEBOARD_SCREENSHOT_CANVAS_EVENT, handler);

    window.dispatchEvent(
      new CustomEvent('landi-whiteboard-custom-action:screenshot', {
        detail: { id: 'screenshot' },
        bubbles: true,
      }));

    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener(WHITEBOARD_SCREENSHOT_CANVAS_EVENT, handler);
    dispose();
  });
});
