import { describe, expect, it, vi } from 'vitest';
import {
  CONTEXT_ACTIONS_PANEL_EVENT,
  LEGACY_CONTEXT_ACTIONS_PANEL_EVENT,
  emitContextActionsPanelChange,
} from '../../src/engines/tldraw/tools/contextActionsEvents';

describe('contextActionsEvents', () => {
  it('dispatches panel open/close detail on the host bridge event', () => {
    const handler = vi.fn();
    window.addEventListener(CONTEXT_ACTIONS_PANEL_EVENT, handler);

    emitContextActionsPanelChange(true);
    emitContextActionsPanelChange(false);

    expect(handler).toHaveBeenCalledTimes(2);
    expect((handler.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ open: true });
    expect((handler.mock.calls[1]?.[0] as CustomEvent).detail).toEqual({ open: false });

    window.removeEventListener(CONTEXT_ACTIONS_PANEL_EVENT, handler);
  });

  it('also dispatches the deprecated legacy event name during the migration window', () => {
    const handler = vi.fn();
    window.addEventListener(LEGACY_CONTEXT_ACTIONS_PANEL_EVENT, handler);

    emitContextActionsPanelChange(true);

    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ open: true });

    window.removeEventListener(LEGACY_CONTEXT_ACTIONS_PANEL_EVENT, handler);
  });
});
