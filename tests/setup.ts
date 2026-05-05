/**
 * Vitest setup — runs once per worker before any test file. Wires
 * `@testing-library/jest-dom` matchers (`toBeInTheDocument`, etc.) into
 * Vitest's `expect` and stubs a few browser APIs happy-dom doesn't fully
 * cover (matchMedia, AudioWorklet, performance.now-ish bits).
 */
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { __resetKernelForTests__ } from '../src/shared/voiceKernel';

afterEach(() => {
  cleanup();
  // Use the kernel module's contractual reset hook so any future
  // module-level state (workers, in-flight promises, accumulated
  // subscribers) gets cleared too — not just the window attribute.
  __resetKernelForTests__();
});

beforeEach(() => {
  // Stub matchMedia (used by some Radix UI components inside the canvas).
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  // Stub IntersectionObserver / ResizeObserver — happy-dom doesn't ship them.
  if (typeof globalThis.IntersectionObserver === 'undefined') {
    globalThis.IntersectionObserver = class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn().mockReturnValue([]);
      root = null;
      rootMargin = '';
      thresholds = [];
    } as unknown as typeof IntersectionObserver;
  }
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    } as unknown as typeof ResizeObserver;
  }
  // requestAnimationFrame in happy-dom is fine but synchronous tests need
  // a deterministic shim. Tests that rely on RAF should use vi.useFakeTimers.
});
