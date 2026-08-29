/**
 * page session unit coverage: singleton identity, participant join/leave,
 * bounded transcript buffer, and subscriber replay.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ensurePageSession,
  installPageSession,
  __resetPageSessionForTests__,
} from '../../src/session/pageSession';

describe('pageSession — singleton', () => {
  beforeEach(() => {
    __resetPageSessionForTests__();
  });

  it('installs one session per window', () => {
    const first = installPageSession().session;
    const second = ensurePageSession;
    expect(second().sessionId).toBe(first.sessionId);
  });

  it('tracks participants joining and leaving', () => {
    const session = ensurePageSession;
    session().join('embed-a');
    session().join('embed-b');
    expect(session().getSnapshot().participantIds).toEqual(['embed-a', 'embed-b']);
    session().leave('embed-a');
    expect(session().getSnapshot().participantIds).toEqual(['embed-b']);
  });
});

describe('pageSession — transcript bus', () => {
  beforeEach(() => {
    __resetPageSessionForTests__();
  });

  it('buffers transcripts and replays to late subscribers', () => {
    const session = ensurePageSession;
    session().publishTranscript({
      role: 'assistant',
      text: 'Hello from voice',
      timestamp: '2026-07-20T00:00:00.000Z',
      source: 'voice',
    });

    const received: string[] = [];
    session().subscribeTranscripts((entry) => {
      received.push(entry.text);
    });

    expect(received).toEqual(['Hello from voice']);
    expect(session().getBufferedTranscripts()).toHaveLength(1);
  });

  it('caps buffered transcripts at 64 entries', () => {
    const session = ensurePageSession;
    for (let i = 0; i < 70; i += 1) {
      session().publishTranscript({
        role: 'assistant',
        text: `line-${i}`,
        timestamp: new Date().toISOString(),
        source: 'voice',
      });
    }
    const buffered = session().getBufferedTranscripts();
    expect(buffered).toHaveLength(64);
    expect(buffered[0]?.text).toBe('line-6');
    expect(buffered[63]?.text).toBe('line-69');
  });

  it('registers chat surfaces independently of participants', () => {
    const session = ensurePageSession;
    const unregister = session().registerChatSurface('chat-main');
    expect(session().getSnapshot().chatSurfaceCount).toBe(1);
    unregister();
    expect(session().getSnapshot().chatSurfaceCount).toBe(0);
  });
});
