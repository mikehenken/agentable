/**
 * Bridge panel tool runtime events into the spec devtools session (P10-T2).
 */
import type { PanelSpec } from '../panels/types';
import type { SpecIssue } from '../panels/spec/types';
import type { PendingApprovalRequest } from '../panels/approval/types';
import type { ApprovalResolutionStatus } from '../panels/approval/types';
import type { SpecDevtoolsSession } from './specDevtoolsSession';

export function recordSpecInspection(
  session: SpecDevtoolsSession,
  targetLabel: string,
  spec: PanelSpec | null,
  errors: readonly SpecIssue[] = [],
  warnings: readonly SpecIssue[] = [],
): void {
  session.inspectSpec({ targetLabel, spec, errors, warnings });
}

export function recordSpecRepairFailure(
  session: SpecDevtoolsSession,
  targetLabel: string,
  spec: PanelSpec | null,
  errors: readonly SpecIssue[],
  repairEligible: boolean,
  operation: 'compose' | 'patch',
): void {
  session.recordRepairAttempt({
    targetLabel,
    spec,
    errors,
    repairEligible,
    operation,
  });
}

export function recordSpecHitlQueued(
  session: SpecDevtoolsSession,
  request: PendingApprovalRequest,
): void {
  session.recordHitlQueued({ request });
}

export function recordSpecHitlResolved(
  session: SpecDevtoolsSession,
  request: PendingApprovalRequest,
  status: ApprovalResolutionStatus,
): void {
  session.recordHitlResolved({ request, status });
}

export function recordSpecActionRun(
  session: SpecDevtoolsSession,
  panelId: string,
  actionId: string,
  status: string,
): void {
  session.recordActionRun(panelId, actionId, status);
}
