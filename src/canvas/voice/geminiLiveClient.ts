/**
 * Gemini Live client for the Career Concierge voice widget.
 *
 * Responsibilities:
 *  - Open a Live API WebSocket session to `gemini-3.1-flash-live-preview`.
 *  - Capture microphone audio, downsample to 16 kHz mono Int16 PCM via an
 *    AudioWorklet, and stream it to the model in real time.
 *  - Decode 24 kHz Int16 PCM audio returned by the model and play it back
 *    through a WebAudio source queue.
 *  - Expose input/output RMS levels for visualisation.
 *
 * The client is transport-only — it doesn't know about React. A hook wraps
 * it for UI integration.
 *
 * The credential can be supplied two ways:
 *  - **Static key (dev):** pass `apiKey: "AIza..."` from `VITE_GEMINI_API_KEY`.
 *    Bakes the long-lived key into the client bundle. Acceptable for local dev.
 *  - **Ephemeral token resolver (prod):** pass a function `() => Promise<string>`
 *    that fetches a fresh token from your worker's `POST /v1/voice/token` mint
 *    endpoint (Phase A backplane). The function is invoked once per `start()`
 *    so the WebSocket opens with a minted, short-lived credential. The
 *    long-lived API key never leaves the worker.
 */

import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from '@google/genai';
import { PCM_WORKLET_SOURCE } from './pcmWorklet';
// Single source of truth for the voice state union — kernel + client must
// agree, so import from kernel rather than duplicating the literal union here.
import { type VoiceState } from '../../shared/voiceKernel';
import {
  executeTool,
  getFunctionDeclarations,
} from '../tools/canvasTools';

export type { VoiceState } from '../../shared/voiceKernel';

export interface VoiceClientCallbacks {
  onState?: (state: VoiceState) => void;
  onError?: (error: Error) => void;
  onTranscript?: (text: string, role: 'user' | 'assistant') => void;
  /** Fired when the agent invokes a canvas tool. Useful for chat-panel echo. */
  onToolCall?: (call: { name: string; args: Record<string, unknown>; ok: boolean }) => void;
  /**
   * Fired when client-side barge-in detection determines the user is
   * trying to interrupt. Lets the React layer surface a visual hint and
   * triggers a local playback flush.
   */
  onBargeIn?: () => void;
}

/**
 * Tenant-injected voice persona config. Kept out of the OSS canvas core —
 * each tenant supplies its own values via `<CanvasShell config>`.
 */
export interface VoicePersonaConfig {
  /** Full system instruction string passed to the model. */
  systemPrompt: string;
  /**
   * Optional opening line the model speaks when the call connects. Pass empty
   * string to skip the greeting and let the user speak first.
   */
  voiceGreeting?: string;
  /**
   * Gemini Live prebuilt voice name (e.g. `Aoede`, `Kore`). When omitted,
   * defaults to `Aoede`. Injected by tenant wrappers (often surfaced as
   * a URL `?voice=` preset on demos).
   */
  geminiVoiceName?: string;
}

export interface VoiceClient {
  start(): Promise<void>;
  stop(): Promise<void>;
  isActive(): boolean;
  getInputLevel(): number;
  getOutputLevel(): number;
}

const MODEL = 'gemini-3.1-flash-live-preview';
const DEFAULT_GEMINI_VOICE_NAME = 'Aoede'; // Warm female-presenting prebuilt default.
const OUTPUT_SAMPLE_RATE = 24000;

/**
 * Barge-in tuning constants.
 *
 *  - `BARGE_IN_LEVEL_THRESHOLD`: normalised input RMS above which a frame
 *    counts toward the barge-in window. 0.18 ≈ "louder than ambient breath
 *    but quieter than an inside-voice question" — empirically tuned to fire
 *    on assertive interruptions ("wait — hold on a sec") without firing on
 *    background noise.
 *  - `BARGE_IN_FRAMES_REQUIRED`: how many consecutive (or near-consecutive
 *    within the recent window) loud frames trigger interrupt. The mic
 *    publishes at ~50Hz from the worklet, so 6 frames ≈ 120ms — short
 *    enough that the assistant stops mid-sentence; long enough to ignore
 *    a single cough or door slam.
 *  - `BARGE_IN_WINDOW_FRAMES`: rolling window for counting. 30 frames ≈
 *    600ms; if 6+ of the last 30 are above threshold, treat it as user
 *    intent to interrupt.
 *
 * Why client-side detection on top of Gemini's server-side VAD: the model's
 * built-in VAD is generous (it favours letting the assistant finish its
 * sentence) which leaves a frustrating "it keeps talking" feel when the
 * user actively wants to interject. Adding a tighter client-side detector
 * forwards the interrupt signal sooner and flushes playback locally.
 */
