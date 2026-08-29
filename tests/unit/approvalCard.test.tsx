/**
 * automated check: approval card states incl. diff rendering.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ApprovalCard,
  resolveApprovalCardState,
  type PendingApprovalRequest,
} from '../../src/panels/approval';

function sampleRequest(
  overrides: Partial<PendingApprovalRequest> = {}): PendingApprovalRequest {
  return {
    id: 'approval-1',
    panelId: 'site-seo-1',
    definitionId: 'site-seo',
    actionId: 'save',
    actionLabel: 'Save SEO',
    source: 'site.seo',
    destructive: false,
    payload: { title: 'New title' },
    currentData: { title: 'Old title' },
    diff: [
      {
        path: 'title',
        before: 'Old title',
        after: 'New title',
        kind: 'change',
      },
    ],
    actor: 'agent',
    agentId: 'agent-default',
    agentLabel: 'Canvas agent',
    phase: 'review',
    reversible: true,
    createdAt: '2026-07-20T00:00:00.000Z',...overrides,
  };
}

describe('resolveApprovalCardState', () => {
  it('returns empty when no request is pending', () => {
    expect(resolveApprovalCardState(null)).toBe('empty');
  });

  it('returns review for pending review phase', () => {
    expect(resolveApprovalCardState(sampleRequest({ phase: 'review' }))).toBe('review');
  });

  it('returns destructive_confirm for destructive confirm phase', () => {
    expect(resolveApprovalCardState(sampleRequest({ phase: 'destructive_confirm' }))).toBe(
      'destructive_confirm');
  });
});

describe('ApprovalCard review state', () => {
  it('renders payload diff rows and action metadata', () => {
    render(<ApprovalCard request={sampleRequest} />);

    expect(screen.getByTestId('approval-card-review')).toBeInTheDocument();
    expect(screen.getByTestId('approval-awaiting-badge')).toBeInTheDocument();
    expect(screen.getByTestId('approval-target-source')).toHaveTextContent('site.seo');
    expect(screen.getByTestId('approval-payload-diff')).toBeInTheDocument();
    expect(screen.getByTestId('approval-diff-row-title')).toHaveAttribute('data-diff-kind', 'change');
    expect(screen.getByText('Old title')).toBeInTheDocument();
    expect(screen.getByText('New title')).toBeInTheDocument();
  });

  it('surfaces irreversible warning when action cannot be undone', () => {
    render(<ApprovalCard request={sampleRequest({ reversible: false })} />);
    expect(screen.getByTestId('approval-irreversible')).toBeInTheDocument();
  });

  it('shows empty diff copy when payload introduces no field changes', () => {
    render(
      <ApprovalCard
        request={sampleRequest({
          diff: [],
          payload: {},
          currentData: { title: 'Same' },
        })}
      />);
    expect(screen.getByText('No field changes in this payload.')).toBeInTheDocument();
  });

  it('calls approve and reject handlers', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    render(
      <ApprovalCard request={sampleRequest} onApprove={onApprove} onReject={onReject} />);

    fireEvent.click(screen.getByTestId('approval-approve'));
    fireEvent.click(screen.getByTestId('approval-reject'));

    expect(onApprove).toHaveBeenCalledWith('approval-1');
    expect(onReject).toHaveBeenCalledWith('approval-1');
  });
});

describe('ApprovalCard destructive confirm state', () => {
  it('renders destructive confirm actions', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ApprovalCard
        request={sampleRequest({
          phase: 'destructive_confirm',
          destructive: true,
          confirmMessage: 'Restore this version permanently?',
        })}
        onConfirmDestructive={onConfirm}
        onCancelDestructive={onCancel}
      />);

    expect(screen.getByTestId('approval-card-destructive')).toBeInTheDocument();
    expect(screen.getByTestId('approval-destructive-badge')).toBeInTheDocument();
    expect(screen.getByText('Restore this version permanently?')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('approval-destructive-confirm'));
    fireEvent.click(screen.getByTestId('approval-destructive-cancel'));

    expect(onConfirm).toHaveBeenCalledWith('approval-1');
    expect(onCancel).toHaveBeenCalledWith('approval-1');
  });
});
