import type { SpecIssue } from '../panels/spec/types';
import type { JsonObject, PanelSpec } from '../panels/types';
import type { PendingApprovalRequest } from '../panels/approval/types';
import type { ApprovalResolutionStatus } from '../panels/approval/types';

/** One row in the validation trace list binding. */
export interface ValidationTraceRow {
  id: string;
  severity: 'error' | 'warning';
  code: string;
  message: string;
  nodeId?: string;
  path?: string;
  hint?: string;
}

/** One row in the bindings data inspector list binding. */
export interface BindingInspectorRow {
  id: string;
  kind: 'source' | 'state' | 'action';
  key: string;
  detail: string;
}

/** Event kinds recorded in the HITL repair action history. */
export type SpecDevtoolsEventKind =
  | 'validation'
  | 'repair'
  | 'hitl_queued'
  | 'hitl_resolved'
  | 'action';

/** One row in the event history list binding. */
export interface SpecDevtoolsEventRow {
  id: string;
  ts: string;
  kind: SpecDevtoolsEventKind;
  title: string;
  subtitle: string;
}

export interface SpecDevtoolsSnapshot {
  targetLabel: string;
  specJson: JsonObject | null;
  validationTrace: readonly ValidationTraceRow[];
  bindings: readonly BindingInspectorRow[];
  eventHistory: readonly SpecDevtoolsEventRow[];
}

export interface InspectSpecInput {
  targetLabel: string;
  spec: PanelSpec | null;
  errors?: readonly SpecIssue[];
  warnings?: readonly SpecIssue[];
  repairEligible?: boolean;
  operation?: 'compose' | 'patch' | 'playground';
}

export interface RecordHitlQueuedInput {
  request: PendingApprovalRequest;
}

export interface RecordHitlResolvedInput {
  request: PendingApprovalRequest;
  status: ApprovalResolutionStatus;
}

export type SpecDevtoolsListener = ()=> void;

export type Unsubscribe = ()=> void;
