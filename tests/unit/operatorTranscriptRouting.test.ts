/**
 * — operator composer must not mirror into page session
 * (Atlas ChatPanel ingests voice-only transcripts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { submitOperatorComposerMessage } from '../../src/agents/surface/operatorComposer';
import { DEFAULT_OPERATOR_THREADS } from '../../src/agents/surface/constants';
import { isOperatorTextMessage } from '../../src/agents/surface/types';
import {
  __resetPageSessionForTests__,
  ensurePageSession,
  type PageTranscriptEntry,
} from '../../src/session/pageSession';

function voiceOnlyIngest(entries: PageTranscriptEntry[]): PageTranscriptEntry[] {
  return entries.filter((entry) => entry.source === 'voice');
}

describe('operator transcript routing isolation ', () => {
  beforeEach(() => {
    __resetPageSessionForTests__();
    // Keep the composer send deterministic and offline: without a stub the
    // chat client makes a real generateContent call (live chat is enabled
    // whenever an API key is present), which fails with a 401 in tests.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'Operator reply.' }] } }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } })));
  });

  afterEach(() => {
    __resetPageSessionForTests__();
    vi.unstubAllGlobals();
  });

  it('does not publish operator composer sends into page session', async () => {
    const session = ensurePageSession;
    const ingested: PageTranscriptEntry[] = [];
    session().subscribeTranscripts((entry) => {
      ingested.push(entry);
    });

    const activeThreadId = DEFAULT_OPERATOR_THREADS[0]?.id ?? 'thread-main';
    const result = await submitOperatorComposerMessage({
      text: 'Operator-only routing probe',
      threads: DEFAULT_OPERATOR_THREADS,
      activeThreadId,
      mode: 'ask',
    });

    expect(result.error).toBeUndefined();
    const thread = result.threads.find((entry) => entry.id === activeThreadId);
    expect(thread).toBeDefined();
    const userLine = thread?.messages.find(
      (message) => isOperatorTextMessage(message) && message.text.includes('Operator-only routing probe'));
    expect(userLine).toBeDefined();

    const assistantLine = thread?.messages.find(
      (message) => isOperatorTextMessage(message) && message.role === 'assistant');
    expect(assistantLine).toBeDefined();

    expect(ingested).toHaveLength(0);
  });

  it('voice-only ingest path ignores chat-source page session entries', () => {
    const session = ensurePageSession;
    const voiceIngest: PageTranscriptEntry[] = [];
    session().subscribeTranscripts((entry) => {
      if (entry.source === 'voice') {
        voiceIngest.push(entry);
      }
    });

    session().publishTranscript({
      role: 'user',
      text: 'Operator chat leak',
      timestamp: new Date().toISOString(),
      source: 'chat',
    });

    session().publishTranscript({
      role: 'user',
      text: 'Voice mirror line',
      timestamp: new Date().toISOString(),
      source: 'voice',
    });

    const filtered = voiceOnlyIngest(session().getBufferedTranscripts());
    expect(filtered.some((entry) => entry.text === 'Operator chat leak')).toBe(false);
    expect(filtered.some((entry) => entry.text === 'Voice mirror line')).toBe(true);
    expect(voiceIngest.some((entry) => entry.text === 'Operator chat leak')).toBe(false);
    expect(voiceIngest.some((entry) => entry.text === 'Voice mirror line')).toBe(true);
  });
});
