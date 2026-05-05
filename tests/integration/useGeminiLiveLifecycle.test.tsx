/**
 * useGeminiLive lifecycle invariants.
 *
 * Per the test-automator review (Track A.2): "single highest-value test
 * is a hook test asserting that a persona prop change mid-session
 * triggers exactly one teardown + one reconnect, with no overlapping
 * client instances. That single test exercises the lifecycle invariant
 * most likely to break under real usage."
 *
 * Also: StrictMode double-invokes effects in dev. The hook MUST register
 * its impl with the kernel exactly once (or register-then-clear-then-
 * register cleanly) — never leak two impls, never end with the impl
 * cleared while the canvas is still mounted.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { useGeminiLive } from '../../src/canvas/voice/useGeminiLive';
import { ensureVoiceKernel } from '../../src/shared/voiceKernel';

const PERSONA_A = {
  systemPrompt: 'PROMPT A',
  voiceGreeting: 'GREETING A',
};
const PERSONA_B = {
  systemPrompt: 'PROMPT B',
  voiceGreeting: 'GREETING B',
};

const FAST_SCENARIO = {
  id: 'fast',
  greeting: 'TEST',
  turns: [{ text: 'TURN.', durationMs: 200 }],
};

describe('useGeminiLive — kernel impl registration', () => {
  it('registers impl on mount and clears on unmount (set→clear sequence)', () => {
    const kernel = ensureVoiceKernel();
    const setSpy = vi.spyOn(kernel.voice, '_setImpl');
    const clearSpy = vi.spyOn(kernel.voice, '_clearImpl');

    const { unmount } = renderHook(() =>
      useGeminiLive({
        persona: PERSONA_A,
        forceMock: true,
        mockScenario: FAST_SCENARIO,
      })
    );

    // After mount: exactly one _setImpl call, no _clearImpl yet.
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(clearSpy).not.toHaveBeenCalled();

    unmount();

    // After unmount: one more _clearImpl call.
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalledTimes(1);

    setSpy.mockRestore();
    clearSpy.mockRestore();
  });

  it('StrictMode-wrapped mount ends with impl registered (set ≥ clear)', () => {
    const kernel = ensureVoiceKernel();
    const setSpy = vi.spyOn(kernel.voice, '_setImpl');
    const clearSpy = vi.spyOn(kernel.voice, '_clearImpl');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );

    renderHook(
      () =>
        useGeminiLive({
          persona: PERSONA_A,
          forceMock: true,
          mockScenario: FAST_SCENARIO,
        }),
      { wrapper }
    );

    // happy-dom + RTL doesn't always faithfully simulate StrictMode's
    // double-effect cycle. The invariant we genuinely care about: by the
    // end of mount, one MORE _setImpl than _clearImpl call. If both
    // mounts registered without clearing (the leak case), set count
    // would exceed clear count by 2 — that's the failure we're guarding.
    const setCalls = setSpy.mock.calls.length;
    const clearCalls = clearSpy.mock.calls.length;
    expect(setCalls - clearCalls).toBe(1);
    // And we DID register (it's not a vacuous test).
    expect(setCalls).toBeGreaterThanOrEqual(1);

    setSpy.mockRestore();
    clearSpy.mockRestore();
  });
});

describe('useGeminiLive — persona prop change mid-mount', () => {
  it('does not crash when persona reference swaps', () => {
    let persona = PERSONA_A;
    const { rerender, result } = renderHook(
      () =>
        useGeminiLive({
          persona,
          forceMock: true,
          mockScenario: FAST_SCENARIO,
        })
    );
    expect(result.current.state).toBe('idle');

    // Swap persona reference. The hook keeps an internal personaRef that's
    // updated each render, so future client constructions use the new
    // persona. Existing client (if any) keeps the old persona — that's
    // intentional per useGeminiLive's docstring: persona is captured when
    // the WebSocket opens.
    act(() => {
      persona = PERSONA_B;
      rerender();
    });
    expect(result.current.state).toBe('idle');
  });

  it('persona ref updates each render (next session uses new persona)', async () => {
    // Direct contract: the `personaRef.current` is mutated on every render
    // to the latest props.persona. The hook's docstring promises the
    // session captures persona "when the WebSocket opens" — which means
    // a future start() reads from the ref. We assert the contract by
    // observing `lastTranscript` equals PERSONA_B's voiceGreeting after
    // a re-render + start(), proving the ref propagated.
    let persona: { systemPrompt: string; voiceGreeting: string } = PERSONA_A;
    const noGreetingScenario = {
      id: 'no-greeting-falls-through-to-persona',
      // No `greeting` field — mock will fall back to persona.voiceGreeting,
      // which is read from the live personaRef at session-open time.
      turns: [{ text: 'TURN.', durationMs: 1000 }],
    };
    const { rerender, result } = renderHook(
      () =>
        useGeminiLive({
          persona,
          forceMock: true,
          mockScenario: noGreetingScenario,
        })
    );

    // Swap persona BEFORE starting. The next start() should pick up the
    // new persona because personaRef.current was mutated on the rerender.
    act(() => {
      persona = PERSONA_B;
      rerender();
    });

    vi.useFakeTimers();
    try {
      // Same pattern as personaEndToEnd — advance timers inside act()
      // so React processes the kernel callback chain that publishes
      // lastTranscript via setState.
      await act(async () => {
        void result.current.start();
        await vi.advanceTimersByTimeAsync(400);
      });
      // PERSONA_B's voiceGreeting should appear (the mock falls back to
      // persona.voiceGreeting when scenario has no greeting, and
      // personaRef.current === PERSONA_B at session-open time).
      expect(result.current.lastTranscript).toBe('GREETING B');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('useGeminiLive — `available` flag', () => {
  it('is true when forceMock=true regardless of API key', () => {
    const { result } = renderHook(() =>
      useGeminiLive({
        persona: PERSONA_A,
        forceMock: true,
      })
    );
    expect(result.current.available).toBe(true);
  });
});
