/**
 * Contract test for the AG-UI state-patch envelope. Host bridges subscribe
 * to the event by name, so the name, detail shape, and shadow-DOM crossing
 * flags are the public contract.
 *
 * History: this file lived at src/protocol/ag-ui.test.ts, outside the vitest
 * include globs, and never ran; it still asserted an API (AG_UI_EVENT,
 * emitAgUiToolCallEnd) that had been removed from the module. Moved into
 * tests/unit and rewritten against the current contract 2026-08-28.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  AG_UI_STATE_PATCH_EVENT,
  emitAgUiStatePatch,
  type AgUiStatePatchEventDetail,
} from '../../src/protocol/ag-ui';

describe('ag-ui protocol', () => {
  beforeEach(() => {
    vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function lastEvent(): CustomEvent<AgUiStatePatchEventDetail> {
    const calls = vi.mocked(window.dispatchEvent).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    return calls[calls.length - 1][0] as CustomEvent<AgUiStatePatchEventDetail>;
  }

  it('dispatches the named state-patch event with the patch payload', () => {
    emitAgUiStatePatch(
      [{ op: 'replace', path: '/files/0/name', value: 'index.html' }],
      { source: 'chat', toolName: 'update_file' },
    );
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
    const event = lastEvent();
    expect(event.type).toBe(AG_UI_STATE_PATCH_EVENT);
    expect(event.detail.patches).toEqual([
      { op: 'replace', path: '/files/0/name', value: 'index.html' },
    ]);
    expect(event.detail.source).toBe('chat');
    expect(event.detail.toolName).toBe('update_file');
    expect(typeof event.detail.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(event.detail.timestamp))).toBe(false);
  });

  it('crosses shadow DOM boundaries (bubbles + composed)', () => {
    emitAgUiStatePatch([{ op: 'add', path: '/panels/-', value: { id: 'p1' } }]);
    const event = lastEvent();
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
  });

  it('defaults the source to tool', () => {
    emitAgUiStatePatch([{ op: 'remove', path: '/panels/0' }]);
    expect(lastEvent().detail.source).toBe('tool');
  });

  it('does not dispatch for an empty patch list', () => {
    emitAgUiStatePatch([]);
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });
});
