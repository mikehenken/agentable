/**
 * voiceKernel — vanilla pub/sub bus for voice-call state on `window`.
 *
 * SCOPE — read this before adding anything:
 *
 *   This kernel is **narrowly scoped to voice-transport plumbing** — connection
 *   state, audio level, last transcript, transport-layer errors. It is *not*
 *   a general application state store, and it is *not* the right place for
 *   agent state (messages, plans, artifacts, tool calls).
 *
 *   Why a hand-rolled kernel instead of CopilotKit's `useCoAgent` shared state?
 *
 *     1. CopilotKit's high-level shared-state surface (`useCoAgent`,
 *        `useCopilotReadable`) lives behind a React context provider and is
 *        unavailable to non-React bundles. The Lit `<voice-call-button>`
 *        is a standalone script-tag-embeddable component with no React.
 *     2. CopilotKit's underlying vanilla primitive (`CopilotKitCore`,
 *        `agent.subscribe`) IS callable from Lit, but pulling
 *        `@copilotkit/runtime-client-gql` into the standalone button bundle
 *        would blow the 40KB ESM budget and drag the entire agent runtime
 *        onto every marketing page.
 *     3. Audio level at 60Hz is media plumbing, not agent state. It does not
 *        belong on CopilotKit's state-delta / SSE channel.
 *
 *   When CopilotKit runtime lands (M3), agent state (messages, plans,
 *   artifacts) flows through CopilotKit's `useCoAgent` inside the React
 *   canvas. This kernel stays in its lane: voice transport only. CopilotKit
 *   integration is OPTIONAL — the shell works fully without it.
 *
 * IMPLEMENTATION
 *
 *   A tiny vanilla store pinned to `window.__voiceKernel__`. Compiled into
 *   both the `<agentable-canvas>` bundle and the `<voice-call-button>`
 *   bundle so the canvas (which owns the Gemini Live WebSocket) and the
 *   button (which only commands and observes) share one source of truth
 *   without React or framework imports.
 *
 *   Idempotent install: if a previous bundle already created
 *   `window.__voiceKernel__` and the version is compatible, the existing
 *   instance is reused. This keeps the host page from accidentally creating
 *   two competing voice sessions.
 */

export type VoiceState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

export interface VoiceKernelSnapshot {
  state: VoiceState;
  level: number;
  lastTranscript: string;
  errorMessage?: string;
}

/**
 * Public voice control surface — what host pages and component consumers
 * see on `window.__voiceKernel__.voice`. Stable, documented in the README.
 */
export interface VoiceControllerPublic extends VoiceKernelSnapshot {
  start(): Promise<void>;
  stop(): Promise<void>;
  toggle(): Promise<void>;
  /**
   * Returns a referentially-STABLE snapshot. Same reference between publishes
   * — replaced (not mutated) on every `_publish`, so React's
   * `useSyncExternalStore` can safely use this directly without external
   * caching.
   */
  getSnapshot(): VoiceKernelSnapshot;
  subscribe(listener: (snapshot: VoiceKernelSnapshot) => void): () => void;
}

/**
 * Internal control surface — only `useGeminiLive` (or any other transport
 * adapter inside the canvas bundle) reaches for these. Underscore prefix
 * is the policy boundary; `VoiceController` widens to expose them so
 * the implementation can call `_setImpl` etc. without fighting types.
 */
export interface VoiceControllerInternal {
  /** Implementation registers itself and overwrites kernel start/stop. */
  _setImpl(impl: VoiceKernelImpl): void;
  /**
   * Drop the registered implementation. After this, the kernel's own
   * `start()` will hit the no-impl warn path and surface a real error
   * state — instead of silently no-op-ing through a stale stub. Used on
   * React unmount + StrictMode double-invocation cleanup.
   */
  _clearImpl(): void;
  /**
   * Implementation pushes state updates through here. Keys whose value is
   * explicitly `undefined` in the patch are *deleted* from the snapshot
   * (treat `undefined` as "clear this field"). This avoids a stale
   * `errorMessage` from leaking through after a successful retry.
   */
  _publish(patch: Partial<VoiceKernelSnapshot>): void;
}

/** Combined surface — what `createVoiceController` actually returns. */
export type VoiceController = VoiceControllerPublic & VoiceControllerInternal;

