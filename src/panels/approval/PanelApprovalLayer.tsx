import { useCallback, useRef, useSyncExternalStore, type ReactElement } from 'react';
import { getActiveApprovalController } from './approvalController';
import { ApprovalCard } from './ApprovalCard';
import type { PendingApprovalRequest } from './types';

export interface PanelApprovalLayerProps {
  panelId: string;
}

const EMPTY_PENDING: readonly PendingApprovalRequest[] = [];

/**
 * Stable `getSnapshot` for `useSyncExternalStore`.
 *
 * `controller.getPendingForPanel` rebuilds its array (spread + filter +
 * sort) on every call, so returning it directly gave `useSyncExternalStore`
 * a brand-new reference on every check, even when nothing had changed.
 * React then concluded the store "changed" on every render and re-rendered
 * forever ("Maximum update depth exceeded" React error #185 - this is
 * exactly the anti-pattern React's own "the result of getSnapshot should be
 * cached" dev warning describes).
 *
 * `advancePhase` `resolve` `queue` in `approvalController.ts` all
 * replace entries immutably (spread-and-set, delete, or add) rather than
 * mutating in place, so a plain per-index reference comparison is enough to
 * tell a genuine change from a merely-rebuilt-but-identical array: cache the
 * last snapshot and only swap it out when an entry reference or the length
 * actually differs.
 */
function useStablePendingSnapshot(
  panelId: string): () => readonly PendingApprovalRequest[] {
  const cacheRef = useRef<readonly PendingApprovalRequest[]>(EMPTY_PENDING);

  return useCallback(() => {
    const controller = getActiveApprovalController;
    const next = controller?.().getPendingForPanel(panelId) ?? EMPTY_PENDING;
    const prev = cacheRef.current;
    const unchanged =
      prev.length === next.length && prev.every((entry, index) => entry === next[index]);
    if (!unchanged) {
      cacheRef.current = next;
    }
    return cacheRef.current;
  }, [panelId]);
}

/**
 * Renders the framework-owned HITL approval card inside panel chrome (02
 * section 7). Lives outside the spec body so panel content cannot imitate it.
 * Per-agent queues render independently so one agent's pending card never
 * blocks another's.
 */
export function PanelApprovalLayer({ panelId }: PanelApprovalLayerProps): ReactElement | null {
  const controller = getActiveApprovalController;
  const getPendingSnapshot = useStablePendingSnapshot(panelId);

  const pending = useSyncExternalStore(
    (onStoreChange) => controller?.().subscribe(onStoreChange) ?? (() => {}),
    getPendingSnapshot, () => EMPTY_PENDING);

  if (controller === null || pending.length === 0) {
    return null;
  }

  const layerTestId =
    panelId === 'document' && pending.length > 0 ? 'meridian-hitl-card': 'panel-approval-layer';

  return (
    <div className="panel-approval-layer" data-testid={layerTestId}>
      {pending.map((request) => (
        <ApprovalCard
          key={request.id}
          request={request}
          onApprove={(requestId) => {
            const entry = controller().getPendingForPanel(panelId).find((item) => item.id === requestId);
            if (entry === undefined) return;
            if (entry.destructive) {
              controller().advancePhase(requestId);
              return;
            }
            controller().resolve(requestId, 'approved');
          }}
          onReject={(requestId) => {
            controller().resolve(requestId, 'rejected_by_user');
          }}
          onConfirmDestructive={(requestId) => {
            controller().resolve(requestId, 'approved');
          }}
          onCancelDestructive={(requestId) => {
            controller().resolve(requestId, 'rejected_by_user');
          }}
        />
      ))}
    </div>
  );
}
