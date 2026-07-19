/**
 * Data boundary contracts for the block renderer (05 section 1). The
 * framework owns everything around `DataAdapter`: cache keyed by
 * `(source, stableJson(params), contextId, entityId)`, in-flight dedupe,
 * AbortSignal on unmount and invalidate, single retry on `unavailable`,
 * stale-banner wiring, and `invalidate(source, scope?)` fan-out.
 */
import type { JsonObject, JsonValue, PanelScope, SpecAction } from '../types';

export type Unsubscribe = () => void;

/** Named source binding resolved through the host's adapter. */
export interface SourceRef {
  source: string;
  params?: JsonObject;
}

export type AdapterErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'conflict'
  | 'validation'
  | 'unavailable'
  | 'unknown';

export interface AdapterError {
  code: AdapterErrorCode;
  message: string;
  /** Maps onto field-form validation messages. */
  fieldErrors?: Record<string, string>;
}

export type MutationResult =
  | { ok: true; data?: JsonValue }
  | { ok: false; error: AdapterError };

/** The declared action shape handed to `DataAdapter.mutate`. */
export type DeclaredAction = Extract<SpecAction, { kind: 'mutate' }>;

export interface DataAdapter {
  query(ref: SourceRef, scope: PanelScope, signal: AbortSignal): Promise<unknown>;
  mutate(action: DeclaredAction, payload: unknown, scope: PanelScope): Promise<MutationResult>;
  /** Optional per source; remote-change signal drives stale-banner wiring. */
  subscribe?(ref: SourceRef, scope: PanelScope, onChange: () => void): Unsubscribe;
}

export type SourceStatus = 'idle' | 'loading' | 'success' | 'error';

/** Immutable view of one cached source binding. Identity is stable between changes. */
export interface SourceSnapshot {
  status: SourceStatus;
  /** Last successful query payload; `undefined` until the first success. */
  data: unknown;
  error: AdapterError | null;
  /** Remote change arrived while a consumer was dirty (renders the stale-banner). */
  stale: boolean;
  /** A query for this binding is currently in flight. */
  inFlight: boolean;
  /** At least one mounted consumer has unsaved local edits against this binding. */
  dirty: boolean;
}

/**
 * A mounted consumer's handle on one cached binding. Consumers acquire on
 * mount and must call `release` on unmount; the last release aborts any
 * in-flight query and detaches the remote subscription.
 */
export interface SourceBindingHandle {
  /** Cache key: `(source, stableJson(params), contextId, entityId)`. */
  key: string;
  getSnapshot(): SourceSnapshot;
  subscribe(listener: () => void): Unsubscribe;
  /**
   * Fetch again without clearing current data (no loading flash). Deduped:
   * concurrent calls share the in-flight query. Clears `stale` on success.
   */
  refetch(): Promise<void>;
  /** Mark this consumer's local edits; drives the stale-vs-silent-refetch decision. */
  setDirty(ownerId: string, dirty: boolean): void;
  release(): void;
}

export interface CreateDataLifecycleOptions {
  adapter: DataAdapter;
  /** Backoff before the single `unavailable` retry. Default 250ms. */
  retryBackoffMs?: number;
}

export interface DataLifecycle {
  adapter: DataAdapter;
  acquire(ref: SourceRef, scope: PanelScope): SourceBindingHandle;
  /**
   * Clear matching cache entries and refetch every mounted binding
   * (loading state reappears); unmounted entries are dropped. A partial
   * `scope` matches on the keys it defines.
   */
  invalidate(source: string, scope?: PanelScope): void;
  /** Route a declared mutate action through the adapter. */
  mutate(action: DeclaredAction, payload: unknown, scope: PanelScope): Promise<MutationResult>;
  /** Read a cached snapshot without acquiring. Never creates cache entries. */
  peek(ref: SourceRef, scope: PanelScope): SourceSnapshot;
  /** Monotonic per-entry change counter; 0 when the entry does not exist. */
  getVersion(ref: SourceRef, scope: PanelScope): number;
  /** Abort everything in flight, detach remote subscriptions, drop the cache. */
  dispose(): void;
}
