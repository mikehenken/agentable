import type { ReactElement } from 'react';
import { t } from '../../i18n';
import { sanitizeInertText } from '../../security/codeExecutionBoundary';
import { resolveApprovalCardState } from './approvalCardState';
import { formatDiffValue } from './payloadDiff';
import type { PendingApprovalRequest } from './types';

export interface ApprovalCardProps {
  request: PendingApprovalRequest | null;
  onApprove?: (requestId: string) => void;
  onReject?: (requestId: string) => void;
  onConfirmDestructive?: (requestId: string) => void;
  onCancelDestructive?: (requestId: string) => void;
}

function resolveCardState(request: PendingApprovalRequest | null) {
  return resolveApprovalCardState(request);
}

function AgentAttributionBadge({ request }: { request: PendingApprovalRequest }): ReactElement {
  return (
    <span
      className="panel-approval-card__agent-badge"
      data-testid="approval-agent-badge"
      data-agent-id={request.agentId}
    >
      {t('approval.review.agentAttribution', { agent: sanitizeInertText(request.agentLabel) })}
    </span>
  );
}

export function ApprovalCard({
  request,
  onApprove,
  onReject,
  onConfirmDestructive,
  onCancelDestructive,
}: ApprovalCardProps): ReactElement | null {
  const state = resolveCardState(request);
  if (state === 'empty' || request === null) {
    return null;
  }

  if (state === 'destructive_confirm') {
    return (
      <section
        className="panel-approval-card panel-approval-card--destructive"
        data-testid="approval-card-destructive"
        data-approval-id={request.id}
        aria-live="polite"
      >
        <header className="panel-approval-card__header">
          <span className="panel-approval-card__badge" data-testid="approval-destructive-badge">
            {t('approval.destructive.badge')}
          </span>
          <AgentAttributionBadge request={request} />
          <h3 className="panel-approval-card__title">{t('approval.destructive.title')}</h3>
        </header>
        <p className="panel-approval-card__summary">
          {sanitizeInertText(
            request.confirmMessage ??
              t('approval.destructive.defaultMessage', {
                action: sanitizeInertText(request.actionLabel),
              }),
          )}
        </p>
        <div className="panel-approval-card__actions">
          <button
            type="button"
            className="panel-approval-card__btn panel-approval-card__btn--danger"
            data-testid="approval-destructive-confirm"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onConfirmDestructive?.(request.id)}
          >
            {t('approval.destructive.confirm')}
          </button>
          <button
            type="button"
            className="panel-approval-card__btn panel-approval-card__btn--ghost"
            data-testid="approval-destructive-cancel"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onCancelDestructive?.(request.id)}
          >
            {t('approval.reject')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="panel-approval-card"
      data-testid="approval-card-review"
      data-approval-id={request.id}
      aria-live="polite"
    >
      <header className="panel-approval-card__header">
        <span className="panel-approval-card__badge" data-testid="approval-awaiting-badge">
          {t('approval.review.badge')}
        </span>
        <AgentAttributionBadge request={request} />
        <h3 className="panel-approval-card__title">
          {t('approval.review.title', { action: sanitizeInertText(request.actionLabel) })}
        </h3>
      </header>

      {request.source !== undefined && (
        <p className="panel-approval-card__meta" data-testid="approval-target-source">
          {t('approval.review.target', { source: sanitizeInertText(request.source) })}
        </p>
      )}

      {!request.reversible && (
        <p className="panel-approval-card__warning" data-testid="approval-irreversible">
          {t('approval.review.irreversible')}
        </p>
      )}

      <div className="panel-approval-card__diff" data-testid="approval-payload-diff">
        {request.diff.length === 0 ? (
          <p className="panel-approval-card__diff-empty">{t('approval.diff.empty')}</p>
        ) : (
          <table className="panel-approval-card__diff-table">
            <thead>
              <tr>
                <th scope="col">{t('approval.diff.field')}</th>
                <th scope="col">{t('approval.diff.before')}</th>
                <th scope="col">{t('approval.diff.after')}</th>
              </tr>
            </thead>
            <tbody>
              {request.diff.map((entry) => (
                <tr
                  key={entry.path}
                  data-testid={`approval-diff-row-${entry.path}`}
                  data-diff-kind={entry.kind}
                >
                  <th scope="row">{sanitizeInertText(entry.path)}</th>
                  <td>
                    <pre className="panel-approval-card__diff-value">
                      {formatDiffValue(entry.before) || t('approval.diff.none')}
                    </pre>
                  </td>
                  <td>
                    <pre className="panel-approval-card__diff-value panel-approval-card__diff-value--after">
                      {formatDiffValue(entry.after) || t('approval.diff.none')}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel-approval-card__actions">
        <button
          type="button"
          className="panel-approval-card__btn panel-approval-card__btn--primary"
          data-testid="approval-approve"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onApprove?.(request.id)}
        >
          {t('approval.approve')}
        </button>
        <button
          type="button"
          className="panel-approval-card__btn panel-approval-card__btn--ghost"
          data-testid="approval-reject"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onReject?.(request.id)}
        >
          {t('approval.reject')}
        </button>
      </div>
    </section>
  );
}
