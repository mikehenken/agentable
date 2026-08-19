/**
 * Session-scoped activity ledger (03 section 3.3).
 *
 * Append-only ring buffer powering digest recency, provenance chains, and
 * the per-actor reversal ledger. Hosts may persist entries via adapter later.
 */
import type { JsonValue } from '../panels/types';

export type ActivityActor = 'user' | string;

export type ActivityProvenance =
  | { derivedFrom: 'site-html' }
  | { derivedFrom: 'user' }
  | { derivedFrom: `agent:${string}` };

/** Inverse action reference for compensating reversal under HITL. */
export interface DeclaredInverseAction {
  panelId: string;
  definitionId: string;
  actionId: string;
  payload?: Record<string, JsonValue>;
}

export interface ActivityReversalMeta {
  /** Compensating action when reversible; omitted when irreversible. */
  inverse?: DeclaredInverseAction;
  reversible: boolean;
 /** Persisted panel mutations are never stack-undoable. */
  persisted: boolean;
  /** When this entry reverses another ledger row. */
  reversesEntryId?: string;
  /** When this entry was reversed by a compensating action. */
  reversedByEntryId?: string;
}

export interface ActivityEntry {
  id: string;
  ts: string;
  actor: ActivityActor;
  verb: string;
  target: string;
  provenance?: ActivityProvenance;
  reversal: ActivityReversalMeta;
}

export interface ActivityLogFilter {
  actor?: ActivityActor;
  since?: string;
  limit?: number;
}

export interface ActivityLog {
  append(entry: Omit<ActivityEntry, 'id' | 'ts'>): ActivityEntry;
  get(id: string): ActivityEntry | undefined;
  getEntries(filter?: ActivityLogFilter): readonly ActivityEntry[];
  markReversed(originalId: string, reversalEntryId: string): void;
  subscribe(listener: () => void): () => void;
}

const DEFAULT_CAPACITY = 500;

let entryCounter = 0;

function nextEntryId(): string {
  entryCounter += 1;
  return `activity-${entryCounter}`;
}

export function createActivityLog(capacity: number = DEFAULT_CAPACITY): ActivityLog {
  const entries: ActivityEntry[] = [];
  const byId = new Map<string, ActivityEntry>();
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  return {
    append(entry: Omit<ActivityEntry, 'id' | 'ts'>): ActivityEntry {
      const full: ActivityEntry = {
        ...entry,
        id: nextEntryId(),
        ts: new Date().toISOString(),
      };
      entries.push(full);
      byId.set(full.id, full);
      while (entries.length > capacity) {
        const removed = entries.shift();
        if (removed !== undefined) {
          byId.delete(removed.id);
        }
      }
      notify();
      return full;
    },

    get(id: string): ActivityEntry | undefined {
      return byId.get(id);
    },

    getEntries(filter: ActivityLogFilter = {}): readonly ActivityEntry[] {
      let result = entries as readonly ActivityEntry[];
      if (filter.since !== undefined) {
        result = result.filter((entry) => entry.ts >= filter.since!);
      }
      if (filter.actor !== undefined) {
        result = result.filter((entry) => entry.actor === filter.actor);
      }
      const limit = filter.limit ?? result.length;
      return result.slice(-limit);
    },

    markReversed(originalId: string, reversalEntryId: string): void {
      const original = byId.get(originalId);
      if (original === undefined) return;
      const updated: ActivityEntry = {
        ...original,
        reversal: {
          ...original.reversal,
          reversedByEntryId: reversalEntryId,
        },
      };
      const index = entries.findIndex((entry) => entry.id === originalId);
      if (index >= 0) {
        entries[index] = updated;
      }
      byId.set(originalId, updated);
      notify();
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Reset test counter between unit suites. */
export function resetActivityLogCounterForTests(): void {
  entryCounter = 0;
}
