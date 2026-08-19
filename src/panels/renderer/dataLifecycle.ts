/**
 * Framework-owned data lifecycle around a `DataAdapter` (02 section 6,
 * 05 section 1). One store per host; every source binding a renderer
 * mounts flows through here.
 *
 * Guarantees:
 * - cache keyed `(source, stableJson(params), contextId, entityId)`
 * - in-flight dedupe: concurrent consumers of one key share one query
 * - AbortSignal fires on last release (unmount) and on invalidate
 * - retry only on `unavailable`, exactly once, after a backoff
 * - `subscribe` wiring: remote change refetches silently unless a
 *   consumer is dirty, in which case the binding turns stale instead
 * - `invalidate(source, scope?)` clears matching entries and refetches
 *   the mounted ones
 */
import type { PanelScope } from '../types';
import { scopeMatches, sourceCacheKey } from './cacheKey';
import type {
  AdapterError,
  CreateDataLifecycleOptions,
  DataLifecycle,
  DeclaredAction,
  MutationResult,
  SourceBindingHandle,
  SourceRef,
  SourceSnapshot,
  Unsubscribe,
} from './types';

const DEFAULT_RETRY_BACKOFF_MS = 250;

const ADAPTER_ERROR_CODES = new Set([
  'not_found',
  'forbidden',
  'conflict',
  'validation',
  'unavailable',
  'unknown',
]);

const IDLE_SNAPSHOT: SourceSnapshot = {
  status: 'idle',
  data: undefined,
  error: null,
  stale: false,
  inFlight: false,
  dirty: false,
};

interface CacheEntry {
  key: string;
  ref: SourceRef;
  scope: PanelScope;
  status: SourceSnapshot['status'];
  data: unknown;
  error: AdapterError | null;
  stale: boolean;
  refCount: number;
  version: number;
  listeners: Set<() => void>;
  dirtyOwners: Set<string>;
  controller: AbortController | null;
  fetchPromise: Promise<void> | null;
  /** Monotonic token; a settled fetch only writes if it is still current. */
  fetchId: number;
  remoteUnsubscribe: Unsubscribe | null;
  snapshot: SourceSnapshot | null;
}

function toAdapterError(reason: unknown): AdapterError {
  if (typeof reason === 'object' && reason !== null) {
    const candidate = reason as { code?: unknown; message?: unknown };
    if (typeof candidate.code === 'string' && ADAPTER_ERROR_CODES.has(candidate.code)) {
      return {
        code: candidate.code as AdapterError['code'],
        message: typeof candidate.message === 'string' ? candidate.message: 'Query failed',...(isFieldErrors((reason as { fieldErrors?: unknown }).fieldErrors)
          ? { fieldErrors: (reason as { fieldErrors: Record<string, string> }).fieldErrors }: {}),
      };
    }
  }
  if (reason instanceof Error) {
    return { code: 'unknown', message: reason.message };
  }
  return { code: 'unknown', message: 'Query failed' };
}

function isFieldErrors(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  );
}

