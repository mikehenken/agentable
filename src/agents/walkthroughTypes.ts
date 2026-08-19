/**
 * Story-mode walkthrough types ( section 9).
 */
import type { Rect } from '../engine/types';

/** Parsed walkthrough step from present_walkthrough tool args. */
export interface WalkthroughStepInput {
  target: WalkthroughTarget;
  say?: string;
  dwellMs?: number;
}

/** Resolved camera target for a single walkthrough scene. */
export type WalkthroughTarget =
  | { kind: 'panel'; panelId: string }
  | { kind: 'frame'; frameId: string }
  | { kind: 'shapes'; shapeIds: readonly string[] }
  | { kind: 'shape'; shapeId: string };

export interface WalkthroughNarration {
  stepIndex: number;
  say: string;
}

export type WalkthroughCancelReason =
  | 'user_input'
  | 'superseded'
  | 'runtime_unbound'
  | 'hold_denied'
  | 'target_unresolved';

export interface WalkthroughRunResult {
  ok: boolean;
  completedSteps: number;
  totalSteps: number;
  cancelled: boolean;
  cancelReason?: WalkthroughCancelReason;
  narrations: readonly WalkthroughNarration[];
  attentionBadge?: boolean;
}

/** Opaque camera intent payload enqueued through the P6 politeness queue. */
export interface WalkthroughCameraIntent {
  kind: 'zoomTo';
  rect: Rect;
  inset?: number;
}

export const DEFAULT_WALKTHROUGH_DWELL_MS = 1_500;

export const WALKTHROUGH_UNAVAILABLE_CODE = 'WALKTHROUGH_UNAVAILABLE';
