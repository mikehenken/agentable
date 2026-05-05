/**
 * MockGeminiLiveClient — drop-in replacement for `createVoiceClient` that
 * runs entirely offline.
 *
 * Same `VoiceClient` interface as `geminiLiveClient.ts`. No WebSocket, no
 * mic capture, no API key. Reads scenario data (transcripts + timing) and
 * synthesizes audio levels via easing functions so the visualiser still
 * pulses convincingly.
 *
 * Use cases:
 *  - Offline dev (no API key in env)
 *  - CI / unit-test fixtures (deterministic playback)
 *  - Demos where real Gemini Live latency is undesirable
 *
 * Selection: `useGeminiLive` selects this when no `VITE_GEMINI_API_KEY` is
 * set OR when `VITE_LANDI_MOCK=1` OR when persona supplies `mock: true`
 * (Track D follow-up).
 */
import {
  type VoiceClient,
  type VoiceClientCallbacks,
  type VoicePersonaConfig,
} from './geminiLiveClient';

/**
 * One scripted utterance in a mock voice session. The mock client speaks
 * the assistant turn over `durationMs`, emitting transcript chunks at
 * realistic pacing. Optional `userTurn` triggers a 'listening' window
 * before the assistant responds.
 */
export interface MockVoiceTurn {
  /** Transcript spoken by the assistant. */
  text: string;
  /** How long the assistant "speaks" in ms. ~50 chars/sec is natural. */
  durationMs: number;
  /** Optional preceding user turn — duration of the listening window. */
  listenForMs?: number;
}

export interface MockVoiceScenario {
  /** Identifier surfaced in logs / telemetry. */
  id: string;
  /** Optional opener spoken right after `connecting` → `speaking`. */
  greeting?: string;
  /** Sequenced turns. Readonly so JSON-imported scenarios fit. */
  turns: ReadonlyArray<MockVoiceTurn>;
}

export interface MockClientOptions {
  scenario?: MockVoiceScenario;
  /** Speed up scenario playback for tests. 1 = realtime, 2 = double speed. */
  speed?: number;
  /**
   * Auto-loop when the scenario ends. Default true so a long demo doesn't
   * dead-end after one pass. Set false in tests for deterministic timing.
   */
  loop?: boolean;
}

const DEFAULT_SCENARIO: MockVoiceScenario = {
  id: 'mock-default',
  greeting: 'Hi there. This is a mock voice session running offline.',
  turns: [
    { text: 'Tell me what you would like to explore.', durationMs: 2200, listenForMs: 2000 },
    {
      text: "Got it. Here's a quick thought: small steps, then check the result. Anything specific?",
      durationMs: 4000,
      listenForMs: 2500,
    },
    {
      text: "I'll wrap up here. Reach out anytime — I'm happy to keep going.",
      durationMs: 3000,
    },
  ],
};

/**
 * Smooth easing: maps t∈[0,1] to a perceived audio "envelope" that ramps
 * up, holds, and tails off. Cosmetic visualiser placeholder — not derived
 * from any audio analysis or DSP routine.
 */
function envelope(t: number): number {
  if (t < 0.1) return t / 0.1;
  if (t > 0.85) return (1 - t) / 0.15;
  return 1;
}

