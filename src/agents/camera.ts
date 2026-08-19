/**
 * Camera politeness queue: single camera-intent queue so agents never
 * steal the viewport. User interaction within the grace window (default 4s)
 * or another agent holding the camera causes agent ops to no-op with an
 * attention badge signal.
 */
export type CameraMode = 'free' | 'bounded' | 'fixed';

export interface CameraIntent {
  id: string;
  agentId: string;
  /** Opaque engine camera payload (pan/zoom/focus target). */
  intent: Record<string, unknown>;
  enqueuedAt: number;
}

export type CameraEnqueueResult =
  | { ok: true; intent: CameraIntent; applied: true }
  | {
      ok: false;
      reason: 'user_recent' | 'held_by_other' | 'mode_clamped' | 'queue_busy';
      badge: 'attention';
      holderAgentId?: string;
      intent: CameraIntent;
    };

export interface CameraQueue {
  /** Record a user camera interaction (resets grace window). */
  recordUserInteraction(atMs?: number): void;
  /** Current camera mode; bounded/fixed clamp all agent camera ops. */
  setMode(mode: CameraMode): void;
  getMode(): CameraMode;
  /** Acquire exclusive camera hold for an agent (walkthrough, etc.). */
  acquireHold(agentId: string, atMs?: number): boolean;
  releaseHold(agentId?: string): void;
  holder(): string | undefined;
  /** Enqueue and attempt to apply an agent camera intent. */
  enqueue(agentId: string, intent: Record<string, unknown>, atMs?: number): CameraEnqueueResult;
  /** Drain the next queued intent if politeness allows. */
  drain(atMs?: number): CameraEnqueueResult | undefined;
  pending(): readonly CameraIntent[];
  /** Ms remaining on the user grace window (0 when clear). */
  userGraceRemaining(atMs?: number): number;
}

let cameraIntentCounter = 0;

function nextIntentId(): string {
  cameraIntentCounter += 1;
  return `cam-${cameraIntentCounter}`;
}

export function resetCameraIntentCounterForTests(): void {
  cameraIntentCounter = 0;
}

export const DEFAULT_USER_CAMERA_GRACE_MS = 4_000;

export function createCameraQueue(options?: {
  now?: () => number;
  userGraceMs?: number;
  mode?: CameraMode;
}): CameraQueue {
  const now = options?.now ?? (() => Date.now());
  const userGraceMs = options?.userGraceMs ?? DEFAULT_USER_CAMERA_GRACE_MS;
  let mode: CameraMode = options?.mode ?? 'free';
  let lastUserInteractionAt = 0;
  let holdAgentId: string | undefined;
  const queue: CameraIntent[] = [];

  const userBlocks = (at: number): boolean =>
    lastUserInteractionAt > 0 && at - lastUserInteractionAt < userGraceMs;

  const tryApply = (
    intent: CameraIntent,
    at: number): CameraEnqueueResult => {
    if (mode === 'bounded' || mode === 'fixed') {
      return {
        ok: false,
        reason: 'mode_clamped',
        badge: 'attention',
        holderAgentId: holdAgentId,
        intent,
      };
    }
    if (userBlocks(at)) {
      return {
        ok: false,
        reason: 'user_recent',
        badge: 'attention',
        holderAgentId: holdAgentId,
        intent,
      };
    }
    if (holdAgentId !== undefined && holdAgentId !== intent.agentId) {
      return {
        ok: false,
        reason: 'held_by_other',
        badge: 'attention',
        holderAgentId: holdAgentId,
        intent,
      };
    }
    return { ok: true, intent, applied: true };
  };

  return {
    recordUserInteraction(atMs?: number): void {
      lastUserInteractionAt = atMs ?? now();
      // User always wins: clear agent hold.
      holdAgentId = undefined;
      queue.length = 0;
    },

    setMode(next: CameraMode): void {
      mode = next;
    },

    getMode(): CameraMode {
      return mode;
    },

    acquireHold(agentId: string, atMs?: number): boolean {
      const at = atMs ?? now();
      if (userBlocks(at)) return false;
      if (holdAgentId !== undefined && holdAgentId !== agentId) return false;
      holdAgentId = agentId;
      return true;
    },

    releaseHold(agentId?: string): void {
      if (agentId !== undefined && holdAgentId !== agentId) return;
      holdAgentId = undefined;
    },

    holder(): string | undefined {
      return holdAgentId;
    },

    enqueue(agentId: string, intentPayload: Record<string, unknown>, atMs?: number): CameraEnqueueResult {
      const at = atMs ?? now();
      const intent: CameraIntent = {
        id: nextIntentId(),
        agentId,
        intent: {...intentPayload },
        enqueuedAt: at,
      };
      const result = tryApply(intent, at);
      if (!result.ok) {
        queue.push(intent);
      }
      return result;
    },

    drain(atMs?: number): CameraEnqueueResult | undefined {
      const at = atMs ?? now();
      const next = queue.shift();
      if (next === undefined) return undefined;
      return tryApply(next, at);
    },

    pending(): readonly CameraIntent[] {
      return queue.map((intent) => ({...intent,
        intent: {...intent.intent },
      }));
    },

    userGraceRemaining(atMs?: number): number {
      const at = atMs ?? now();
      if (lastUserInteractionAt <= 0) return 0;
      const remaining = userGraceMs - (at - lastUserInteractionAt);
      return remaining > 0 ? remaining: 0;
    },
  };
}
