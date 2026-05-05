/**
 * React hook wrapping the Gemini Live client.
 *
 * Bridges the React canvas to the shared `window.__voiceKernel__` bus:
 *  - Registers `start` / `stop` as the kernel's voice implementation, so any
 *    bundle that loaded the kernel (e.g. `<voice-call-button>`) can
 *    drive the call.
 *  - Publishes state, audio levels, and the latest assistant transcript into
 *    the kernel so subscribers re-render in lockstep.
 *  - Listens for `landi:voice-start-requested` / `-end-requested` window
 *    events. This is the canvas's PUBLIC command API for hosts that haven't
 *    imported the kernel directly (frame boundaries, late-loaded bundles,
 *    non-React hosts). `<agentable-canvas>.startVoiceCall()` /
 *    `.endVoiceCall()` dispatch these same events. Equivalent to
 *    `window.__voiceKernel__.voice.start()` / `.stop()` for callers that
 *    have the kernel reference. Names will be neutralised
 *    (`voicecall:start-requested` etc.) at OSS-publish time — see plan §C.
 *
 * Dispatches `landi:voice-started` / `landi:voice-ended` for parent-page
 * lifecycle observability (matches `events/landi-events.ts` types).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createVoiceClient,
  type VoiceClient,
  type VoiceState,
  type VoicePersonaConfig,
} from './geminiLiveClient';
import {
  createMockVoiceClient,
  type MockVoiceScenario,
} from './mockGeminiLiveClient';
import { ensureVoiceKernel } from '../../shared/voiceKernel';

// Module-level one-shot guard for the mount-time diagnostic at the
// bottom of `useGeminiLive`. Lives outside the hook so adding/removing
// the diagnostic doesn't perturb the component's hook-order contract
// (which HMR can't recover from). Resets only on full module reload —
// fine for a once-per-page-load console.info.
let hasLoggedMount = false;

export interface UseGeminiLiveOptions {
  /**
   * Voice persona — system prompt and optional opening greeting.
   * Tenant-injected. Tenants supply persona values via their own wrapper
   * package; the OSS canvas core carries no tenant-specific defaults.
   */
  persona: VoicePersonaConfig;
  /** Auto-start on first mount (for debug). Defaults to false. */
  autoStart?: boolean;
  /**
   * Force mock mode. When true, uses `MockGeminiLiveClient` regardless of
   * env. When false / undefined, mock is selected only if no API key is set
   * OR `VITE_LANDI_MOCK=1`. Useful for tests and offline demos.
   */
  forceMock?: boolean;
  /** Optional scripted scenario for mock mode. Defaults to the built-in. */
  mockScenario?: MockVoiceScenario;
  /**
   * Backplane endpoint that mints ephemeral Gemini Live tokens (Phase A).
   * When set, this URL takes priority over `VITE_GEMINI_API_KEY` — the hook
   * fetches a fresh short-lived token at session start instead of baking
   * the long-lived key into the client bundle. Pass the worker's full URL,
   * e.g. `https://your-agent.example.workers.dev/v1/voice/token`.
   *
   * The fetched token is cached for the session lifetime (typically 20 min,
   * configurable on the worker side). On `stop()`, the cache is cleared so
   * the next session mints a fresh token.
   *
   * Falls back to `VITE_GEMINI_API_KEY` (dev path) when omitted.
   */
  tokenEndpoint?: string;
}

export interface UseGeminiLiveResult {
  state: VoiceState;
  error: string | null;
  inputLevel: number;
  outputLevel: number;
  lastTranscript: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  toggle: () => Promise<void>;
  available: boolean;
}

function dispatch(type: string, detail: Record<string, unknown> = {}): void {
  window.dispatchEvent(
    new CustomEvent(type, {
      detail: { ...detail, timestamp: new Date().toISOString() },
      bubbles: true,
      composed: true,
    })
  );
}

