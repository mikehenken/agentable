/**
 * agentStatusKernel — vanilla pub/sub for agent session status on `window`.
 *
 * Narrowly scoped like `voiceKernel`: Lit widget bundles subscribe without
 * pulling React or the full agent runtime. The canvas host publishes status
 * transitions from `AgentRegistry` (03 §3.2).
 */

import type { AgentSessionStatus } from '../agents/types';

export interface AgentStatusEntry {
  agentId: string;
  label: string;
  status: AgentSessionStatus;
  task?: string;
}

export interface AgentStatusSnapshot {
  agents: readonly AgentStatusEntry[];
}

export interface AgentStatusController extends AgentStatusSnapshot {
  getSnapshot(): AgentStatusSnapshot;
  subscribe(listener: (snapshot: AgentStatusSnapshot) => void): () => void;
  /** Host/runtime publishes one agent row (upsert by agentId). */
  _publish(entry: AgentStatusEntry): void;
  /** Host/runtime removes an agent row. */
  _remove(agentId: string): void;
  /** Test-only bulk replace. */
  _replaceAll(entries: readonly AgentStatusEntry[]): void;
}

export interface AgentStatusKernel {
  version: string;
  agents: AgentStatusController;
}

const KERNEL_VERSION = '0.1.0';
const GLOBAL_KEY = '__agentStatusKernel__';

declare global {
  interface Window {
    __agentStatusKernel__?: AgentStatusKernel;
  }
}

function createAgentStatusController(): AgentStatusController {
  const listeners = new Set<(snapshot: AgentStatusSnapshot) => void>();
  const rows = new Map<string, AgentStatusEntry>();
  let frozenSnapshot: AgentStatusSnapshot = { agents: [] };

  function notify(): void {
    frozenSnapshot = { agents: [...rows.values()] };
    const frozen = frozenSnapshot;
    for (const listener of listeners) {
      try {
        listener(frozen);
      } catch (err) {
        console.error('[agentStatusKernel] subscriber threw', err);
      }
    }
  }

  const controller: AgentStatusController = {
    get agents() {
      return frozenSnapshot.agents;
    },
    getSnapshot(): AgentStatusSnapshot {
      return frozenSnapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      try {
        listener(frozenSnapshot);
      } catch (err) {
        console.error('[agentStatusKernel] initial subscriber call threw', err);
      }
      return () => {
        listeners.delete(listener);
      };
    },
    _publish(entry) {
      if (!entry.agentId.trim()) return;
      rows.set(entry.agentId, { ...entry });
      notify();
    },
    _remove(agentId) {
      if (rows.delete(agentId)) {
        notify();
      }
    },
    _replaceAll(entries) {
      rows.clear();
      for (const entry of entries) {
        if (entry.agentId.trim()) {
          rows.set(entry.agentId, { ...entry });
        }
      }
      notify();
    },
  };

  notify();
  return controller;
}

export function installAgentStatusKernel(): AgentStatusKernel {
  if (typeof window === 'undefined') {
    throw new Error('[agentStatusKernel] cannot install in a non-browser environment');
  }
  const existing = window[GLOBAL_KEY];
  if (existing) {
    if (existing.version !== KERNEL_VERSION) {
      console.warn(
        `[agentStatusKernel] version mismatch: existing=${existing.version} new=${KERNEL_VERSION}; using existing`,
      );
    }
    return existing;
  }
  const kernel: AgentStatusKernel = {
    version: KERNEL_VERSION,
    agents: createAgentStatusController(),
  };
  window[GLOBAL_KEY] = kernel;
  return kernel;
}

export function getAgentStatusKernel(): AgentStatusKernel | null {
  if (typeof window === 'undefined') return null;
  return window[GLOBAL_KEY] ?? null;
}

export function ensureAgentStatusKernel(): AgentStatusKernel {
  return installAgentStatusKernel();
}

/** Test-only reset — production code must not call. */
export function __resetAgentStatusKernelForTests__(): void {
  if (typeof window !== 'undefined') {
    delete window[GLOBAL_KEY];
  }
}

/** Pick the row an unattributed pill should display. */
export function resolvePrimaryAgentStatus(
  agents: readonly AgentStatusEntry[],
  preferredAgentId?: string,
): AgentStatusEntry | undefined {
  if (preferredAgentId) {
    const match = agents.find((row) => row.agentId === preferredAgentId);
    if (match) return match;
  }
  const priority: AgentSessionStatus[] = [
    'waiting_approval',
    'running',
    'idle',
    'done',
    'cancelled',
  ];
  for (const status of priority) {
    const match = agents.find((row) => row.status === status);
    if (match) return match;
  }
  return agents[0];
}
