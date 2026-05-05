/**
 * Persona end-to-end integration test.
 *
 * Top priority test from the test-automator review (Track A.7). Asserts the
 * persona injection chain holds across the full wrapper stack:
 *
 *   <CanvasProvider config={...}>
 *     → useCanvasConfig() inside VoiceWidget
 *       → useGeminiLive({ persona })
 *         → createMockVoiceClient(persona, ...)
 *           → emits scenario.greeting (or persona.voiceGreeting fallback)
 *
 * If anything in that chain breaks, the assistant either spouts the wrong
 * brand voice or fails to start. This test catches breakage anywhere along
 * the chain in a single assertion.
 *
 * Strategy: render <CanvasProvider> wrapping a tiny consumer component that
 * directly invokes `useGeminiLive` with the same persona-from-context
 * pattern VoiceWidget uses. Drive the kernel via the public API, observe
 * the published state + transcript. Speed=10x for fast playback.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { CanvasProvider, useCanvasConfig } from '../../src/canvas/CanvasContext';
import { useGeminiLive } from '../../src/canvas/voice/useGeminiLive';
import type { ReactNode } from 'react';

// Test-only persona — fully tenant-flavored to verify the chain doesn't
// silently swap in library defaults somewhere.
const TEST_PERSONA = {
  systemPrompt: 'You are Riley, an Acme Career Concierge.',
  voiceGreeting: 'Hi there — I am Riley, your Career Concierge.',
  assistantName: 'Riley',
  tenantTitle: 'Career Concierge',
  starterPrompts: [
    { emoji: '💼', text: 'Show me Acme jobs that fit my resume' },
  ],
};

// Lightweight test scenario — fast playback (durationMs scaled by speed=10
// in the hook config below means ~150ms per turn).
const TEST_SCENARIO = {
  id: 'test-scenario',
  greeting: 'TEST GREETING — explicit scenario greeting wins.',
  turns: [
    { text: 'TURN ONE.', durationMs: 1000, listenForMs: 500 },
    { text: 'TURN TWO.', durationMs: 1000 },
  ],
};

function ProviderWrapper({ children }: { children: ReactNode }) {
  return (
    <CanvasProvider
      config={{
        tenant: 'acme',
        persona: TEST_PERSONA,
      }}
    >
      {children}
    </CanvasProvider>
  );
}

// Custom hook that mirrors what VoiceWidget does — read persona from
// context, pass to useGeminiLive. Adding `forceMock: true` so the test
// is hermetic regardless of test-runner env vars.
function usePersonaInjectedVoice(scenarioOverride?: typeof TEST_SCENARIO) {
  const { persona } = useCanvasConfig();
  return useGeminiLive({
    persona,
    forceMock: true,
    mockScenario: scenarioOverride,
  });
}

describe('Persona end-to-end injection', () => {
  beforeEach(() => {
    delete (window as unknown as { __voiceKernel__?: unknown }).__voiceKernel__;
  });

  afterEach(() => {
    delete (window as unknown as { __voiceKernel__?: unknown }).__voiceKernel__;
  });

  it('persona reaches CanvasContext consumers', () => {
    const { result } = renderHook(() => useCanvasConfig(), {
      wrapper: ProviderWrapper,
    });
    expect(result.current.tenant).toBe('acme');
    expect(result.current.persona.assistantName).toBe('Riley');
    expect(result.current.persona.systemPrompt).toMatch(/Riley/);
    expect(result.current.persona.voiceGreeting).toMatch(/Career Concierge/);
  });

  it('useGeminiLive receives the merged persona via context', () => {
    const { result } = renderHook(() => usePersonaInjectedVoice(), {
      wrapper: ProviderWrapper,
    });
    expect(result.current.state).toBe('idle');
    expect(typeof result.current.start).toBe('function');
    expect(typeof result.current.stop).toBe('function');
    // `available` should be true since forceMock=true bypasses the
    // no-API-key error path.
    expect(result.current.available).toBe(true);
  });

  it('start() routes the persona to the mock client and plays greeting', async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => usePersonaInjectedVoice(TEST_SCENARIO), {
        wrapper: ProviderWrapper,
      });

      // Don't await start() inside act — the mock awaits a 350ms setTimeout
      // and act would block. Fire-and-forget then advance fake timers
      // PAST the 350ms connecting beat but BEFORE the greeting (~2200ms)
      // ends and the scenario advances to turn 1.
      await act(async () => {
        void result.current.start();
        await vi.advanceTimersByTimeAsync(400);
      });

      // After the connecting beat, the mock fires onTranscript with the
      // explicit scenario greeting. lastTranscript should reflect it.
      expect(result.current.lastTranscript).toBe(
        'TEST GREETING — explicit scenario greeting wins.'
      );

      act(() => {
        void result.current.stop();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('persona greeting falls through when scenario has no greeting', async () => {
    vi.useFakeTimers();
    try {
      const scenarioNoGreeting = {
        id: 'no-greeting',
        // No `greeting` field — persona.voiceGreeting should fill in.
        turns: [{ text: 'TURN.', durationMs: 1000 }],
      };
      const { result } = renderHook(() => usePersonaInjectedVoice(scenarioNoGreeting), {
        wrapper: ProviderWrapper,
      });

      await act(async () => {
        void result.current.start();
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(result.current.lastTranscript).toBe(
        'Hi there — I am Riley, your Career Concierge.'
      );

      act(() => {
        void result.current.stop();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('voice kernel snapshot is referentially stable between publishes', async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => usePersonaInjectedVoice(TEST_SCENARIO), {
        wrapper: ProviderWrapper,
      });
      const kernel = window.__voiceKernel__;
      expect(kernel).toBeTruthy();
      const snap1 = kernel!.voice.getSnapshot();
      const snap2 = kernel!.voice.getSnapshot();
      expect(snap1).toBe(snap2);

      await act(async () => {
        void result.current.start();
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(kernel!.voice.getSnapshot().state).not.toBe('idle');

      // After publish, a new reference but stable until next publish.
      const snap3 = kernel!.voice.getSnapshot();
      const snap4 = kernel!.voice.getSnapshot();
      expect(snap3).toBe(snap4);
      expect(snap3).not.toBe(snap1);

      act(() => {
        void result.current.stop();
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
