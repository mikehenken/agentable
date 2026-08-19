/**
 * Story-mode walkthrough runner (P8-T6): steps camera intents through the
 * P6 politeness queue, emits narration, and cedes instantly on user input.
 */
import type { CameraQueue } from './camera';
import {
  DEFAULT_WALKTHROUGH_DWELL_MS,
  type WalkthroughCameraIntent,
  type WalkthroughCancelReason,
  type WalkthroughNarration,
  type WalkthroughRunResult,
  type WalkthroughStepInput,
  type WalkthroughTarget,
} from './walkthroughTypes';

export interface WalkthroughRunOptions {
  agentId: string;
  steps: readonly WalkthroughStepInput[];
  camera: CameraQueue;
  resolveTarget: (target: WalkthroughTarget) => WalkthroughCameraIntent | null;
  applyIntent: (intent: WalkthroughCameraIntent) => void;
  emitNarration: (narration: WalkthroughNarration) => void;
  now?: () => number;
  defaultDwellMs?: number;
  sleep?: (ms: number, isCancelled: () => boolean) => Promise<boolean>;
  registerCancelListener?: (onCancel: () => void) => () => void;
}

let activeCancel: (() => void) | null = null;

export function cancelActiveWalkthrough(reason: WalkthroughCancelReason = 'superseded'): void {
  activeCancel?.();
  void reason;
}

async function defaultSleep(ms: number, isCancelled: () => boolean): Promise<boolean> {
  const tickMs = 50;
  let elapsed = 0;
  while (elapsed < ms) {
    if (isCancelled()) return false;
    const slice = Math.min(tickMs, ms - elapsed);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, slice);
    });
    elapsed += slice;
  }
  return !isCancelled();
}

export async function runWalkthrough(options: WalkthroughRunOptions): Promise<WalkthroughRunResult> {
  const now = options.now ?? (() => Date.now());
  const defaultDwellMs = options.defaultDwellMs ?? DEFAULT_WALKTHROUGH_DWELL_MS;
  const sleep = options.sleep ?? defaultSleep;
  const narrations: WalkthroughNarration[] = [];
  let cancelled = false;
  let cancelReason: WalkthroughCancelReason | undefined;
  const at = now();

  const markCancelled = (reason: WalkthroughCancelReason): void => {
    if (cancelled) return;
    cancelled = true;
    cancelReason = reason;
    if (reason === 'user_input') {
      options.camera.recordUserInteraction(now());
    }
    options.camera.releaseHold(options.agentId);
  };

  cancelActiveWalkthrough();
  activeCancel = () => markCancelled('superseded');

  const unregisterUserCancel = options.registerCancelListener?.(() => {
    markCancelled('user_input');
  });

  if (!options.camera.acquireHold(options.agentId, at)) {
    activeCancel = null;
    unregisterUserCancel?.();
    return {
      ok: false,
      completedSteps: 0,
      totalSteps: options.steps.length,
      cancelled: true,
      cancelReason: 'hold_denied',
      narrations,
      attentionBadge: true,
    };
  }

  let completedSteps = 0;

  try {
    for (let stepIndex = 0; stepIndex < options.steps.length; stepIndex += 1) {
      if (cancelled) break;

      const step = options.steps[stepIndex];
      if (step === undefined) break;

      const intent = options.resolveTarget(step.target);
      if (intent === null) {
        markCancelled('target_unresolved');
        break;
      }

      const enqueueResult = options.camera.enqueue(options.agentId, intent, now());
      if (enqueueResult.ok && enqueueResult.applied) {
        options.applyIntent(intent);
      } else if (!enqueueResult.ok) {
        if (enqueueResult.reason === 'user_recent') {
          markCancelled('user_input');
          break;
        }
      }

      if (typeof step.say === 'string' && step.say.length > 0) {
        const narration: WalkthroughNarration = { stepIndex, say: step.say };
        narrations.push(narration);
        options.emitNarration(narration);
      }

      completedSteps += 1;

      const dwellMs =
        typeof step.dwellMs === 'number' && Number.isFinite(step.dwellMs) && step.dwellMs >= 0
          ? Math.floor(step.dwellMs)
          : defaultDwellMs;

      if (dwellMs > 0 && stepIndex < options.steps.length - 1) {
        const slept = await sleep(dwellMs, () => cancelled);
        if (!slept) break;
      }
    }
  } finally {
    options.camera.releaseHold(options.agentId);
    unregisterUserCancel?.();
    if (activeCancel !== null) {
      activeCancel = null;
    }
  }

  const totalSteps = options.steps.length;
  const ok = !cancelled && completedSteps === totalSteps && totalSteps > 0;

  return {
    ok,
    completedSteps,
    totalSteps,
    cancelled,
    cancelReason: cancelled ? cancelReason : undefined,
    narrations,
    attentionBadge: cancelReason === 'hold_denied' ? true : undefined,
  };
}