const BARGE_IN_LEVEL_THRESHOLD = 0.18;
const BARGE_IN_FRAMES_REQUIRED = 6;
const BARGE_IN_WINDOW_FRAMES = 30;
/** Cooldown after a fired barge-in before another can fire (ms). */
const BARGE_IN_COOLDOWN_MS = 800;

function base64Encode(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < arr.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(arr.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

function base64Decode(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Either a static API key (dev) or a thunk that resolves to one (prod —
 * fetches an ephemeral token from the backplane mint endpoint per session).
 */
export type ApiKeySource = string | (() => Promise<string>);

export function createVoiceClient(
  apiKeySource: ApiKeySource,
  persona: VoicePersonaConfig,
  callbacks: VoiceClientCallbacks = {}
): VoiceClient {
  let session: Session | null = null;
  let micStream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let micSource: MediaStreamAudioSourceNode | null = null;
  let playbackCtx: AudioContext | null = null;
  let playbackQueueTime = 0;
  let active = false;
  let currentVoiceState: VoiceState = 'idle';
  let inputLevel = 0;
  let outputLevel = 0;
  let outputLevelDecay: number | null = null;
  /**
   * Rolling barge-in window. Each frame, we push a 1 (above threshold) or
   * 0 (below) and trim to BARGE_IN_WINDOW_FRAMES. Only consulted when
   * `currentVoiceState === 'speaking'`.
   */
  const bargeInFrames: number[] = [];
  let lastBargeInAt = 0;
  /**
   * Active playback source nodes. Tracking them lets us proactively call
   * `.stop()` on barge-in so queued audio buffers cancel immediately
   * instead of just being dequeued (the assistant would finish its current
   * word even after `serverContent.interrupted` because the
   * AudioBufferSourceNode keeps playing once started).
   */
  const activeSources = new Set<AudioBufferSourceNode>();

  const setState = (s: VoiceState) => {
    currentVoiceState = s;
    if (s !== 'speaking') {
      // Clear the rolling barge-in window when leaving the speaking state
      // so a long pause then a new utterance doesn't fire on stale frames.
      bargeInFrames.length = 0;
    }
    callbacks.onState?.(s);
  };

  function flushPlayback(): void {
    if (!playbackCtx) return;
    // Drop the queued time forward so any not-yet-started buffers won't.
    playbackQueueTime = playbackCtx.currentTime;
    // Hard-stop anything already playing — `start()`-ed sources keep playing
    // even after the queue head advances, so we have to walk and stop them.
    for (const src of activeSources) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    activeSources.clear();
  }

  function maybeFireBargeIn(level: number): void {
    if (currentVoiceState !== 'speaking') return;
    bargeInFrames.push(level >= BARGE_IN_LEVEL_THRESHOLD ? 1 : 0);
    if (bargeInFrames.length > BARGE_IN_WINDOW_FRAMES) {
      bargeInFrames.shift();
    }
    const loudCount = bargeInFrames.reduce((sum, v) => sum + v, 0);
    if (loudCount < BARGE_IN_FRAMES_REQUIRED) return;

    const now = Date.now();
    if (now - lastBargeInAt < BARGE_IN_COOLDOWN_MS) return;
    lastBargeInAt = now;
    bargeInFrames.length = 0;

    // Local-side flush so the assistant stops talking THIS frame, not
    // after the server's VAD eventually catches up.
    flushPlayback();
    setState('listening');
    callbacks.onBargeIn?.();
    /**
     * Tell the server explicitly. `sendClientContent` with a brief user
     * turn nudges the model to abandon its current generation and listen.
     * Wrapped in try/catch because session could be mid-teardown.
     */
    try {
      session?.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: '(user is interrupting — stop speaking and listen)' }] }],
        turnComplete: false,
      });
    } catch {
      /* ignore — flushPlayback already locally stopped speech */
    }
  }

  const fail = (err: unknown) => {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('[voice] error:', e);
    callbacks.onError?.(e);
    setState('error');
    void stop();
  };

  async function start() {
    if (active) return;
    active = true;
    setState('connecting');

    // Once-per-session diagnostic so embedders can verify the persona
    // actually reached the live client. If the systemPrompt is empty or
    // truncated here, the assistant will respond in generic Gemini
    // default voice — the user-visible symptom is "the assistant lost
    // its brand knowledge." No PII; safe to log.
     
    const prebuiltVoiceName =
      persona.geminiVoiceName?.trim() || DEFAULT_GEMINI_VOICE_NAME;
    console.info(
      '[voiceKernel] Gemini Live session starting — persona check:',
      {
        systemPromptChars: persona.systemPrompt?.length ?? 0,
        systemPromptHead: (persona.systemPrompt ?? '').slice(0, 80),
        voiceGreetingChars: persona.voiceGreeting?.length ?? 0,
        geminiVoiceName: prebuiltVoiceName,
      }
    );

    try {
      /**
       * Resolve the credential just-in-time. Static-string path (dev) is a
       * sync no-op; thunk path (prod) fetches a fresh ephemeral token from
       * the backplane mint endpoint. The thunk should handle its own
       * caching — this site invokes once per `start()`, which is once per
       * session. (Phase A backplane: client-side switch.)
       */
      const apiKey =
        typeof apiKeySource === 'function' ? await apiKeySource() : apiKeySource;
      const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1alpha' });

      // Map our flat ToolDeclaration shape to the Gemini Live function-
      // declaration shape. `parametersJsonSchema` accepts an `unknown` —
      // skipping the strict `Schema` type means we don't have to mirror
      // the SDK's OpenAPI variants and we can keep the canvas tool
      // registry framework-agnostic.
      const functionDeclarations = getFunctionDeclarations().map((d) => ({
        name: d.name,
        description: d.description,
        parametersJsonSchema: d.parameters,
      }));
      session = await ai.live.connect({
        model: MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: persona.systemPrompt,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: prebuiltVoiceName },
            },
          },
          // Canvas tool surface — the agent can call these to drive the UI
          // (open panels, select jobs, search, etc). Same registry powers
          // the chat path, so the agent has a consistent capability map
          // across modalities. See `canvasTools.ts` for declarations.
          tools: [{ functionDeclarations }],
        },
        callbacks: {
          onopen: () => {
            setState('listening');
            // Kick off with a spoken greeting so the user hears confirmation.
            // Skip if no greeting was provided — let the user speak first.
            if (persona.voiceGreeting) {
              session?.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: `Start the call with this exact greeting spoken aloud: "${persona.voiceGreeting}"` }] }],
                turnComplete: true,
              });
            }
          },
          onmessage: handleServerMessage,
          onerror: (e: ErrorEvent) => fail(new Error(e.message || 'WebSocket error')),
          onclose: () => {
            if (active) {
              // Unexpected close → surface as error.
              fail(new Error('Live session closed unexpectedly'));
            }
          },
        },
      });

      // Mic capture.
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      audioCtx = new AudioContext({ sampleRate: 48000 });
      const workletBlob = new Blob([PCM_WORKLET_SOURCE], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(workletBlob);
      await audioCtx.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      micSource = audioCtx.createMediaStreamSource(micStream);
      workletNode = new AudioWorkletNode(audioCtx, 'pcm-downsampler');
      workletNode.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; level: number }>) => {
        if (!session || !active) return;
        inputLevel = e.data.level;
        // Barge-in: if user starts talking while the assistant is speaking, fire
        // local interrupt + push a server-side stop signal. See
        // `maybeFireBargeIn` for thresholds + cooldown rationale.
        maybeFireBargeIn(e.data.level);
        const b64 = base64Encode(e.data.pcm);
        try {
          session.sendRealtimeInput({
            audio: { data: b64, mimeType: 'audio/pcm;rate=16000' },
          });
        } catch (err) {
          fail(err);
        }
      };
      micSource.connect(workletNode);
      // Do NOT connect worklet to destination — we don't want mic echo.

      playbackCtx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      playbackQueueTime = playbackCtx.currentTime;
    } catch (err) {
      fail(err);
    }
  }

  function handleServerMessage(msg: LiveServerMessage) {
    try {
      // Audio parts.
      const parts = msg.serverContent?.modelTurn?.parts ?? [];
      for (const part of parts) {
        const inline = part.inlineData;
        if (inline?.data && inline.mimeType?.startsWith('audio/pcm')) {
          playPcmChunk(inline.data);
        }
        if (typeof part.text === 'string' && part.text.length > 0) {
          callbacks.onTranscript?.(part.text, 'assistant');
        }
      }

      // Input transcription (if ever enabled).
      const inputTx = msg.serverContent?.inputTranscription?.text;
      if (inputTx) callbacks.onTranscript?.(inputTx, 'user');

      if (msg.serverContent?.interrupted) {
        // Model was interrupted — drop queued playback AND hard-stop any
        // in-flight buffer so we don't talk over the user. flushPlayback()
        // does both. Without the hard-stop, the AudioBufferSourceNode
        // already started keeps playing through the rest of its buffer
        // (a half-second of "and we have eight islands across—") which
        // is exactly the "she keeps talking" symptom.
        flushPlayback();
      }

      if (msg.serverContent?.turnComplete) {
        setState('listening');
      }

      // Tool calls — agent invoked one of the canvas tools. Execute the
      // handler in the registry, then ship the result back via
      // sendToolResponse so the model can incorporate it into its next
      // turn. Errors come back as { error } so the model can apologise /
      // recover instead of hanging.
      const toolCalls = msg.toolCall?.functionCalls ?? [];
      for (const call of toolCalls) {
        const name = call.name ?? '';
        const args = (call.args ?? {}) as Record<string, unknown>;
        const id = call.id;
        void executeTool(name, args).then((result) => {
          callbacks.onToolCall?.({
            name,
            args,
            ok: result.ok,
          });
          // Mirror to host page for embed-side observers (analytics,
          // surface bridges). Composed so it crosses Shadow DOM.
          window.dispatchEvent(
            new CustomEvent('landi:tool-call', {
              detail: { name, args, ok: result.ok, source: 'voice' },
              bubbles: true,
              composed: true,
            }),
          );
          try {
            session?.sendToolResponse({
              functionResponses: [
                {
                  id,
                  name,
                  response: result.ok
                    ? { output: result.result }
                    : { error: result.error },
                },
              ],
            });
          } catch (err) {
            console.warn('[voice] sendToolResponse failed', err);
          }
        });
      }
    } catch (err) {
      console.warn('[voice] server message handling failed', err);
    }
  }

  function playPcmChunk(b64: string) {
    if (!playbackCtx) return;
    const pcm = new Int16Array(base64Decode(b64));
    const float = new Float32Array(pcm.length);
    let rms = 0;
    for (let i = 0; i < pcm.length; i++) {
      const v = pcm[i] / (pcm[i] < 0 ? 0x8000 : 0x7fff);
      float[i] = v;
      rms += v * v;
    }
    outputLevel = Math.sqrt(rms / pcm.length);

    const buf = playbackCtx.createBuffer(1, float.length, OUTPUT_SAMPLE_RATE);
    buf.copyToChannel(float, 0);
    const src = playbackCtx.createBufferSource();
    src.buffer = buf;
    src.connect(playbackCtx.destination);
    const now = playbackCtx.currentTime;
    const startAt = Math.max(now, playbackQueueTime);
    src.start(startAt);
    // Track active sources so barge-in can hard-stop them. Auto-remove on
    // ended so the set doesn't grow unbounded across a long session.
    activeSources.add(src);
    src.onended = () => {
      activeSources.delete(src);
    };
    playbackQueueTime = startAt + buf.duration;

    setState('speaking');
    if (outputLevelDecay) window.clearTimeout(outputLevelDecay);
    outputLevelDecay = window.setTimeout(() => {
      outputLevel = 0;
    }, Math.max(150, buf.duration * 1000 + 50));
  }

  async function stop() {
    if (!active) return;
    active = false;
    try {
      session?.close();
    } catch {
      /* ignore */
    }
    session = null;

    workletNode?.port.close();
    workletNode?.disconnect();
    micSource?.disconnect();
    micStream?.getTracks().forEach((t) => t.stop());
    try {
      await audioCtx?.close();
    } catch {
      /* ignore */
    }
    try {
      await playbackCtx?.close();
    } catch {
      /* ignore */
    }
    audioCtx = null;
    playbackCtx = null;
    micStream = null;
    micSource = null;
    workletNode = null;
    inputLevel = 0;
    outputLevel = 0;
    activeSources.clear();
    bargeInFrames.length = 0;
    lastBargeInAt = 0;
    setState('idle');
  }

  return {
    start,
    stop,
    isActive: () => active,
    getInputLevel: () => inputLevel,
    getOutputLevel: () => outputLevel,
  };
}
