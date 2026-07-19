/**
 * Instrumented mock `DataAdapter` for renderer and data-lifecycle tests.
 * Queries resolve on real timers and honor `AbortSignal` for real: an
 * abort mid-flight cancels the pending timer and rejects with an
 * AbortError, exactly like `fetch` would. Nothing here is a synchronous
 * stub.
 */
import type { PanelScope } from '../../src/panels/types';
import type {
  AdapterError,
  DataAdapter,
  DeclaredAction,
  MutationResult,
  SourceRef,
  Unsubscribe,
} from '../../src/panels/renderer';

export interface RecordedQuery {
  ref: SourceRef;
  scope: PanelScope;
  signal: AbortSignal;
  outcome: 'pending' | 'resolved' | 'rejected' | 'aborted';
}

export interface RecordedMutation {
  action: DeclaredAction;
  payload: unknown;
  scope: PanelScope;
}

export type QueryPlan =
  | { data: unknown }
  | { error: AdapterError };

export interface MockAdapterOptions {
  /** Real-timer latency for queries and mutations. Default 15ms. */
  latencyMs?: number;
  /**
   * Result for a given call. `callIndex` counts calls per source,
   * starting at 0. Defaults to `{ data: "<source>-v<callIndex>" }`.
   */
  plan?: (ref: SourceRef, scope: PanelScope, callIndex: number) => QueryPlan;
  /** Result of `mutate`. Defaults to `{ ok: true }` after latency. */
  mutatePlan?: (action: DeclaredAction, payload: unknown, scope: PanelScope) => MutationResult;
}

export interface MockDataAdapter extends DataAdapter {
  readonly queries: RecordedQuery[];
  readonly mutations: RecordedMutation[];
  queryCount(source?: string): number;
  abortedCount(source?: string): number;
  subscriberCount(source?: string): number;
  /** Fire every registered remote-change callback for a source. */
  emitRemoteChange(source: string): void;
  /** Settles when no recorded query is still pending. */
  whenIdle(): Promise<void>;
}

function abortError(): Error {
  return new DOMException('The operation was aborted.', 'AbortError');
}

export function createMockDataAdapter(options: MockAdapterOptions = {}): MockDataAdapter {
  const latencyMs = options.latencyMs ?? 15;
  const plan =
    options.plan ??
    ((ref: SourceRef, _scope: PanelScope, callIndex: number): QueryPlan => ({
      data: `${ref.source}-v${callIndex}`,
    }));
  const mutatePlan = options.mutatePlan ?? ((): MutationResult => ({ ok: true }));

  const queries: RecordedQuery[] = [];
  const mutations: RecordedMutation[] = [];
  const callIndexBySource = new Map<string, number>();
  const subscribers: Array<{ ref: SourceRef; onChange: () => void; active: boolean }> = [];

  const adapter: MockDataAdapter = {
    queries,
    mutations,

    query(ref: SourceRef, scope: PanelScope, signal: AbortSignal): Promise<unknown> {
      const callIndex = callIndexBySource.get(ref.source) ?? 0;
      callIndexBySource.set(ref.source, callIndex + 1);
      const record: RecordedQuery = { ref, scope, signal, outcome: 'pending' };
      queries.push(record);
      const outcome = plan(ref, scope, callIndex);

      return new Promise((resolve, reject) => {
        if (signal.aborted) {
          record.outcome = 'aborted';
          reject(abortError());
          return;
        }
        const timer = setTimeout(() => {
          signal.removeEventListener('abort', onAbort);
          if ('error' in outcome) {
            record.outcome = 'rejected';
            reject(outcome.error);
          } else {
            record.outcome = 'resolved';
            resolve(outcome.data);
          }
        }, latencyMs);
        const onAbort = (): void => {
          clearTimeout(timer);
          record.outcome = 'aborted';
          reject(abortError());
        };
        signal.addEventListener('abort', onAbort, { once: true });
      });
    },

    mutate(action: DeclaredAction, payload: unknown, scope: PanelScope): Promise<MutationResult> {
      mutations.push({ action, payload, scope });
      const result = mutatePlan(action, payload, scope);
      return new Promise((resolve) => {
        setTimeout(() => resolve(result), latencyMs);
      });
    },

    subscribe(ref: SourceRef, _scope: PanelScope, onChange: () => void): Unsubscribe {
      const entry = { ref, onChange, active: true };
      subscribers.push(entry);
      return () => {
        entry.active = false;
      };
    },

    queryCount(source?: string): number {
      return queries.filter((query) => source === undefined || query.ref.source === source)
        .length;
    },

    abortedCount(source?: string): number {
      return queries.filter(
        (query) =>
          query.outcome === 'aborted' && (source === undefined || query.ref.source === source),
      ).length;
    },

    subscriberCount(source?: string): number {
      return subscribers.filter(
        (entry) => entry.active && (source === undefined || entry.ref.source === source),
      ).length;
    },

    emitRemoteChange(source: string): void {
      for (const entry of subscribers) {
        if (entry.active && entry.ref.source === source) {
          entry.onChange();
        }
      }
    },

    whenIdle(): Promise<void> {
      return new Promise((resolve) => {
        const check = (): void => {
          if (queries.every((query) => query.outcome !== 'pending')) {
            resolve();
            return;
          }
          setTimeout(check, 5);
        };
        check();
      });
    },
  };

  return adapter;
}
