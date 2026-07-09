/** Host → substrate: restore a persisted tldraw snapshot onto the bound editor. */
export const CANVAS_RESTORE_SNAPSHOT_EVENT = 'landi:canvas-restore-snapshot';

export interface CanvasRestoreSnapshotEventDetail {
  snapshot: unknown;
  /** Optional scope label (e.g. site id) for logging and de-dupe. */
  scopeKey?: string;
}
