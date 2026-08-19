/**
 * Scope leases (D23): advisory TTL claims for contested panel/source scopes.
 * Soft in v1 — conflicts warn (activity) and return holder info; they do not block.
 */
export interface LeaseClaimInput {
  /** Claiming agent or host source id. */
  source: string;
  /** Contested scope key (panel id, source name, or composite). */
  scope: string;
  /** Time-to-live in milliseconds. */
  ttlMs: number;
}

export interface Lease {
  id: string;
  source: string;
  scope: string;
  claimedAt: number;
  expiresAt: number;
  ttlMs: number;
}

export type LeaseClaimResult =
  | { ok: true; lease: Lease }
  | { ok: false; holder: Lease; reason: 'conflict' | 'invalid_ttl' };

export interface LeaseManager {
  claim(input: LeaseClaimInput): LeaseClaimResult;
  release(leaseId: string): boolean;
  releaseScope(scope: string, source?: string): number;
  get(scope: string): Lease | undefined;
  list(): readonly Lease[];
  /** Drop expired leases; returns count removed. */
  gc(nowMs?: number): number;
  /** True when `now` is past `expiresAt` (and after GC). */
  isExpired(leaseId: string, nowMs?: number): boolean;
  subscribe(listener: () => void): () => void;
}

let leaseCounter = 0;

function nextLeaseId(): string {
  leaseCounter += 1;
  return `lease-${leaseCounter}`;
}

export function resetLeaseCounterForTests(): void {
  leaseCounter = 0;
}

export function createLeaseManager(options?: {
  now?: () => number;
}): LeaseManager {
  const now = options?.now ?? (() => Date.now());
  const byScope = new Map<string, Lease>();
  const byId = new Map<string, Lease>();
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  const cloneLease = (lease: Lease): Lease => ({ ...lease });

  const dropLease = (lease: Lease): void => {
    byScope.delete(lease.scope);
    byId.delete(lease.id);
  };

  const gcInternal = (at: number): number => {
    let removed = 0;
    for (const lease of [...byId.values()]) {
      if (lease.expiresAt <= at) {
        dropLease(lease);
        removed += 1;
      }
    }
    if (removed > 0) notify();
    return removed;
  };

  return {
    claim(input: LeaseClaimInput): LeaseClaimResult {
      const at = now();
      gcInternal(at);

      if (!Number.isFinite(input.ttlMs) || input.ttlMs <= 0) {
        const holder = byScope.get(input.scope);
        return {
          ok: false,
          holder: holder ?? {
            id: 'invalid',
            source: input.source,
            scope: input.scope,
            claimedAt: at,
            expiresAt: at,
            ttlMs: input.ttlMs,
          },
          reason: 'invalid_ttl',
        };
      }

      const existing = byScope.get(input.scope);
      if (existing !== undefined && existing.source !== input.source) {
        return { ok: false, holder: cloneLease(existing), reason: 'conflict' };
      }

      // Same source renews in place.
      if (existing !== undefined && existing.source === input.source) {
        const renewed: Lease = {
          ...existing,
          claimedAt: at,
          expiresAt: at + input.ttlMs,
          ttlMs: input.ttlMs,
        };
        byScope.set(input.scope, renewed);
        byId.set(renewed.id, renewed);
        notify();
        return { ok: true, lease: cloneLease(renewed) };
      }

      const lease: Lease = {
        id: nextLeaseId(),
        source: input.source,
        scope: input.scope,
        claimedAt: at,
        expiresAt: at + input.ttlMs,
        ttlMs: input.ttlMs,
      };
      byScope.set(input.scope, lease);
      byId.set(lease.id, lease);
      notify();
      return { ok: true, lease: cloneLease(lease) };
    },

    release(leaseId: string): boolean {
      const lease = byId.get(leaseId);
      if (lease === undefined) return false;
      dropLease(lease);
      notify();
      return true;
    },

    releaseScope(scope: string, source?: string): number {
      const lease = byScope.get(scope);
      if (lease === undefined) return 0;
      if (source !== undefined && lease.source !== source) return 0;
      dropLease(lease);
      notify();
      return 1;
    },

    get(scope: string): Lease | undefined {
      gcInternal(now());
      const lease = byScope.get(scope);
      return lease !== undefined ? cloneLease(lease) : undefined;
    },

    list(): readonly Lease[] {
      gcInternal(now());
      return [...byId.values()].map(cloneLease);
    },

    gc(nowMs?: number): number {
      return gcInternal(nowMs ?? now());
    },

    isExpired(leaseId: string, nowMs?: number): boolean {
      const at = nowMs ?? now();
      const lease = byId.get(leaseId);
      if (lease === undefined) return true;
      if (lease.expiresAt <= at) {
        dropLease(lease);
        notify();
        return true;
      }
      return false;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