export function createMockVoiceClient(
  persona: VoicePersonaConfig,
  callbacks: VoiceClientCallbacks = {},
  options: MockClientOptions = {}
): VoiceClient {
  const speed = options.speed ?? 1;
  const loop = options.loop ?? true;
  // Greeting precedence: explicit scenario greeting wins (test authors
  // usually mean it), persona greeting fills in when scenario is silent.
  const baseScenario = options.scenario ?? DEFAULT_SCENARIO;
  const scenario: MockVoiceScenario = baseScenario.greeting
    ? baseScenario
    : persona.voiceGreeting
      ? { ...baseScenario, greeting: persona.voiceGreeting }
      : baseScenario;

  let active = false;
  let inputLevel = 0;
  let outputLevel = 0;
  // RAF-driven tick (matches real client: pauses on hidden tabs so the
  // visualiser stays consistent with WebSocket session pause semantics).
  let rafHandle: number | null = null;
  let turnTimer: ReturnType<typeof setTimeout> | null = null;
  let turnStart = 0;
  let turnDuration = 0;
  let mode: 'idle' | 'speaking' | 'listening' = 'idle';

  function clearTimers(): void {
    if (rafHandle !== null) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
    if (turnTimer !== null) {
      clearTimeout(turnTimer);
      turnTimer = null;
    }
  }

  function tickLevels(): void {
    if (!active) {
      rafHandle = null;
      return;
    }
    const now = performance.now();
    const elapsed = now - turnStart;
    const t = Math.min(1, elapsed / Math.max(1, turnDuration));
    const env = envelope(t);
    if (mode === 'speaking') {
      // Synthesised "voice" amplitude: sinusoidal jitter on top of the envelope.
      const jitter = 0.4 + 0.6 * Math.abs(Math.sin(now / 90));
      outputLevel = env * jitter * 0.85;
      inputLevel = 0;
    } else if (mode === 'listening') {
      inputLevel = env * (0.15 + 0.1 * Math.abs(Math.sin(now / 240)));
      outputLevel = 0;
    } else {
      inputLevel = 0;
      outputLevel = 0;
    }
    rafHandle = requestAnimationFrame(tickLevels);
  }

  function speak(turnIndex: number): void {
    if (!active) return;
    const turn = scenario.turns[turnIndex];
    if (!turn) {
      if (loop) {
        runListenThenSpeak(0);
      } else {
        void stop();
      }
      return;
    }
    mode = 'speaking';
    callbacks.onState?.('speaking');
    callbacks.onTranscript?.(turn.text, 'assistant');
    turnStart = performance.now();
    turnDuration = turn.durationMs / speed;
    turnTimer = setTimeout(() => {
      runListenThenSpeak(turnIndex + 1);
    }, turnDuration);
  }

  function runListenThenSpeak(nextIndex: number): void {
    if (!active) return;
    const next = scenario.turns[nextIndex];
    const listenFor = next?.listenForMs ?? 0;
    if (listenFor > 0) {
      mode = 'listening';
      callbacks.onState?.('listening');
      turnStart = performance.now();
      turnDuration = listenFor / speed;
      turnTimer = setTimeout(() => {
        speak(nextIndex);
      }, turnDuration);
    } else {
      speak(nextIndex);
    }
  }

  async function start(): Promise<void> {
    if (active) return;
    active = true;
    callbacks.onState?.('connecting');
    // RAF-driven tick begins on first frame AFTER session is open. We start
    // it here so the visualiser settles to 0 levels during the connecting
    // beat. Cancelled on stop() or when active flips false.
    rafHandle = requestAnimationFrame(tickLevels);
    // Brief "connecting" beat for realism.
    await new Promise((r) => setTimeout(r, 350 / speed));
    if (!active) return;
    // Always transition through 'listening' on session open — even when a
    // greeting will play immediately. Without this beat, `useGeminiLive`'s
    // session-tracking gate (`s === 'listening' && sessionStartRef === 0`)
    // never fires, so `landi:voice-started` is never dispatched but
    // `landi:voice-ended` (gated on the same ref) IS suppressed too.
    // Symmetric lifecycle requires symmetric state transitions.
    mode = 'listening';
    callbacks.onState?.('listening');
    if (scenario.greeting) {
      mode = 'speaking';
      callbacks.onState?.('speaking');
      callbacks.onTranscript?.(scenario.greeting, 'assistant');
      const greetMs = Math.max(1500, scenario.greeting.length * 45) / speed;
      turnStart = performance.now();
      turnDuration = greetMs;
      turnTimer = setTimeout(() => runListenThenSpeak(0), greetMs);
    } else {
      runListenThenSpeak(0);
    }
  }

  async function stop(): Promise<void> {
    if (!active) return;
    active = false;
    mode = 'idle';
    inputLevel = 0;
    outputLevel = 0;
    clearTimers();
    callbacks.onState?.('idle');
  }

  return {
    start,
    stop,
    isActive: () => active,
    getInputLevel: () => inputLevel,
    getOutputLevel: () => outputLevel,
  };
}
