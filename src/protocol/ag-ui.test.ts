import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AG_UI_EVENT, emitAgUiStatePatch, emitAgUiToolCallEnd } from './ag-ui';

describe('ag-ui protocol', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('dispatches STATE_PATCH events', () => {
    emitAgUiStatePatch('files.index.html', { path: 'index.html' });
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
    const event = vi.mocked(window.dispatchEvent).mock.calls[0]?.[0] as CustomEvent;
    expect(event.type).toBe(AG_UI_EVENT);
    expect(event.detail.type).toBe('STATE_PATCH');
    expect(event.detail.payload.path).toBe('files.index.html');
  });

  it('dispatches TOOL_CALL_END events', () => {
    emitAgUiToolCallEnd('list_site_files', {}, true, []);
    const event = vi.mocked(window.dispatchEvent).mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail.type).toBe('TOOL_CALL_END');
    expect(event.detail.payload.ok).toBe(true);
  });
});
