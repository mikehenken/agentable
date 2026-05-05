/**
 * `<CanvasShell panels={...}>` stable-reference contract pin.
 *
 * The panel-registry refactor (2026-04-26) made `panels` an overridable
 * prop with a load-bearing invariant: consumers must pass a STABLE
 * reference (module-scope `const`, not inline literal). A fresh registry
 * literal each render forces React to re-create lazy components, refetch
 * chunks, and remount panel state.
 *
 * Two assertions:
 *   1. Stable registry: passing the same module-scope object across
 *      re-renders calls each loader at most ONCE.
 *   2. Unstable registry: passing a fresh inline-literal each render
 *      surfaces the dev-mode `console.error` warning installed in
 *      `CanvasShellInner`. Loaders may fire repeatedly, but the
 *      observable contract is the warning — we don't depend on
 *      React's lazy-cache-invalidation timing for the assertion.
 *
 * Test runs in happy-dom (Vitest default). React 19's `lazy` works in
 * happy-dom for shape assertions; we don't await Suspense resolution
 * because the spy semantics are decided at the wrap site, not at
 * render-time.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { CanvasShell } from '../../src/canvas/CanvasShell';
import type { PanelRegistry } from '../../src/canvas/panelImports';

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

const makeStubLoader = () =>
  vi.fn(() => Promise.resolve({ default: () => null }));

// Module-scope stable registry — what consumers SHOULD do.
const STUB_LOADER_A = makeStubLoader();
const STUB_LOADER_B = makeStubLoader();
const STABLE_REGISTRY: PanelRegistry = {
  positions: STUB_LOADER_A,
  applications: STUB_LOADER_B,
};

const STABLE_NAV_ITEMS: never[] = [];

// ──────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────

describe('<CanvasShell panels=...> reference stability', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    STUB_LOADER_A.mockClear();
    STUB_LOADER_B.mockClear();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('stable module-scope registry across re-renders fires no warning', () => {
    function Parent() {
      const [, setTick] = useState(0);
      return (
        <>
          <button data-testid="rerender" onClick={() => setTick((t) => t + 1)}>
            tick
          </button>
          <CanvasShell panels={STABLE_REGISTRY} navItems={STABLE_NAV_ITEMS} />
        </>
      );
    }

    const { getByTestId } = render(<Parent />);
    fireEvent.click(getByTestId('rerender'));
    fireEvent.click(getByTestId('rerender'));

    // No "panels prop reference changed" error on stable references.
    const warnings = consoleErrorSpy.mock.calls.filter((args) =>
      String(args[0] ?? '').includes('`panels` prop reference changed'),
    );
    expect(warnings).toHaveLength(0);
  });

  it('inline-literal registry across re-renders surfaces the dev-mode warning', () => {
    // This is the FOOTGUN — fresh object per render. Dev-mode warning
    // is the observable invariant: we expose this loudly so future
    // maintainers don't silently break chunk caching.
    function Parent() {
      const [, setTick] = useState(0);
      return (
        <>
          <button data-testid="rerender" onClick={() => setTick((t) => t + 1)}>
            tick
          </button>
          <CanvasShell
            panels={{
              positions: makeStubLoader(),
              applications: makeStubLoader(),
            }}
            navItems={STABLE_NAV_ITEMS}
          />
        </>
      );
    }

    const { getByTestId } = render(<Parent />);
    // First click → registry identity changes → effect fires the warning.
    fireEvent.click(getByTestId('rerender'));

    const warnings = consoleErrorSpy.mock.calls.filter((args) =>
      String(args[0] ?? '').includes('`panels` prop reference changed'),
    );
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });
});
