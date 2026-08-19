/**
 * AG-UI-shaped event envelope for canvas state patches.
 *
 * CopilotKit AG-UI consumers on the host subscribe to
 * `landi:ag-ui-state-patch` rather than importing this module directly.
 * The shape mirrors JSON Patch-style deltas without requiring the full
 * AG-UI runtime in the substrate bundle.
 */
export type AgUiPatchOp = 'replace' | 'add' | 'remove';

export interface AgUiStatePatch {
  op: AgUiPatchOp;
  /** JSON-pointer-style path, e.g. `/files/0/name`. */
  path: string;
  value?: unknown;
}

export interface AgUiStatePatchEventDetail {
  patches: AgUiStatePatch[];
  source: 'tool' | 'host' | 'voice' | 'chat';
  toolName?: string;
  timestamp: string;
}

export const AG_UI_STATE_PATCH_EVENT = 'landi:ag-ui-state-patch';

/** Emit state patches to host bridges (bubbles + composed for shadow DOM). */
export function emitAgUiStatePatch(
  patches: AgUiStatePatch[],
  meta: Pick<AgUiStatePatchEventDetail, 'source' | 'toolName'> = { source: 'tool' }): void {
  if (patches.length === 0) return;
  window.dispatchEvent(
    new CustomEvent<AgUiStatePatchEventDetail>(AG_UI_STATE_PATCH_EVENT, {
      detail: {
        patches,
        source: meta.source,
        toolName: meta.toolName,
        timestamp: new Date().toISOString(),
      },
      bubbles: true,
      composed: true,
    }));
}
