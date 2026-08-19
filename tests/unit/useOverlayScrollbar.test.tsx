import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  OVERLAY_SCROLLBAR_IDLE_MS,
  useOverlayScrollbar,
} from '../../src/hooks/useOverlayScrollbar';

describe('useOverlayScrollbar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds base class and reveals thumb on scroll', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    const ref = { current: el };
    renderHook(() => useOverlayScrollbar(ref));

    expect(el.classList.contains('landi-overlay-scroll')).toBe(true);
    expect(el.classList.contains('landi-overlay-scroll--active')).toBe(false);

    act(() => {
      el.dispatchEvent(new Event('scroll'));
    });

    expect(el.classList.contains('landi-overlay-scroll--active')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(OVERLAY_SCROLLBAR_IDLE_MS);
    });

    expect(el.classList.contains('landi-overlay-scroll--active')).toBe(false);

    document.body.removeChild(el);
  });

  it('extends visibility while scroll continues', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    const ref = { current: el };
    renderHook(() => useOverlayScrollbar(ref));

    act(() => {
      el.dispatchEvent(new Event('scroll'));
    });

    act(() => {
      vi.advanceTimersByTime(OVERLAY_SCROLLBAR_IDLE_MS - 200);
      el.dispatchEvent(new Event('scroll'));
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(el.classList.contains('landi-overlay-scroll--active')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(OVERLAY_SCROLLBAR_IDLE_MS);
    });

    expect(el.classList.contains('landi-overlay-scroll--active')).toBe(false);

    document.body.removeChild(el);
  });

  it('cleans up classes on unmount', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    const ref = { current: el };
    const { unmount } = renderHook(() => useOverlayScrollbar(ref));

    act(() => {
      el.dispatchEvent(new Event('scroll'));
    });

    unmount();
    expect(el.classList.contains('landi-overlay-scroll')).toBe(false);
    expect(el.classList.contains('landi-overlay-scroll--active')).toBe(false);

    document.body.removeChild(el);
  });
});
