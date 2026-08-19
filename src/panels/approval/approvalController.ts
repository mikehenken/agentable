import type {
  ApprovalController,
  ApprovalResolutionStatus,
  PanelToolApprovalOptions,
  PendingApprovalRequest,
} from './types';

let requestCounter = 0;

function nextRequestId(): string {
  requestCounter += 1;
  return `approval-${requestCounter}`;
}

export function createApprovalController(
  options: PanelToolApprovalOptions = {}): ApprovalController {
  const autoApprove = new Set(options.autoApprove ?? []);
  const pending = new Map<string, PendingApprovalRequest>();
  const resolvers = new Map<
    string,
    (status: ApprovalResolutionStatus) => void
  >();
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  const controller: ApprovalController & {
    queue(request: Omit<PendingApprovalRequest, 'id' | 'createdAt'>): Promise<ApprovalResolutionStatus>;
    isAutoApproved(actionKey: string): boolean;
  } = {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getPending(): readonly PendingApprovalRequest[] {
      return [...pending.values()];
    },

    getPendingForPanel(panelId: string): readonly PendingApprovalRequest[] {
      return [...pending.values()].filter(
          (entry) => entry.panelId === panelId || entry.definitionId === panelId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    getPendingForAgent(agentId: string): readonly PendingApprovalRequest[] {
      return [...pending.values()].filter((entry) => entry.agentId === agentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    resolve(requestId: string, status: ApprovalResolutionStatus): boolean {
      const resolver = resolvers.get(requestId);
      if (resolver === undefined) return false;
      pending.delete(requestId);
      resolvers.delete(requestId);
      resolver(status);
      notify();
      return true;
    },

    advancePhase(requestId: string): boolean {
      const entry = pending.get(requestId);
      if (entry === undefined || entry.phase !== 'review') return false;
      pending.set(requestId, {...entry, phase: 'destructive_confirm' });
      notify();
      return true;
    },

    isAutoApproved(actionKey: string): boolean {
      return autoApprove.has(actionKey);
    },

    queue(
      request: Omit<PendingApprovalRequest, 'id' | 'createdAt'>): Promise<ApprovalResolutionStatus> {
      return new Promise<ApprovalResolutionStatus>((resolve) => {
        const id = nextRequestId();
        pending.set(id, {...request,
          id,
          createdAt: new Date().toISOString(),
        });
        resolvers.set(id, resolve);
        notify();
      });
    },
  };

  return controller;
}

let activeController: ApprovalController | null = null;

/** Set by createCanvasHost; cleared on dispose. UI layers read the active controller. */
export function setActiveApprovalController(controller: ApprovalController | null): void {
  activeController = controller;
}

export function getActiveApprovalController(): ApprovalController | null {
  return activeController;
}

export function actionAutoApproveKey(definitionId: string, actionId: string): string {
  return `${definitionId}:${actionId}`;
}
