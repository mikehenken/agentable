import { describe, expect, it, vi } from 'vitest';
import {
  CANVAS_SITE_ACTIONS_PANEL_EVENT,
  emitSiteActionsPanelChange,
} from '../../src/whiteboard/tools/siteActionsEvents';

describe('siteActionsEvents', () => {
  it('dispatches panel open/close detail on the host bridge event', () => {
    const handler = vi.fn();
    window.addEventListener(CANVAS_SITE_ACTIONS_PANEL_EVENT, handler);

    emitSiteActionsPanelChange(true);
    emitSiteActionsPanelChange(false);

    expect(handler).toHaveBeenCalledTimes(2);
    expect((handler.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ open: true });
    expect((handler.mock.calls[1]?.[0] as CustomEvent).detail).toEqual({ open: false });

    window.removeEventListener(CANVAS_SITE_ACTIONS_PANEL_EVENT, handler);
  });
});
