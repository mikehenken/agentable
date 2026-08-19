import { useEffect, useState, type ReactElement } from 'react';
import { getActiveApprovalController } from '../../panels/approval/approvalController';
import { ApprovalCard } from '../../panels/approval/ApprovalCard';
import type { PendingApprovalRequest } from '../../panels/approval/types';

export interface EmbedPanelApprovalLayerProps {
  panelId: string;
}

/**
 * HITL approval cards for panel-only embed surfaces. Uses subscribe + state
 * instead of useSyncExternalStore because getPendingForPanel returns fresh
 * arrays and would violate getSnapshot caching (React 19).
 */
export function EmbedPanelApprovalLayer({
  panelId,
}: EmbedPanelApprovalLayerProps): ReactElement | null {
  const controller = getActiveApprovalController();
  const [pending, setPending] = useState<readonly PendingApprovalRequest[]>(() =>
    controller?.getPendingForPanel(panelId) ?? []);

  useEffect(() => {
    if (controller === null) {
      return;
    }

    const sync = (): void => {
      setPending(controller.getPendingForPanel(panelId));
    };

    return controller.subscribe(sync);
  }, [controller, panelId]);

  if (controller === null || pending.length === 0) {
    return null;
  }

  return (
    <div className="panel-approval-layer" part="approval-layer" data-testid="panel-approval-layer">
      {pending.map((request) => (
        <ApprovalCard
          key={request.id}
          request={request}
          onApprove={(requestId) => {
            const entry = controller.getPendingForPanel(panelId).find((item) => item.id === requestId);
            if (entry === undefined) return;
            if (entry.destructive) {
              controller.advancePhase(requestId);
              return;
            }
            controller.resolve(requestId, 'approved');
          }}
          onReject={(requestId) => {
            controller.resolve(requestId, 'rejected_by_user');
          }}
          onConfirmDestructive={(requestId) => {
            controller.resolve(requestId, 'approved');
          }}
          onCancelDestructive={(requestId) => {
            controller.resolve(requestId, 'rejected_by_user');
          }}
        />
      ))}
    </div>
  );
}
