/**
 * useVoiceCall — first-class React hook into the voice kernel.
 *
 * Any React host (a marketing nav button, a custom CTA, a Storybook story)
 * uses this to subscribe to voice state without reaching into
 * `window.__voiceKernel__` by hand.
 *
 * Stable snapshots — `useSyncExternalStore` requires `getSnapshot` to return
 * a referentially-stable value when nothing changed. The kernel's
 * `voice.getSnapshot()` is the single source of that stable reference; it
 * replaces the frozen object on every `_publish`. No external caching needed.
 */
import { useSyncExternalStore } from 'react';
import {
  ensureVoiceKernel,
  type VoiceKernelSnapshot,
  type VoiceState,
} from '../shared/voiceKernel';

const EMPTY_SNAPSHOT: VoiceKernelSnapshot = {
  state: 'idle',
  level: 0,
  lastTranscript: '',
  errorMessage: undefined,
};

function subscribe(cb: () => void): () => void {
  const kernel = ensureVoiceKernel();
  return kernel.voice.subscribe(() => cb());
}

function getSnapshot(): VoiceKernelSnapshot {
  return ensureVoiceKernel().voice.getSnapshot();
}

function getServerSnapshot(): VoiceKernelSnapshot {
  return EMPTY_SNAPSHOT;
}

/**
 * Default label resolver — exhaustive switch over `VoiceState` so the
 * compiler catches future state additions. Override by reading `state`
 * directly if you need fully custom copy.
 */
export function defaultVoiceLabel(state: VoiceState, idleLabel = 'Talk'): string {
  switch (state) {
    case 'idle':
      return idleLabel;
    case 'connecting':
      return 'Connecting…';
    case 'listening':
      return 'End call';
    case 'speaking':
      return 'End call';
    case 'error':
      return 'Try again';
    default: {
      // Compile-time exhaustiveness check.
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export interface UseVoiceCallResult {
  /** Current kernel state — exhaustive `VoiceState` union. */
  state: VoiceState;
  /** Last published mic/output level, 0..1. Polled by canvas at ~60Hz. */
  level: number;
  /** True when state is connecting / listening / speaking. */
  isActive: boolean;
  /** Last transport-layer error message, if any. */
  errorMessage: string | undefined;
  /**
   * Heuristic: false when the kernel is in `error` state with the
   * specific "no API key" message, otherwise true. This is NOT a real
   * registration check — the kernel doesn't expose `impl !== null`
   * publicly. Hosts SHOULD still disable the CTA when this is false to
   * avoid letting users tap into a guaranteed-error state.
   *
   * TODO(M2): expose `kernel.voice.implRegistered: boolean` and read it
   * here for an honest signal.
   */
  available: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

export function useVoiceCall(): UseVoiceCallResult {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const kernel = ensureVoiceKernel();
  const isActive =
    snap.state === 'connecting' || snap.state === 'listening' || snap.state === 'speaking';
  // The kernel's transport impl is registered by `useGeminiLive` on canvas
  // mount. Until then, calling `start()` hits the no-impl warn path. We
  // surface that as `available: false` so consumers can disable their CTA.
  // We can't introspect `impl` directly (it's closed-over), but a reliable
  // proxy is whether a no-API-key error has fired (the canvas's
  // useGeminiLive publishes that error before any user action).
  const available = snap.state !== 'error' || snap.errorMessage !== 'VITE_GEMINI_API_KEY is not set';

  return {
    state: snap.state,
    level: snap.level,
    errorMessage: snap.errorMessage,
    isActive,
    available,
    start: () => void kernel.voice.start(),
    stop: () => void kernel.voice.stop(),
    toggle: () => void kernel.voice.toggle(),
  };
}
