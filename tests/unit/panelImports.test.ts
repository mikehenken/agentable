/**
 * `prefetchPanel` + `prefetchAllPanelsIdle` contract pin.
 *
 * Original test pinned safety-net invariants (no-op on unknown key,
 * cancel-fn shape, idempotent cancel). Extended 2026-04-26 (test-automator
 * follow-up to the panel-registry refactor) with the four invariants the
 * registry-aware API now makes tractable:
 *
 *   1. Each loader fires exactly once per `prefetchAllPanelsIdle` window
 *   2. `prefetchPanel` swallows rejected loaders (no unhandled-rejection)
 *   3. Cancel-fn actually cancels the underlying idle handle (loaders
 *      never fire if cancel runs before the window elapses)
 *   4. `DEFAULT_PANEL_REGISTRY` pins the expected 7-key shape (drift
 *      detector — flips the moment someone adds/removes a panel without
 *      updating callers)
 */
import { describe, it, expect, vi } from 'vitest';

import {
  DEFAULT_PANEL_REGISTRY,
  prefetchPanel,
  prefetchAllPanelsIdle,
  type PanelRegistry,
} from '../../src/canvas/panelImports';

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

/** Build a registry of N spy loaders that resolve immediately. The spy
 *  map is the registry itself — each key's value IS the spy fn. */
function spyRegistry(keys: string[]): PanelRegistry {
  const reg: PanelRegistry = {};
  for (const k of keys) {
    reg[k] = vi.fn(() => Promise.resolve({ default: () => null }));
  }
  return reg;
}

// ──────────────────────────────────────────────────────────────────────
// DEFAULT_PANEL_REGISTRY shape
// ──────────────────────────────────────────────────────────────────────

describe('DEFAULT_PANEL_REGISTRY', () => {
  it('exposes the expected 7 keys (drift detector)', () => {
    expect(Object.keys(DEFAULT_PANEL_REGISTRY).sort()).toEqual([
      'applications',
      'journey',
      'positions',
      'resources',
      'settings',
      'tools',
      'trajectories',
    ]);
  });
});

// ──────────────────────────────────────────────────────────────────────
// prefetchPanel
// ──────────────────────────────────────────────────────────────────────

describe('prefetchPanel', () => {
  it('is a no-op for an unknown key (no throw, no loader call)', () => {
    const reg = spyRegistry(['a']);
    expect(() => prefetchPanel('not-a-real-key', reg)).not.toThrow();
    expect(reg.a).not.toHaveBeenCalled();
  });

  it('returns void synchronously even though the loader is async', () => {
    const reg = spyRegistry(['a']);
    const result = prefetchPanel('a', reg);
    expect(result).toBeUndefined();
  });

  it('calls the matching loader exactly once', () => {
    const reg = spyRegistry(['a']);
    prefetchPanel('a', reg);
    expect(reg.a).toHaveBeenCalledTimes(1);
  });

  it('swallows rejected loaders (no unhandled-rejection)', async () => {
    const reg: PanelRegistry = {
      broken: vi.fn().mockRejectedValue(new Error('chunk 503')),
    };
    let unhandled: Error | undefined;
    const onUnhandled = (e: PromiseRejectionEvent) => {
      unhandled = e.reason as Error;
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', onUnhandled);
    }
    try {
      prefetchPanel('broken', reg);
      // Flush microtasks so the .catch runs before assertion.
      await Promise.resolve();
      await Promise.resolve();
      expect(unhandled).toBeUndefined();
    } finally {
      if (typeof window !== 'undefined') {
        window.removeEventListener('unhandledrejection', onUnhandled);
      }
    }
  });

  it('defaults to DEFAULT_PANEL_REGISTRY when no registry supplied', () => {
    // Real call hits the real loader — assertion is just "did not throw"
    // and "returned void". The chunk import resolves detached.
    expect(() => prefetchPanel('positions')).not.toThrow();
  });
});

// ──────────────────────────────────────────────────────────────────────
// prefetchAllPanelsIdle
// ──────────────────────────────────────────────────────────────────────

describe('prefetchAllPanelsIdle', () => {
  it('returns a cancel function', () => {
    const cancel = prefetchAllPanelsIdle();
    expect(cancel).toBeTypeOf('function');
    expect(() => cancel()).not.toThrow();
  });

  it('fires each loader in the registry exactly once when the idle window elapses', async () => {
    const origRic = (globalThis as { requestIdleCallback?: unknown })
      .requestIdleCallback;
    delete (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback;

    vi.useFakeTimers();
    try {
      const reg = spyRegistry(['a', 'b', 'c']);
      prefetchAllPanelsIdle(reg);
      // Before the setTimeout fallback fires (1500 ms), nothing called.
      expect(reg.a).not.toHaveBeenCalled();
      expect(reg.b).not.toHaveBeenCalled();
      expect(reg.c).not.toHaveBeenCalled();
      vi.advanceTimersByTime(2000);
      expect(reg.a).toHaveBeenCalledTimes(1);
      expect(reg.b).toHaveBeenCalledTimes(1);
      expect(reg.c).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      if (origRic) {
        (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback =
          origRic;
      }
    }
  });

  it('cancel() actually cancels — loaders never fire if cancel runs before the window elapses', () => {
    const origRic = (globalThis as { requestIdleCallback?: unknown })
      .requestIdleCallback;
    delete (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback;

    vi.useFakeTimers();
    try {
      const reg = spyRegistry(['a', 'b']);
      const cancel = prefetchAllPanelsIdle(reg);
      cancel();
      vi.advanceTimersByTime(5000);
      expect(reg.a).not.toHaveBeenCalled();
      expect(reg.b).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      if (origRic) {
        (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback =
          origRic;
      }
    }
  });

  it('cancel() routes through requestIdleCallback path when available', () => {
    const ricSpy = vi.fn((cb: () => void) => {
      // Return a numeric handle without firing the callback.
      void cb;
      return 42;
    });
    const cicSpy = vi.fn();
    const origRic = (globalThis as { requestIdleCallback?: unknown })
      .requestIdleCallback;
    const origCic = (globalThis as { cancelIdleCallback?: unknown })
      .cancelIdleCallback;
    (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback =
      ricSpy;
    (globalThis as { cancelIdleCallback?: unknown }).cancelIdleCallback =
      cicSpy;
    try {
      const reg = spyRegistry(['a']);
      const cancel = prefetchAllPanelsIdle(reg);
      expect(ricSpy).toHaveBeenCalledTimes(1);
      cancel();
      expect(cicSpy).toHaveBeenCalledWith(42);
    } finally {
      if (origRic) {
        (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback =
          origRic;
      } else {
        delete (globalThis as { requestIdleCallback?: unknown })
          .requestIdleCallback;
      }
      if (origCic) {
        (globalThis as { cancelIdleCallback?: unknown }).cancelIdleCallback =
          origCic;
      } else {
        delete (globalThis as { cancelIdleCallback?: unknown })
          .cancelIdleCallback;
      }
    }
  });

  it('cancel() is safe to call twice (idempotent)', () => {
    const cancel = prefetchAllPanelsIdle();
    expect(() => cancel()).not.toThrow();
    expect(() => cancel()).not.toThrow();
  });

  it('defaults to DEFAULT_PANEL_REGISTRY when no registry supplied', () => {
    const cancel = prefetchAllPanelsIdle();
    expect(cancel).toBeTypeOf('function');
    cancel();
  });
});
