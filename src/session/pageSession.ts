/**
 * Shared page session: window-scoped singleton so every surface on a
 * host page — multiple `<agentable-canvas>` embeds, `<voice-call-button>`,
 * named slots — joins one agent context.
 *
 * Transcripts from voice (outside the canvas boundary) publish here and
 * stream into any mounted chat surface. When no chat surface is registered
 * yet, entries buffer with a bounded cap until one joins.
 */

export type PageTranscriptRole = 'user' | 'assistant';

export interface PageTranscriptEntry {
  id: string;
  role: PageTranscriptRole;
  text: string;
  timestamp: string;
  source: 'voice' | 'chat';
}

export interface PageSessionSnapshot {
  sessionId: string;
  participantIds: readonly string[];
  chatSurfaceCount: number;
  transcriptCount: number;
  voiceSessionId: string | null;
  connectionState: 'idle' | 'connecting' | 'connected' | 'reconnecting';
}

export interface PageSession {
  readonly sessionId: string;
  join(participantId: string): void;
  leave(participantId: string): void;
  registerChatSurface(surfaceId: string): () => void;
  publishTranscript(entry: Omit<PageTranscriptEntry, 'id'> & { id?: string }): PageTranscriptEntry;
  subscribeTranscripts(listener: (entry: PageTranscriptEntry) => void): () => void;
  getBufferedTranscripts(): readonly PageTranscriptEntry[];
  getSnapshot(): PageSessionSnapshot;
  setVoiceSessionId(voiceSessionId: string | null): void;
  setConnectionState(state: PageSessionSnapshot['connectionState']): void;
}

const SESSION_VERSION = '0.1.0';
const GLOBAL_KEY = '__agentablePageSession__';
/** Bounded buffer while no chat surface has joined. */
const MAX_BUFFERED_TRANSCRIPTS = 64;

declare global {
  interface Window {
    __agentablePageSession__?: PageSessionHost;
  }
}

interface PageSessionHost {
  version: string;
  session: PageSession;
}

function createSessionId(): string {
  return `ps_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createTranscriptId(): string {
  return `pt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function createPageSession(initialSessionId?: string): PageSession {
  const sessionId = initialSessionId ?? createSessionId();
  const participants = new Set<string>();
  const chatSurfaces = new Set<string>();
  const transcriptListeners = new Set<(entry: PageTranscriptEntry) => void>();
  const bufferedTranscripts: PageTranscriptEntry[] = [];
  let voiceSessionId: string | null = null;
  let connectionState: PageSessionSnapshot['connectionState'] = 'idle';
  let frozenSnapshot: PageSessionSnapshot = {
    sessionId,
    participantIds: [],
    chatSurfaceCount: 0,
    transcriptCount: 0,
    voiceSessionId: null,
    connectionState: 'idle',
  };

  function notifySnapshot(): void {
    frozenSnapshot = {
      sessionId,
      participantIds: [...participants],
      chatSurfaceCount: chatSurfaces.size,
      transcriptCount: bufferedTranscripts.length,
      voiceSessionId,
      connectionState,
    };
  }

  function pushBuffered(entry: PageTranscriptEntry): void {
    bufferedTranscripts.push(entry);
    while (bufferedTranscripts.length > MAX_BUFFERED_TRANSCRIPTS) {
      bufferedTranscripts.shift();
    }
    notifySnapshot();
  }

  const session: PageSession = {
    sessionId,
    join(participantId: string): void {
      if (!participantId.trim()) return;
      participants.add(participantId);
      notifySnapshot();
    },
    leave(participantId: string): void {
      participants.delete(participantId);
      notifySnapshot();
    },
    registerChatSurface(surfaceId: string): () => void {
      if (!surfaceId.trim()) {
        return () => undefined;
      }
      chatSurfaces.add(surfaceId);
      notifySnapshot();
      return () => {
        chatSurfaces.delete(surfaceId);
        notifySnapshot();
      };
    },
    publishTranscript(entry): PageTranscriptEntry {
      const normalized: PageTranscriptEntry = {
        id: entry.id ?? createTranscriptId(),
        role: entry.role,
        text: entry.text,
        timestamp: entry.timestamp,
        source: entry.source,
      };
      pushBuffered(normalized);
      for (const listener of transcriptListeners) {
        try {
          listener(normalized);
        } catch (err) {
          console.error('[pageSession] transcript subscriber threw', err);
        }
      }
      return normalized;
    },
    subscribeTranscripts(listener): () => void {
      transcriptListeners.add(listener);
      for (const buffered of bufferedTranscripts) {
        try {
          listener(buffered);
        } catch (err) {
          console.error('[pageSession] transcript replay threw', err);
        }
      }
      return () => {
        transcriptListeners.delete(listener);
      };
    },
    getBufferedTranscripts(): readonly PageTranscriptEntry[] {
      return [...bufferedTranscripts];
    },
    getSnapshot(): PageSessionSnapshot {
      return frozenSnapshot;
    },
    setVoiceSessionId(nextVoiceSessionId: string | null): void {
      voiceSessionId = nextVoiceSessionId;
      notifySnapshot();
    },
    setConnectionState(state: PageSessionSnapshot['connectionState']): void {
      connectionState = state;
      notifySnapshot();
    },
  };

  notifySnapshot();
  return session;
}

export function installPageSession(): PageSessionHost {
  if (typeof window === 'undefined') {
    throw new Error('[pageSession] cannot install in a non-browser environment');
  }
  const existing = window[GLOBAL_KEY];
  if (existing) {
    if (existing.version !== SESSION_VERSION) {
      console.warn(
        `[pageSession] version mismatch: existing=${existing.version} new=${SESSION_VERSION}; using existing`);
    }
    return existing;
  }
  const host: PageSessionHost = {
    version: SESSION_VERSION,
    session: createPageSession(),
  };
  window[GLOBAL_KEY] = host;
  return host;
}

export function getPageSession(): PageSession | null {
  if (typeof window === 'undefined') return null;
  return window[GLOBAL_KEY]?.session ?? null;
}

export function ensurePageSession(): PageSession {
  return installPageSession().session;
}

/**
 * Test-only reset. Drops the page session from `window` so the next install
 * rebuilds session id, participants, and transcript buffer from scratch.
 */
export function __resetPageSessionForTests__(): void {
  if (typeof window !== 'undefined') {
    delete window[GLOBAL_KEY];
  }
}