export function useGeminiLive(options: UseGeminiLiveOptions): UseGeminiLiveResult {
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY ?? '') as string;
  const envMock = (import.meta.env.VITE_LANDI_MOCK ?? '') === '1';
  const isProd = (import.meta.env.MODE ?? import.meta.env.NODE_ENV) === 'production';
  /**
   * Phase A backplane integration. When `tokenEndpoint` is set, we have a
   * credential source even if `VITE_GEMINI_API_KEY` is unset — the worker
   * mints ephemeral tokens on demand. Treat as a credential for `useMock`
   * + `available` calculations.
   */
  const tokenEndpoint = options.tokenEndpoint?.trim() ?? '';
  const hasCredential = apiKey.length > 0 || tokenEndpoint.length > 0;
  // Mock mode is selected when explicitly forced, when env requests it, OR
  // when no credential is available AND we're in dev. Production with no
  // credential is a misconfiguration we WARN loudly about — silently routing
  // prod users to a fake assistant is the worst-of-both-worlds failure mode.
  const useMock =
    Boolean(options.forceMock) || envMock || (!hasCredential && !isProd);
  if (!hasCredential && isProd && !options.forceMock && !envMock) {
     
    console.error(
      '[voiceKernel] PRODUCTION misconfiguration: neither VITE_GEMINI_API_KEY ' +
        'nor `tokenEndpoint` is set, and VITE_LANDI_MOCK is not enabled. The ' +
        'voice CTA will fail. Set the API key, point `tokenEndpoint` at your ' +
        'agent worker mint endpoint, OR explicitly opt into mock mode with ' +
        'VITE_LANDI_MOCK=1 / <CareerCanvas mockOnly>.'
    );
  }
  // `available` flips to true when ANY transport works — real OR mock.
  // Otherwise the OSS canvas would always show "voice unavailable" until
  // a credential was wired, even though mock mode would happily run.
  const available = !hasCredential ? useMock : true;
  const personaRef = useRef(options.persona);
  // Keep persona ref fresh so prompt edits don't require full remount during
  // dev — actual session uses the value captured when the WebSocket opens.
  personaRef.current = options.persona;

  /** When voice name or system prompt changes, tear down the client so the next `start()` rebuilds with new config. */
  const voicePersonaKey = useMemo(
    () =>
      `${options.persona.geminiVoiceName ?? 'Aoede'}\u0000${options.persona.systemPrompt}`,
    [options.persona.geminiVoiceName, options.persona.systemPrompt]
  );

  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [lastTranscript, setLastTranscript] = useState('');
  const clientRef = useRef<VoiceClient | null>(null);
  const sessionIdRef = useRef<string>('');
  const sessionStartRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const kernelRef = useRef(ensureVoiceKernel());
  /**
   * Session-lifetime cache for ephemeral tokens minted via `tokenEndpoint`.
   * The Gemini auth-token API takes ~400ms; caching across rapid
   * stop()/start() cycles within the same session window avoids re-paying
   * that latency. `expireTime` includes a 30s safety buffer so the cached
   * token isn't returned when it's about to expire mid-WebSocket-handshake.
   * Cleared on hard error / persona swap (component unmount or rebuild).
   */
  const tokenCacheRef = useRef<{ token: string; expiresAt: number } | null>(null);

  const ensureClient = useCallback((): VoiceClient | null => {
    if (!available) {
      // `available === false` ⇔ no credential configured (neither
      // `VITE_GEMINI_API_KEY` nor `tokenEndpoint`). The earlier "tokenEndpoint
      // set but unreachable" branch was dead — when `tokenEndpoint` is set,
      // `hasCredential = true` ⇒ `available = true`. Any worker-side
      // failure surfaces as a thunk rejection in `start()` instead.
      const msg = 'no Gemini credential configured (set VITE_GEMINI_API_KEY or tokenEndpoint)';
      setError(msg);
      setState('error');
      kernelRef.current.voice._publish({
        state: 'error',
        errorMessage: msg,
      });
      return null;
    }
    if (!clientRef.current) {
      const callbacks = {
        onState: (s: VoiceState) => {
          setState(s);
          // Clear stale errorMessage when transitioning to a non-error state
          // so chip / aria-live regions don't leak the previous failure.
          if (s !== 'error') {
            kernelRef.current.voice._publish({ state: s, errorMessage: undefined });
          } else {
            kernelRef.current.voice._publish({ state: s });
          }
          if (s === 'error') return;
          if (s === 'listening' && sessionStartRef.current === 0) {
            sessionStartRef.current = Date.now();
            sessionIdRef.current = `vs_${sessionStartRef.current.toString(36)}`;
            dispatch('landi:voice-started', { sessionId: sessionIdRef.current });
          }
          if (s === 'idle' && sessionStartRef.current > 0) {
            dispatch('landi:voice-ended', {
              sessionId: sessionIdRef.current,
              durationMs: Date.now() - sessionStartRef.current,
              transcript: '',
            });
            sessionStartRef.current = 0;
            sessionIdRef.current = '';
          }
        },
        onError: (e: Error) => {
          setError(e.message);
          kernelRef.current.voice._publish({ state: 'error', errorMessage: e.message });
        },
        onTranscript: (text: string, role: 'user' | 'assistant') => {
          if (role === 'assistant') {
            setLastTranscript(text);
            kernelRef.current.voice._publish({ lastTranscript: text });
          }
          // Broadcast every transcript fragment so the chat panel (and any
          // host-page listener doing analytics or transcript capture) can
          // mirror voice into a unified message thread. Bubbles + composed
          // so it crosses Shadow DOM into embedder pages.
          window.dispatchEvent(
            new CustomEvent('landi:voice-transcript', {
              detail: {
                role,
                text,
                timestamp: new Date().toISOString(),
              },
              bubbles: true,
              composed: true,
            }),
          );
        },
        onToolCall: (call: { name: string; args: Record<string, unknown>; ok: boolean }) => {
          // Mirror to host page; chat panel uses this to render
          // "Assistant opened Open Positions" inline messages.
          window.dispatchEvent(
            new CustomEvent('landi:voice-tool-call', {
              detail: { ...call, timestamp: new Date().toISOString() },
              bubbles: true,
              composed: true,
            }),
          );
        },
        onBargeIn: () => {
          window.dispatchEvent(
            new CustomEvent('landi:voice-bargein', {
              detail: { timestamp: new Date().toISOString() },
              bubbles: true,
              composed: true,
            }),
          );
        },
      };
      // Select transport: mock when forced/no-key, real Gemini Live otherwise.
      // Log which transport was selected + the persona summary so embedders
      // can diagnose "the assistant lost its brand knowledge" symptoms by
      // reading the console BEFORE clicking the voice button. Fires once
      // per client construction (typically once per page load). No PII; safe.
      // `VoicePersonaConfig` (the type useGeminiLive consumes) is narrow —
      // it intentionally omits assistantName/tenantTitle (those live on
      // the wider `CanvasPersona` consumed by VoiceWidget/ChatPanel). The
      // diagnostic only needs the voice-transport-relevant fields.
      const personaSummary = {
        systemPromptChars: personaRef.current.systemPrompt?.length ?? 0,
        systemPromptHead: (personaRef.current.systemPrompt ?? '').slice(0, 80),
        voiceGreetingChars: personaRef.current.voiceGreeting?.length ?? 0,
        geminiVoiceName: personaRef.current.geminiVoiceName ?? 'Aoede',
      };
       
      console.info(
        `[voiceKernel] transport=${useMock ? 'MOCK' : 'real Gemini Live'}; persona:`,
        personaSummary
      );
      /**
       * Pick credential source. Backplane endpoint takes priority over the
       * static env-baked key — agencies migrating from dev (env key) to
       * prod (worker mint) just set `tokenEndpoint` and the static key
       * stops being read at session start. The thunk caches across rapid
       * stop()/start() within the session window to avoid re-paying the
       * ~400ms Gemini token-mint latency.
       */
      const apiKeySource = tokenEndpoint
        ? async () => {
            const cached = tokenCacheRef.current;
            const now = Date.now();
            if (cached && cached.expiresAt > now) {
              return cached.token;
            }
            const response = await fetch(tokenEndpoint, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              credentials: 'omit',
              body: JSON.stringify({}),
            });
            if (!response.ok) {
              const detail = await response.text().catch(() => '');
              throw new Error(
                `[voiceKernel] token mint failed: HTTP ${response.status} ${detail.slice(0, 200)}`,
              );
            }
            const data = (await response.json()) as { token?: string; expireTime?: string };
            if (!data.token) {
              throw new Error('[voiceKernel] token mint response missing `token` field');
            }
            // Cache with a 30s safety buffer so the token isn't handed out
            // when it's about to expire mid-WebSocket-handshake.
            const expireMs = data.expireTime ? new Date(data.expireTime).getTime() : now + 1200_000;
            tokenCacheRef.current = { token: data.token, expiresAt: expireMs - 30_000 };
            return data.token;
          }
        : apiKey;

      clientRef.current = useMock
        ? createMockVoiceClient(personaRef.current, callbacks, {
            scenario: options.mockScenario,
          })
        : createVoiceClient(apiKeySource, personaRef.current, callbacks);
    }
    return clientRef.current;
  }, [apiKey, tokenEndpoint, available, useMock, options.mockScenario]);

  useEffect(() => {
    void clientRef.current?.stop();
    clientRef.current = null;
  }, [voicePersonaKey]);

  const start = useCallback(async () => {
    setError(null);
    kernelRef.current.voice._publish({ errorMessage: undefined });
    const c = ensureClient();
    if (!c) return;
    await c.start();
  }, [ensureClient]);

  const stop = useCallback(async () => {
    await clientRef.current?.stop();
  }, []);

  const toggle = useCallback(async () => {
    const c = clientRef.current;
    if (c?.isActive()) {
      await stop();
    } else {
      await start();
    }
  }, [start, stop]);

  // Register this hook as the kernel's voice implementation so any bundle
  // that loaded the kernel (e.g. the Lit voice button) can drive the call.
  //
  // W5 fix: do NOT depend on `[start, stop]` directly — those identities
  // change every render even though their behavior is stable, which would
  // re-register the impl on every render and (worse) tear down + re-create
  // the registration mid-session. Instead, we depend on nothing and use
  // refs to read the latest callbacks at call time.
  const startRef = useRef(start);
  const stopRef = useRef(stop);
  startRef.current = start;
  stopRef.current = stop;
  useEffect(() => {
    const kernel = kernelRef.current;
    kernel.voice._setImpl({
      start: () => startRef.current(),
      stop: () => stopRef.current(),
    });
    return () => {
      // On unmount, fully clear the impl rather than installing a warn-stub.
      // A truthy stub would defeat the kernel's `if (!impl)` guard, masking
      // a real failure as a silent no-op. With `_clearImpl()`, kernel.start()
      // hits the no-impl path, warns, and the button user gets feedback.
      kernel.voice._clearImpl();
    };
  }, []);

  // Poll audio levels for the visualiser + push the highest current level
  // into the kernel for the Lit button's mic-dot indicator.
  //
  // - Gated on `available`: when no API key is set, no RAF runs at all.
  // - Only publishes to the kernel when the *quantised* level actually
  //   changes, so an idle button doesn't trigger a 60Hz publish/notify
  //   storm across every subscriber.
  useEffect(() => {
    if (!available) return;
    let prevPublishedLevel = -1;
    const QUANTUM = 0.01; // ignore sub-1% jitter; matches level-dot resolution
    const tick = () => {
      const c = clientRef.current;
      let nextLevel = 0;
      if (c && c.isActive()) {
        const inLvl = c.getInputLevel();
        const outLvl = c.getOutputLevel();
        setInputLevel(inLvl);
        setOutputLevel(outLvl);
        nextLevel = Math.max(inLvl, outLvl);
      } else {
        setInputLevel(0);
        setOutputLevel(0);
        nextLevel = 0;
      }
      const quantised = Math.round(nextLevel / QUANTUM) * QUANTUM;
      if (quantised !== prevPublishedLevel) {
        prevPublishedLevel = quantised;
        kernelRef.current.voice._publish({ level: quantised });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [available]);

  // The canvas's public command API: hosts can dispatch
  // `window.dispatchEvent(new CustomEvent('landi:voice-start-requested'))`
  // to trigger a session without importing the kernel. Equivalent to
  // `window.__voiceKernel__.voice.start()` but works from frame
  // boundaries / non-React hosts that haven't loaded the canvas bundle yet.
  // (See <agentable-canvas>.startVoiceCall() / endVoiceCall() — they
  // dispatch these same events.)
  useEffect(() => {
    const onStart = () => {
      void start();
    };
    const onEnd = () => {
      void stop();
    };
    window.addEventListener('landi:voice-start-requested', onStart);
    window.addEventListener('landi:voice-end-requested', onEnd);
    return () => {
      window.removeEventListener('landi:voice-start-requested', onStart);
      window.removeEventListener('landi:voice-end-requested', onEnd);
    };
  }, [start, stop]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      void clientRef.current?.stop();
      clientRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (options.autoStart) void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Page-load diagnostic — module-level one-shot, NOT a hook. Adding a
  // new hook to this function under HMR triggers React's "rendered more
  // hooks than during previous render" error because the running mount
  // had a different hook list. The module-level guard sidesteps hooks
  // entirely and still fires exactly once per page load. (User-flagged
  // hooks-order error 2026-04-25.)
  if (!hasLoggedMount) {
    hasLoggedMount = true;
     
    console.info('[voiceKernel] useGeminiLive mounted', {
      transportSelected: useMock ? 'MOCK' : 'real Gemini Live',
      apiKeyPresent: apiKey.length > 0,
      envMock,
      systemPromptChars: options.persona.systemPrompt?.length ?? 0,
      systemPromptHead: (options.persona.systemPrompt ?? '').slice(0, 80),
      voiceGreetingChars: options.persona.voiceGreeting?.length ?? 0,
      geminiVoiceName: options.persona.geminiVoiceName ?? 'Aoede',
    });
  }

  return { state, error, inputLevel, outputLevel, lastTranscript, start, stop, toggle, available };
}