/** Resolves `true` when aborted before the delay elapses. */
function abortableDelay(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(true);
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(false);
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      resolve(true);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function createDataLifecycle(options: CreateDataLifecycleOptions): DataLifecycle {
  const { adapter } = options;
  const retryBackoffMs = options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;
  const onInvalidate = options.onInvalidate;
  const cache = new Map<string, CacheEntry>();
  let disposed = false;

  const notify = (entry: CacheEntry): void => {
    entry.version += 1;
    entry.snapshot = null;
    for (const listener of [...entry.listeners]) {
      listener();
    }
  };

  const snapshotOf = (entry: CacheEntry): SourceSnapshot => {
    if (entry.snapshot === null) {
      entry.snapshot = {
        status: entry.status,
        data: entry.data,
        error: entry.error,
        stale: entry.stale,
        inFlight: entry.fetchPromise !== null,
        dirty: entry.dirtyOwners.size > 0,
      };
    }
    return entry.snapshot;
  };

  const abortInFlight = (entry: CacheEntry): void => {
    if (entry.controller === null) return;
    // Invalidate the token first so the settling fetch never writes back.
    entry.fetchId += 1;
    entry.controller.abort();
    entry.controller = null;
    entry.fetchPromise = null;
  };

  const startFetch = (entry: CacheEntry, opts: { clear: boolean }): Promise<void> => {
    if (entry.fetchPromise !== null && !opts.clear) {
      return entry.fetchPromise;
    }
    if (opts.clear) {
      abortInFlight(entry);
      entry.data = undefined;
    }
    const controller = new AbortController();
    entry.controller = controller;
    entry.fetchId += 1;
    const fetchId = entry.fetchId;
    // Keep showing current data during a silent refetch; only surface the
    // loading skeleton when there is nothing to show yet.
    entry.status = entry.data === undefined ? 'loading' : entry.status;
    entry.error = null;

    const isCurrent = (): boolean => !controller.signal.aborted && entry.fetchId === fetchId;

    const run = async (): Promise<void> => {
      for (let attempt = 0; ; attempt += 1) {
        try {
          const result = await adapter.query(entry.ref, entry.scope, controller.signal);
          if (!isCurrent()) return;
          entry.data = result;
          entry.status = 'success';
          entry.error = null;
          entry.stale = false;
          return;
        } catch (reason) {
          if (!isCurrent()) return;
          const error = toAdapterError(reason);
          if (error.code === 'unavailable' && attempt === 0) {
            const aborted = await abortableDelay(retryBackoffMs, controller.signal);
            if (aborted || !isCurrent()) return;
            continue;
          }
          entry.error = error;
          entry.status = 'error';
          return;
        }
      }
    };

    const promise = run().then(() => {
      if (entry.fetchId !== fetchId) return;
      entry.fetchPromise = null;
      entry.controller = null;
      notify(entry);
    });
    entry.fetchPromise = promise;
    notify(entry);
    return promise;
  };

  const onRemoteChange = (entry: CacheEntry): void => {
    if (disposed || entry.refCount === 0) return;
    if (entry.dirtyOwners.size > 0) {
      // A consumer is mid-edit: never clobber the draft. Raise the
      // stale-banner and wait for an explicit refresh or a save.
      if (!entry.stale) {
        entry.stale = true;
        notify(entry);
      }
      return;
    }
    void startFetch(entry, { clear: false });
  };

  const ensureEntry = (ref: SourceRef, scope: PanelScope): CacheEntry => {
    const key = sourceCacheKey(ref, scope);
    const existing = cache.get(key);
    if (existing !== undefined) return existing;
    const entry: CacheEntry = {
      key,
      ref: { source: ref.source, ...(ref.params !== undefined ? { params: ref.params } : {}) },
      scope: { contextId: scope.contextId, entityId: scope.entityId },
      status: 'idle',
      data: undefined,
      error: null,
      stale: false,
      refCount: 0,
      version: 1,
      listeners: new Set(),
      dirtyOwners: new Set(),
      controller: null,
      fetchPromise: null,
      fetchId: 0,
      remoteUnsubscribe: null,
      snapshot: null,
    };
    cache.set(key, entry);
    return entry;
  };

  const acquire = (ref: SourceRef, scope: PanelScope): SourceBindingHandle => {
    if (disposed) {
      throw new Error('data lifecycle disposed; acquire is no longer available');
    }
    const entry = ensureEntry(ref, scope);
    entry.refCount += 1;
    if (entry.refCount === 1 && adapter.subscribe !== undefined) {
      try {
        entry.remoteUnsubscribe = adapter.subscribe(entry.ref, entry.scope, () => {
          onRemoteChange(entry);
        });
      } catch (reason) {
        console.error('[dataLifecycle] adapter.subscribe failed', entry.ref.source, reason);
        entry.remoteUnsubscribe = null;
      }
    }
    if (entry.status === 'idle' && entry.fetchPromise === null) {
      void startFetch(entry, { clear: false });
    }

    let released = false;
    const ownedDirtyIds = new Set<string>();

    return {
      key: entry.key,
      getSnapshot: () => snapshotOf(entry),
      subscribe: (listener: () => void): Unsubscribe => {
        entry.listeners.add(listener);
        return () => {
          entry.listeners.delete(listener);
        };
      },
      refetch: () => startFetch(entry, { clear: false }),
      setDirty: (ownerId: string, dirty: boolean): void => {
        const changed = dirty
          ? !entry.dirtyOwners.has(ownerId): entry.dirtyOwners.delete(ownerId);
        if (dirty) {
          entry.dirtyOwners.add(ownerId);
          ownedDirtyIds.add(ownerId);
        } else {
          ownedDirtyIds.delete(ownerId);
        }
        if (!changed) return;
        if (!dirty && entry.dirtyOwners.size === 0 && entry.stale) {
          // The last draft resolved while remote data was pending: pick
          // it up silently now instead of leaving the banner up.
          void startFetch(entry, { clear: false });
          return;
        }
        notify(entry);
      },
      release: (): void => {
        if (released) return;
        released = true;
        for (const ownerId of ownedDirtyIds) {
          entry.dirtyOwners.delete(ownerId);
        }
        ownedDirtyIds.clear();
        entry.refCount = Math.max(0, entry.refCount - 1);
        if (entry.refCount > 0) return;
        abortInFlight(entry);
        if (entry.remoteUnsubscribe !== null) {
          entry.remoteUnsubscribe();
          entry.remoteUnsubscribe = null;
        }
        if (entry.data === undefined) {
          // Nothing usable was cached; forget the entry so a remount
          // starts from a clean fetch.
          cache.delete(entry.key);
        } else {
          entry.status = 'success';
          entry.stale = false;
          notify(entry);
        }
      },
    };
  };

  const invalidate = (source: string, scope?: PanelScope): void => {
    if (disposed) return;
    for (const entry of [...cache.values()]) {
      if (entry.ref.source !== source) continue;
      if (scope !== undefined && !scopeMatches(scope, entry.scope)) continue;
      if (entry.refCount > 0) {
        void startFetch(entry, { clear: true });
      } else {
        cache.delete(entry.key);
      }
    }
    onInvalidate?.(source, scope);
  };

  const mutate = (
    action: DeclaredAction,
    payload: unknown,
    scope: PanelScope): Promise<MutationResult> => {
    if (disposed) {
      return Promise.resolve({
        ok: false,
        error: { code: 'unavailable', message: 'data lifecycle disposed' },
      });
    }
    return adapter.mutate(action, payload, scope).catch((reason: unknown) => ({
      ok: false as const,
      error: toAdapterError(reason),
    }));
  };

  const peek = (ref: SourceRef, scope: PanelScope): SourceSnapshot => {
    const entry = cache.get(sourceCacheKey(ref, scope));
    return entry === undefined ? IDLE_SNAPSHOT : snapshotOf(entry);
  };

  const getVersion = (ref: SourceRef, scope: PanelScope): number => {
    return cache.get(sourceCacheKey(ref, scope))?.version ?? 0;
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    for (const entry of cache.values()) {
      abortInFlight(entry);
      if (entry.remoteUnsubscribe !== null) {
        entry.remoteUnsubscribe();
        entry.remoteUnsubscribe = null;
      }
      entry.listeners.clear();
    }
    cache.clear();
  };

  return { adapter, acquire, invalidate, mutate, peek, getVersion, dispose };
}
