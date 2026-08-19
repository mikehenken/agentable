/**
 * DataAdapter binding for `agents.activity`.
 * Read-only; live updates via ActivityLog.subscribe.
 */
import type { PanelScope } from '../panels/types';
import type {
  DataAdapter,
  DeclaredAction,
  MutationResult,
  SourceRef,
  Unsubscribe,
} from '../panels/renderer/types';
import type { ActivityLog } from './activity';
import {
  AGENTS_ACTIVITY_SOURCE,
  activityFilterFromParams,
  mapActivityEntriesToListRows,
  type ActivityQueryParams,
} from './activityRows';

function isActivityQueryParams(value: unknown): value is ActivityQueryParams {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.actor !== undefined && typeof record.actor !== 'string') return false;
  if (record.since !== undefined && typeof record.since !== 'string') return false;
  if (record.limit !== undefined && typeof record.limit !== 'number') return false;
  return true;
}

function readOnlyMutationError(): MutationResult {
  return {
    ok: false,
    error: {
      code: 'forbidden',
      message: `${AGENTS_ACTIVITY_SOURCE} is read-only`,
    },
  };
}

export function createActivityDataAdapter(activity: ActivityLog): DataAdapter {
  return {
    query(ref: SourceRef, _scope: PanelScope, signal: AbortSignal): Promise<unknown> {
      if (ref.source !== AGENTS_ACTIVITY_SOURCE) {
        return Promise.reject({
          code: 'not_found',
          message: `Unknown source "${ref.source}"`,
        });
      }
      if (signal.aborted) {
        return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
      }
      const params = isActivityQueryParams(ref.params) ? ref.params: undefined;
      const rows = mapActivityEntriesToListRows(
        activity.getEntries(activityFilterFromParams(params)));
      return Promise.resolve(rows);
    },

    mutate(_action: DeclaredAction, _payload: unknown, _scope: PanelScope): Promise<MutationResult> {
      return Promise.resolve(readOnlyMutationError);
    },

    subscribe(ref: SourceRef, _scope: PanelScope, onChange: () => void): Unsubscribe {
      if (ref.source !== AGENTS_ACTIVITY_SOURCE) {
        return () => {};
      }
      return activity.subscribe(onChange);
    },
  };
}

/**
 * Merge the activity ledger source into an existing host adapter.
 * When `base` is omitted, returns the activity-only adapter.
 */
export function withActivitySource(activity: ActivityLog, base?: DataAdapter): DataAdapter {
  const activityAdapter = createActivityDataAdapter(activity);
  if (base === undefined) {
    return activityAdapter;
  }

  return {
    query(ref: SourceRef, scope: PanelScope, signal: AbortSignal): Promise<unknown> {
      if (ref.source === AGENTS_ACTIVITY_SOURCE) {
        return activityAdapter.query(ref, scope, signal);
      }
      return base.query(ref, scope, signal);
    },

    mutate(action: DeclaredAction, payload: unknown, scope: PanelScope): Promise<MutationResult> {
      if (action.source === AGENTS_ACTIVITY_SOURCE) {
        return activityAdapter.mutate(action, payload, scope);
      }
      return base.mutate(action, payload, scope);
    },

    subscribe(ref: SourceRef, scope: PanelScope, onChange: () => void): Unsubscribe {
      if (ref.source === AGENTS_ACTIVITY_SOURCE) {
        return activityAdapter.subscribe!(ref, scope, onChange);
      }
      if (base.subscribe !== undefined) {
        return base.subscribe(ref, scope, onChange);
      }
      return () => {};
    },
  };
}
