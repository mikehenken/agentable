/**
 * — voice greeting mode integration.
 *
 * SC3: agent-first speaks greeting on voice connect (mock transcript hook).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { CanvasProvider, useCanvasConfig } from '../../src/config/CanvasContext';
import { useGeminiLive } from '../../src/voice/useGeminiLive';
import type { ReactNode } from 'react';

const AGENT_GREETING = 'Welcome — I am Riley, your concierge.';

function VoiceHarness({ children }: { children: ReactNode }) {
  return (
    <CanvasProvider
      config={{
        tenant: 'acme',
        persona: {
          systemPrompt: 'You are Riley.',
          voiceGreeting: AGENT_GREETING,
          greetingMode: 'agent-first',
          assistantName: 'Riley',
        },
      }}
    >
      {children}
    </CanvasProvider>
  );
}

function useContextVoice (){
  const { persona } = useCanvasConfig();
  return useGeminiLive({
    persona,
    forceMock: true,
    mockScenario: {
      id: 'no-scenario-greeting',
      turns: [{ text: 'Follow-up turn.', durationMs: 800 }],
    },
  });
}

describe('voice greeting mode ', () => {
  beforeEach(() => {
    delete (window as unknown as { __voiceKernel__?: unknown }).__voiceKernel__;
  });

  afterEach(() => {
    delete (window as unknown as { __voiceKernel__?: unknown }).__voiceKernel__;
  });

  it('merges greetingMode into CanvasContext persona', () => {
    const { result } = renderHook(() => useCanvasConfig(), { wrapper: VoiceHarness });
    expect(result.current.persona.greetingMode).toBe('agent-first');
    expect(result.current.persona.voiceGreeting).toBe(AGENT_GREETING);
  });

  it('agent-first speaks voiceGreeting on connect (SC3)', async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useContextVoice(), { wrapper: VoiceHarness });

      await act(async () => {
        void result.current.start();
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(result.current.lastTranscript).toBe(AGENT_GREETING);
      expect(result.current.state).toBe('speaking');

      act(() => {
        void result.current.stop();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('user-first skips connect greeting even when voiceGreeting is set', async () => {
    vi.useFakeTimers();
    try {
      function UserFirstHarness({ children }: { children: ReactNode }) {
        return (
          <CanvasProvider
            config={{
              persona: {
                systemPrompt: 'You are Riley.',
                voiceGreeting: AGENT_GREETING,
                greetingMode: 'user-first',
              },
            }}
          >
            {children}
          </CanvasProvider>
        );
      }

      function useUserFirstVoice (){
        const { persona } = useCanvasConfig();
        return useGeminiLive({
          persona,
          forceMock: true,
          mockScenario: {
            id: 'user-first-wait',
            turns: [{ text: 'Follow-up turn.', durationMs: 800, listenForMs: 5000 }],
          },
        });
      }

      const { result } = renderHook(() => useUserFirstVoice(), { wrapper: UserFirstHarness });

      await act(async () => {
        void result.current.start();
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(result.current.lastTranscript).toBe('');
      expect(result.current.state).toBe('listening');

      act(() => {
        void result.current.stop();
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