export interface VoiceKernelImpl {
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Top-level kernel namespace pinned to `window.__voiceKernel__`. Currently
 * only carries voice; future modalities (e.g. video presence, screen-share)
 * could be added as sibling controllers without breaking the contract.
 */
export interface VoiceKernel {
  version: string;
  voice: VoiceController;
}

const KERNEL_VERSION = '0.1.0';
const GLOBAL_KEY = '__voiceKernel__';

declare global {
  interface Window {
    __voiceKernel__?: VoiceKernel;
  }
}

function createVoiceController(): VoiceController {
  const listeners = new Set<(snapshot: VoiceKernelSnapshot) => void>();
  let impl: VoiceKernelImpl | null = null;
  /**
   * Synchronous in-flight latch. The snapshot's `state` field can't be the
   * sole source of truth for "is a session being started?" because state
   * doesn't transition to `'connecting'` until the impl publishes it (which
   * happens AFTER the await chain inside `impl.start()` reaches the
   * `setState('connecting')` call). A second `start()` call landing in
   * that microtask window would see `state === 'idle'`, slip past the
   * guard below, and spawn a parallel session.
   *
   * Setting `_starting = true` synchronously, before the await, closes
   * that race. Cleared in a `finally` so an impl that throws still
   * unblocks future starts.
   *
   * Symptom this fixes: clicking the header voice button while a hero CTA
   * call is connecting (or vice versa) opened two overlapping Gemini
   * Live sessions whose audio talked over each other.
   */
  let starting = false;
  const snapshot: VoiceKernelSnapshot = {
    state: 'idle',
    level: 0,
    lastTranscript: '',
  };
  // Stable snapshot reference — replaced (not mutated) on every `_publish`.
  // Required for React's `useSyncExternalStore`: between notifications,
  // `getSnapshot()` MUST return the same reference, otherwise React errors
  // with "The result of getSnapshot should be cached to avoid an infinite
  // loop." Updating this lazily inside `notify()` is enough.
  let frozenSnapshot: VoiceKernelSnapshot = { ...snapshot };

  function getSnapshot(): VoiceKernelSnapshot {
    return frozenSnapshot;
  }

  function notify(): void {
    frozenSnapshot = { ...snapshot };
    const frozen = frozenSnapshot;
    for (const fn of listeners) {
      try {
        fn(frozen);
      } catch (err) {
        console.error('[voiceKernel] subscriber threw', err);
      }
    }
  }

  const controller: VoiceController = {
    get state() {
      return snapshot.state;
    },
    get level() {
      return snapshot.level;
    },
    get lastTranscript() {
      return snapshot.lastTranscript;
    },
    get errorMessage() {
      return snapshot.errorMessage;
    },
    async start() {
      if (!impl) {
        console.warn('[voiceKernel] start called before implementation registered');
        return;
      }
      // Race-safe multi-call guard. See `starting` declaration for context.
      if (starting) {
        console.info('[voiceKernel] start() ignored — a session is already starting');
        return;
      }
      if (snapshot.state !== 'idle' && snapshot.state !== 'error') return;
      starting = true;
      try {
        await impl.start();
      } finally {
        starting = false;
      }
    },
    async stop() {
      if (!impl) return;
      // Stopping during the connecting window is allowed — the user wants
      // out before audio starts. Clear the latch so a subsequent start()
      // isn't blocked.
      starting = false;
      if (snapshot.state === 'idle') return;
      await impl.stop();
    },
    getSnapshot,
    async toggle() {
      if (snapshot.state === 'idle' || snapshot.state === 'error') {
        await this.start();
      } else {
        await this.stop();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      // Push current snapshot immediately so subscribers don't have to wait
      // for the next state change to render.
      try {
        listener(getSnapshot());
      } catch (err) {
        console.error('[voiceKernel] initial subscriber call threw', err);
      }
      return () => {
        listeners.delete(listener);
      };
    },
    _setImpl(next) {
      impl = next;
    },
    _clearImpl() {
      impl = null;
    },
    _publish(patch) {
      // Treat `undefined` as "delete this key" so optional fields like
      // `errorMessage` can be cleared on idle transitions without stale leaks.
      for (const key of Object.keys(patch) as Array<keyof VoiceKernelSnapshot>) {
        const value = patch[key];
        if (value === undefined) {
          delete (snapshot as Partial<VoiceKernelSnapshot>)[key];
        } else {
          (snapshot as unknown as Record<string, unknown>)[key] = value;
        }
      }
      notify();
    },
  };

  return controller;
}

/**
 * Install (or reuse) the singleton kernel on `window.__voiceKernel__`. Safe
 * to call from multiple bundles; only the first call creates the kernel.
 */
export function installVoiceKernel(): VoiceKernel {
  if (typeof window === 'undefined') {
    throw new Error('[voiceKernel] cannot install in a non-browser environment');
  }
  const existing = window[GLOBAL_KEY];
  if (existing) {
    if (existing.version !== KERNEL_VERSION) {
      console.warn(
        `[voiceKernel] version mismatch: existing=${existing.version} new=${KERNEL_VERSION}; using existing`
      );
    }
    return existing;
  }
  const kernel: VoiceKernel = {
    version: KERNEL_VERSION,
    voice: createVoiceController(),
  };
  window[GLOBAL_KEY] = kernel;
  return kernel;
}

/** Read the kernel without installing. Returns null if not yet installed. */
export function getVoiceKernel(): VoiceKernel | null {
  if (typeof window === 'undefined') return null;
  return window[GLOBAL_KEY] ?? null;
}

/** Read-or-install convenience used by the React canvas + Lit button. */
export function ensureVoiceKernel(): VoiceKernel {
  return installVoiceKernel();
}

/**
 * Test-only reset. Drops the kernel from `window` so the next
 * `installVoiceKernel()` call rebuilds it from scratch (fresh
 * subscribers, fresh impl registration, fresh snapshot identity).
 *
 * Window-attribute deletion alone isn't sufficient — module-scope state
 * inside `createVoiceController` (closures, timers, in-flight promises)
 * survives. Today the controller has no module-level state, but this
 * function is the contractual escape hatch for tests AND a future-proofed
 * cleanup point if the kernel grows worker-backed primitives.
 *
 * Production code MUST NOT call this — it would orphan live voice
 * sessions. Only test setup/teardown.
 */
export function __resetKernelForTests__(): void {
  if (typeof window !== 'undefined') {
    delete window[GLOBAL_KEY];
  }
}
