/**
 * Voice transport resilience (D56): bounded exponential backoff for
 * reconnecting Gemini Live (or mock transport) after an unexpected drop.
 *
 * The controller preserves the logical voice session id across reconnect
 * attempts so transcript streams resume without a full page reload.
 */

export interface VoiceReconnectOptions {
  /** First backoff delay in ms. Default 250. */
  initialDelayMs?: number;
  /** Maximum backoff delay in ms. Default 4000. */
  maxDelayMs?: number;
  /** Maximum reconnect attempts before giving up. Default 5. */
  maxAttempts?: number;
  /** Multiplier applied after each failed attempt. Default 2. */
  backoffFactor?: number;
}

export interface VoiceReconnectAttempt {
  attempt: number;
  delayMs: number;
}

export interface VoiceReconnectController {
  /** Monotonic logical session id preserved across reconnects. */
  readonly logicalSessionId: string;
  readonly attemptCount: number;
  readonly isExhausted: boolean;
  scheduleReconnect(onReconnect: () => void | Promise<void>): VoiceReconnectAttempt | null;
  resetAttempts(): void;
  cancelPending(): void;
}

const DEFAULT_INITIAL_DELAY_MS = 250;
const DEFAULT_MAX_DELAY_MS = 4000;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BACKOFF_FACTOR = 2;

function createLogicalSessionId(): string {
  return `vs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function computeBackoffDelayMs(
  attempt: number,
  options: VoiceReconnectOptions = {},
): number {
  const initial = options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const max = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const factor = options.backoffFactor ?? DEFAULT_BACKOFF_FACTOR;
  const exponent = Math.max(0, attempt - 1);
  const raw = initial * Math.pow(factor, exponent);
  return Math.min(max, raw);
}

export function createVoiceReconnectController(
  options: VoiceReconnectOptions = {},
  logicalSessionId: string = createLogicalSessionId(),
): VoiceReconnectController {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let attemptCount = 0;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;

  const controller: VoiceReconnectController = {
    get logicalSessionId() {
      return logicalSessionId;
    },
    get attemptCount() {
      return attemptCount;
    },
    get isExhausted() {
      return attemptCount >= maxAttempts;
    },
    scheduleReconnect(onReconnect) {
      if (attemptCount >= maxAttempts) {
        return null;
      }
      attemptCount += 1;
      const delayMs = computeBackoffDelayMs(attemptCount, options);
      if (pendingTimer !== null) {
        clearTimeout(pendingTimer);
      }
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        void onReconnect();
      }, delayMs);
      return { attempt: attemptCount, delayMs };
    },
    resetAttempts() {
      attemptCount = 0;
      if (pendingTimer !== null) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
    },
    cancelPending() {
      if (pendingTimer !== null) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
    },
  };

  return controller;
}
