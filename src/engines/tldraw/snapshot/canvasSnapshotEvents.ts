/** Host → substrate: restore a persisted tldraw snapshot onto the bound editor. */
export const CANVAS_RESTORE_SNAPSHOT_EVENT = 'agentable:restore-snapshot';

/** @deprecated One-minor alias — use CANVAS_RESTORE_SNAPSHOT_EVENT. */
export const LEGACY_CANVAS_RESTORE_SNAPSHOT_EVENT = 'landi:canvas-restore-snapshot';

export const CANVAS_RESTORE_SNAPSHOT_EVENTS = [
  CANVAS_RESTORE_SNAPSHOT_EVENT,
  LEGACY_CANVAS_RESTORE_SNAPSHOT_EVENT,
] as const;

export interface CanvasRestoreSnapshotEventDetail {
  snapshot: unknown;
  /** Optional scope label (e.g. context id) for logging and de-dupe. */
  scopeKey?: string;
}
