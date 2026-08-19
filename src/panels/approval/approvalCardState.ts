import type { PendingApprovalRequest } from './types';

export type ApprovalCardState =
  | 'review'
  | 'destructive_confirm'
  | 'empty';

export function resolveApprovalCardState(
  request: PendingApprovalRequest | null,
): ApprovalCardState {
  if (request === null) return 'empty';
  return request.phase === 'destructive_confirm' ? 'destructive_confirm' : 'review';
}
