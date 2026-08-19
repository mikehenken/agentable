import type { JsonValue } from '../types';

/** User or a specific agent identity (`agent:<id>`). Legacy `'agent'` maps to default. */
export type ApprovalActor = 'user' | 'agent' | `agent:${string}`;

export type ApprovalPhase = 'review' | 'destructive_confirm';

export type ApprovalResolutionStatus = 'approved' | 'rejected_by_user';

export interface PayloadDiffEntry {
  path: string;
  before: JsonValue | undefined;
  after: JsonValue | undefined;
  kind: 'add' | 'remove' | 'change';
}

export interface PendingApprovalRequest {
  id: string;
  panelId: string;
  definitionId: string;
  actionId: string;
  actionLabel: string;
  source?: string;
  destructive: boolean;
  confirmMessage?: string;
  payload: Record<string, JsonValue>;
  currentData: Record<string, JsonValue>;
  diff: readonly PayloadDiffEntry[];
  actor: ApprovalActor;
  /** Stable agent id for per-agent HITL queues and chrome attribution. */
  agentId: string;
  /** Human-readable agent label shown on the approval card. */
  agentLabel: string;
  phase: ApprovalPhase;
  reversible: boolean;
  createdAt: string;
}

export interface ApprovalResolution {
  status: ApprovalResolutionStatus;
}

export interface ApprovalController {
  subscribe(listener: () => void): () => void;
  getPending(): readonly PendingApprovalRequest[];
  getPendingForPanel(panelId: string): readonly PendingApprovalRequest[];
  /** Per-agent HITL queue slice. */
  getPendingForAgent(agentId: string): readonly PendingApprovalRequest[];
  resolve(requestId: string, status: ApprovalResolutionStatus): boolean;
  advancePhase(requestId: string): boolean;
}

export interface ApprovalControllerOptions {
  autoApprove?: readonly string[];
}

export interface PanelToolApprovalOptions extends ApprovalControllerOptions {
  approvalController?: ApprovalController;
}
