/**
 * Operator thread tab persistence — localStorage per tenant (NAS parity, P13-T7 iter-5).
 */
import { DEFAULT_OPERATOR_THREADS } from './constants';
import type { OperatorMessage, OperatorThread } from './types';
import { isOperatorA2UIMessage, isOperatorTextMessage } from './types';

const STORAGE_VERSION = 1 as const;
const STORAGE_PREFIX = 'agentable-operator:threads:';

interface PersistedOperatorState {
  v: typeof STORAGE_VERSION;
  activeThreadId: string;
  threads: OperatorThread[];
}

function storageKey(tenant: string): string {
  const slug = tenant.trim() || 'default';
  return `${STORAGE_PREFIX}${slug}`;
}

function resolveTenantSlug(): string {
  const whiteboard = document.querySelector('agentable-whiteboard');
  if (whiteboard instanceof HTMLElement) {
    const tenant = whiteboard.getAttribute('tenant')?.trim();
    if (tenant && tenant.length > 0) {
      return tenant;
    }
  }
  return 'default';
}

function isValidMessage(value: unknown): value is OperatorMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.role !== 'string') {
    return false;
  }
  if (record.kind === 'text') {
    return typeof record.text === 'string' && typeof record.timestamp === 'string';
  }
  if (record.kind === 'tool') {
    return (
      typeof record.toolName === 'string' &&
      typeof record.ok === 'boolean' &&
      typeof record.timestamp === 'string'
    );
  }
  if (record.kind === 'reasoning') {
    return typeof record.text === 'string' && typeof record.timestamp === 'string';
  }
  if (record.kind === 'a2ui') {
    return Array.isArray(record.envelopes) && typeof record.timestamp === 'string';
  }
  return false;
}

function isValidThread(value: unknown): value is OperatorThread {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.title !== 'string') {
    return false;
  }
  if (!Array.isArray(record.messages)) {
    return false;
  }
  return record.messages.every(isValidMessage);
}

function readPersistedState(tenant: string): PersistedOperatorState | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(storageKey(tenant));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as PersistedOperatorState;
    if (parsed?.v !== STORAGE_VERSION || !Array.isArray(parsed.threads) || parsed.threads.length === 0) {
      return null;
    }
    if (typeof parsed.activeThreadId !== 'string') {
      return null;
    }
    if (!parsed.threads.every(isValidThread)) {
      return null;
    }
    if (!parsed.threads.some((thread) => thread.id === parsed.activeThreadId)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writePersistedState(tenant: string, state: PersistedOperatorState): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(storageKey(tenant), JSON.stringify(state));
  } catch {
    // Quota exceeded or storage disabled — non-fatal.
  }
}

/** Load persisted threads for the current whiteboard tenant, or defaults. */
export function loadOperatorThreadState(): {
  threads: readonly OperatorThread[];
  activeThreadId: string;
} {
  const tenant = resolveTenantSlug();
  const persisted = readPersistedState(tenant);
  if (persisted === null) {
    const fallback = DEFAULT_OPERATOR_THREADS[0];
    return {
      threads: DEFAULT_OPERATOR_THREADS,
      activeThreadId: fallback?.id ?? 'thread-main',
    };
  }
  return {
    threads: persisted.threads,
    activeThreadId: persisted.activeThreadId,
  };
}

/** Persist operator tabs + active id (messages included — NAS local transcript parity). */
export function persistOperatorThreadState(
  threads: readonly OperatorThread[],
  activeThreadId: string,
): void {
  if (threads.length === 0) {
    return;
  }
  const tenant = resolveTenantSlug();
  writePersistedState(tenant, {
    v: STORAGE_VERSION,
    activeThreadId,
    threads: threads.map((thread) => ({
      ...thread,
      messages: thread.messages.filter(
        (message) =>
          isOperatorTextMessage(message) ||
          isOperatorA2UIMessage(message) ||
          message.kind === 'tool' ||
          message.kind === 'reasoning',
      ),
    })),
  });
}

/** Test helper — clear persisted operator state for a tenant slug. */
export function clearOperatorThreadPersistenceForTests(tenant = 'default'): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(storageKey(tenant));
}
