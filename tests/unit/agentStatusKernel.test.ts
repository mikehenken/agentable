import { describe, expect, it, beforeEach } from 'vitest';
import {
  ensureAgentStatusKernel,
  resolvePrimaryAgentStatus,
  __resetAgentStatusKernelForTests__,
} from '../../src/shared/agentStatusKernel';

describe('agentStatusKernel', () => {
  beforeEach(() => {
    __resetAgentStatusKernelForTests__();
  });

  it('installs a singleton on window', () => {
    const first = ensureAgentStatusKernel;
    const second = ensureAgentStatusKernel;
    expect(first).toBe(second);
  });

  it('publishes and removes agent rows', () => {
    const kernel = ensureAgentStatusKernel;
    kernel().agents._publish({
      agentId: 'concierge',
      label: 'Concierge',
      status: 'running',
      task: 'Searching roles',
    });
    expect(kernel().agents.getSnapshot().agents).toHaveLength(1);

    kernel().agents._remove('concierge');
    expect(kernel().agents.getSnapshot().agents).toHaveLength(0);
  });

  it('notifies subscribers on publish', () => {
    const kernel = ensureAgentStatusKernel;
    const seen: string[] = [];
    kernel().agents.subscribe((snapshot) => {
      seen.push(snapshot.agents.map((row) => row.agentId).join(','));
    });
    kernel().agents._publish({
      agentId: 'a',
      label: 'A',
      status: 'idle',
    });
    kernel().agents._publish({
      agentId: 'b',
      label: 'B',
      status: 'running',
    });
    expect(seen.at(-1)).toBe('a,b');
  });
});

describe('resolvePrimaryAgentStatus', () => {
  const rows = [
    { agentId: 'idle-agent', label: 'Idle', status: 'idle' as const },
    { agentId: 'running-agent', label: 'Running', status: 'running' as const },
    {
      agentId: 'approval-agent',
      label: 'Approval',
      status: 'waiting_approval' as const,
    },
  ];

  it('prefers explicit agent-id when present', () => {
    const match = resolvePrimaryAgentStatus(rows, 'idle-agent');
    expect(match?.agentId).toBe('idle-agent');
  });

  it('prioritizes waiting_approval over running when unattributed', () => {
    const match = resolvePrimaryAgentStatus(rows);
    expect(match?.agentId).toBe('approval-agent');
  });
});
