import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeybindings } from '../../src/components/general/use-keybindings';

function dispatchKeyDown(init: KeyboardEventInit & { key?: string }): void {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true,...init });
  document.dispatchEvent(event);
}

function dispatchKeyDownWithoutKey(): void {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
  // Object.defineProperty(event, 'key', { value: undefined });
  document.dispatchEvent(event);
}

describe('useKeybindings', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      userAgentData: { platform: 'Win32' },
      platform: 'Win32',
      userAgent: 'Mozilla/5.0',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('invokes handler for matching single-key binding', () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeybindings([
        {
          keys: 'mod+k',
          handler,
        },
      ]));

    dispatchKeyDown({ key: 'k', ctrlKey: true });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores keydown events with missing key without throwing', () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeybindings([
        {
          keys: 'mod+k',
          handler,
        },
      ]));

    expect(() => dispatchKeyDownWithoutKey).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores keydown events with empty key without throwing', () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeybindings([
        {
          keys: 'mod+k',
          handler,
        },
      ]));

    expect(() => dispatchKeyDown({ key: '' })).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });
});
