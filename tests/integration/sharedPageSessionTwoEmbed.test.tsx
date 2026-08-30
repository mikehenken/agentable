/**
 * automated checks (shared page session, voice resilience):
 *
 * 1. Two embed participants share one page session id and transcript bus.
 * 2. Transcripts published from voice stream into both chat subscribers.
 * 3. Simulated voice drop reconnects with backoff and resumes without
 * resetting the logical voice session id or losing buffered transcripts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeminiLive } from '../../src/voice/useGeminiLive';
import { ensurePageSession } from '../../src/session/pageSession';

const PERSONA = {
  systemPrompt: 'Test persona for shared session',
  voiceGreeting: '',
  greetingMode: '',
};

const RESUME_SCENARIO = {
  id: 'drop-resume',
  turns: [{ text: 'Resumed after reconnect.', durationMs: 400, listenForMs: 0 }],
};

describe('shared page session — two-embed fixture ', () => {
  it('two participants share one session id and transcript stream', () => {
    const session = ensurePageSession;
    const sessionId = session().sessionId;

    session().join('embed-alpha');
    session().join('embed-beta');
    expect(session().getSnapshot().sessionId).toBe(sessionId);
    expect(session().getSnapshot().participantIds).toEqual(['embed-alpha', 'embed-beta']);

    const embedA: string[] = [];
    const embedB: string[] = [];
    session().subscribeTranscripts((entry) => {
      embedA.push(entry.text);
    });
    session().subscribeTranscripts((entry) => {
      embedB.push(entry.text);
    });

    session().publishTranscript({
      role: 'assistant',
      text: 'Shared bus message',
      timestamp: new Date().toISOString(),
      source: 'voice',
    });

    expect(embedA).toEqual(['Shared bus message']);
    expect(embedB).toEqual(['Shared bus message']);
  });

  it('voice hook publishes transcripts onto the shared page session bus', async () => {
    vi.useFakeTimers();
    try {
      const session = ensurePageSession;
      session().join('embed-voice');
      session().registerChatSurface('chat-a');

      const lines: string[] = [];
      session().subscribeTranscripts((entry) => {
        lines.push(entry.text);
      });

      const { result, unmount } = renderHook(() =>
        useGeminiLive({
          persona: PERSONA,
          forceMock: true,
          mockScenario: RESUME_SCENARIO,
        }));

      await act(async () => {
        void result.current.start();
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(lines.some((line) => line.includes('Resumed after reconnect'))).toBe(true);
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('voice resilience — drop reconnect resume ', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reconnects after simulated drop and preserves logical session id + transcripts', async () => {
    const pageSession = ensurePageSession;
    pageSession().join('voice-outside-canvas');
    pageSession().registerChatSurface('canvas-chat');

    const chatLines: string[] = [];
    pageSession().subscribeTranscripts((entry) => {
      chatLines.push(entry.text);
    });

    const { result, unmount } = renderHook(() =>
      useGeminiLive({
        persona: PERSONA,
        forceMock: true,
        mockScenario: RESUME_SCENARIO,
        mockSimulateDropAfterMs: 500,
      }));

    await act(async () => {
      void result.current.start();
      await vi.advanceTimersByTimeAsync(600);
    });

    const logicalSessionId = pageSession().getSnapshot().voiceSessionId;
    expect(logicalSessionId).toBeTruthy();
    const linesBeforeReconnect = chatLines.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(pageSession().getSnapshot().connectionState).toBe('connected');
    expect(pageSession().getSnapshot().voiceSessionId).toBe(logicalSessionId);
    expect(chatLines.length).toBeGreaterThanOrEqual(linesBeforeReconnect);
    expect(chatLines.some((line) => line.includes('Resumed after reconnect'))).toBe(true);

    unmount();
  });
});
