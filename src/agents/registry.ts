/**
 * Agent registry (03 section 3.2): session presence, heartbeats, and
 * status transitions that feed the workspace digest.
 */
import type { CapabilityDescriptor } from './capabilities';
import type { AgentSessionKind, AgentSessionStatus } from './types';

export interface AgentRegistryRegisterInput {
  id: string;
  kind: AgentSessionKind;
  label: string;
  scope?: string;
  transport: string;
  capabilities?: readonly CapabilityDescriptor[];
  task?: string;
  /** Allowed tool names for role-scope enforcement. */
  allowedTools?: readonly string[];
  /** Allowed panel definition ids. */
  allowedPanels?: readonly string[];
  /** Allowed page slots. */
  allowedSlots?: readonly string[];
}

export interface AgentRegistryEntry {
  id: string;
  kind: AgentSessionKind;
  label: string;
  scope?: string;
  transport: string;
  capabilities: CapabilityDescriptor[];
  status: AgentSessionStatus;
  task?: string;
  allowedTools: readonly string[];
  allowedPanels: readonly string[];
  allowedSlots: readonly string[];
  lastHeartbeatAt: number;
  registeredAt: number;
}

export interface AgentRegistry {
  register(input: AgentRegistryRegisterInput): AgentRegistryEntry;
  unregister(agentId: string): boolean;
  get(agentId: string): AgentRegistryEntry | undefined;
  list(agentId?: string): readonly AgentRegistryEntry[];
  setStatus(agentId: string, status: AgentSessionStatus, task?: string): AgentRegistryEntry | undefined;
  heartbeat(agentId: string, nowMs?: number): AgentRegistryEntry | undefined;
  /**
   * Role-scope check. Empty allow-lists mean unrestricted for that axis.
   */
  isToolAllowed(agentId: string, toolName: string): boolean;
  isPanelAllowed(agentId: string, panelId: string): boolean;
  isSlotAllowed(agentId: string, slotId: string): boolean;
  subscribe(listener: () => void): () => void;
}

export function createAgentRegistry(options?: {
  now?: () => number;
}): AgentRegistry {
  const now = options?.now ?? (() => Date.now());
  const entries = new Map<string, AgentRegistryEntry>();
  const listeners = new Set<() => void>;

  const notify = (): void => {
    for (const listener of listeners) listener;
  };

  const cloneEntry = (entry: AgentRegistryEntry): AgentRegistryEntry => ({...entry,
    capabilities: entry.capabilities.map((capability) => ({...capability })),
    allowedTools: [...entry.allowedTools],
    allowedPanels: [...entry.allowedPanels],
    allowedSlots: [...entry.allowedSlots],
  });

  return {
    register(input: AgentRegistryRegisterInput): AgentRegistryEntry {
      const existing = entries.get(input.id);
      const timestamp = now;
      const entry: AgentRegistryEntry = {
        id: input.id,
        kind: input.kind,
        label: input.label,
        scope: input.scope,
        transport: input.transport,
        capabilities: (input.capabilities ?? []).map((capability) => ({...capability })),
        status: existing?.status ?? 'idle',
        task: input.task ?? existing?.task,
        allowedTools: [...(input.allowedTools ?? existing?.allowedTools ?? [])],
        allowedPanels: [...(input.allowedPanels ?? existing?.allowedPanels ?? [])],
        allowedSlots: [...(input.allowedSlots ?? existing?.allowedSlots ?? [])],
        lastHeartbeatAt: timestamp(),
        registeredAt: existing?.registeredAt ?? timestamp,
      };
      entries.set(input.id, entry);
      notify();
      return cloneEntry(entry);
    },

    unregister(agentId: string): boolean {
      const removed = entries.delete(agentId);
      if (removed) notify;
      return removed;
    },

    get(agentId: string): AgentRegistryEntry | undefined {
      const entry = entries.get(agentId);
      return entry !== undefined ? cloneEntry(entry): undefined;
    },

    list(agentId?: string): readonly AgentRegistryEntry[] {
      if (agentId !== undefined) {
        const entry = entries.get(agentId);
        return entry !== undefined ? [cloneEntry(entry)]: [];
      }
      return [...entries.values()].map(cloneEntry);
    },

    setStatus(
      agentId: string,
      status: AgentSessionStatus,
      task?: string): AgentRegistryEntry | undefined {
      const entry = entries.get(agentId);
      if (entry === undefined) return undefined;
      const updated: AgentRegistryEntry = {...entry,
        status,
        task: task !== undefined ? task: entry.task,
        lastHeartbeatAt: now(),
      };
      entries.set(agentId, updated);
      notify();
      return cloneEntry(updated);
    },

    heartbeat(agentId: string, nowMs?: number): AgentRegistryEntry | undefined {
      const entry = entries.get(agentId);
      if (entry === undefined) return undefined;
      const updated: AgentRegistryEntry = {...entry,
        lastHeartbeatAt: nowMs ?? now,
      };
      entries.set(agentId, updated);
      notify();
      return cloneEntry(updated);
    },

    isToolAllowed(agentId: string, toolName: string): boolean {
      const entry = entries.get(agentId);
      if (entry === undefined) return false;
      if (entry.allowedTools.length === 0) return true;
      return entry.allowedTools.includes(toolName);
    },

    isPanelAllowed(agentId: string, panelId: string): boolean {
      const entry = entries.get(agentId);
      if (entry === undefined) return false;
      if (entry.allowedPanels.length === 0) return true;
      return entry.allowedPanels.includes(panelId);
    },

    isSlotAllowed(agentId: string, slotId: string): boolean {
      const entry = entries.get(agentId);
      if (entry === undefined) return false;
      if (entry.allowedSlots.length === 0) return true;
      return entry.allowedSlots.includes(slotId);
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
