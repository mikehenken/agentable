/**
 * Read-only DataAdapter bindings for spec devtools sources.
 */
import type { PanelScope } from '../panels/types';
import type {
  DataAdapter,
  DeclaredAction,
  MutationResult,
  SourceRef,
  Unsubscribe,
} from '../panels/renderer/types';
import type { SpecDevtoolsSession } from './specDevtoolsSession';
import {
  createBindingListRow,
  createEventHistoryListRow,
  createValidationTraceListRow,
  DEVTOOLS_BINDINGS_SOURCE,
  DEVTOOLS_EVENTS_SOURCE,
  DEVTOOLS_VALIDATION_SOURCE,
} from './specDevtoolsRows';

function readOnlyMutationError(source: string): MutationResult {
  return {
    ok: false,
    error: {
      code: 'forbidden',
      message: `${source} is read-only`,
    },
  };
}

export function createSpecDevtoolsDataAdapter(session: SpecDevtoolsSession): DataAdapter {
  return {
    query(ref: SourceRef, _scope: PanelScope, signal: AbortSignal): Promise<unknown> {
      if (signal.aborted) {
        return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
      }

      const snapshot = session.getSnapshot;

      switch (ref.source) {
        case DEVTOOLS_VALIDATION_SOURCE:
          return Promise.resolve(
            snapshot().validationTrace.map((row) => createValidationTraceListRow(row)));
        case DEVTOOLS_BINDINGS_SOURCE:
          return Promise.resolve(snapshot().bindings.map((row) => createBindingListRow(row)));
        case DEVTOOLS_EVENTS_SOURCE:
          return Promise.resolve(snapshot().eventHistory.map((row) => createEventHistoryListRow(row)));
        default:
          return Promise.reject({
            code: 'not_found',
            message: `Unknown devtools source "${ref.source}"`,
          });
      }
    },

    mutate(action: DeclaredAction, _payload: unknown, _scope: PanelScope): Promise<MutationResult> {
      void _payload;
      void _scope;
      return Promise.resolve(readOnlyMutationError(action.source ?? 'devtools'));
    },

    subscribe(ref: SourceRef, _scope: PanelScope, onChange: () => void): Unsubscribe {
      if (
        ref.source !== DEVTOOLS_VALIDATION_SOURCE &&
        ref.source !== DEVTOOLS_BINDINGS_SOURCE &&
        ref.source !== DEVTOOLS_EVENTS_SOURCE
      ) {
        return () => {};
      }
      return session.subscribe(onChange);
    },
  };
}

/**
 * Merge devtools read-only sources into an existing host adapter.
 */
export function withSpecDevtoolsSources(
  session: SpecDevtoolsSession,
  base?: DataAdapter): DataAdapter {
  const devtoolsAdapter = createSpecDevtoolsDataAdapter(session);
  if (base === undefined) {
    return devtoolsAdapter;
  }

  return {
    query(ref: SourceRef, scope: PanelScope, signal: AbortSignal): Promise<unknown> {
      if (
        ref.source === DEVTOOLS_VALIDATION_SOURCE ||
        ref.source === DEVTOOLS_BINDINGS_SOURCE ||
        ref.source === DEVTOOLS_EVENTS_SOURCE
      ) {
        return devtoolsAdapter.query(ref, scope, signal);
      }
      return base.query(ref, scope, signal);
    },

    mutate(action: DeclaredAction, payload: unknown, scope: PanelScope): Promise<MutationResult> {
      if (
        action.source === DEVTOOLS_VALIDATION_SOURCE ||
        action.source === DEVTOOLS_BINDINGS_SOURCE ||
        action.source === DEVTOOLS_EVENTS_SOURCE
      ) {
        return devtoolsAdapter.mutate(action, payload, scope);
      }
      return base.mutate(action, payload, scope);
    },

    subscribe(ref: SourceRef, scope: PanelScope, onChange: () => void): Unsubscribe {
      if (
        ref.source === DEVTOOLS_VALIDATION_SOURCE ||
        ref.source === DEVTOOLS_BINDINGS_SOURCE ||
        ref.source === DEVTOOLS_EVENTS_SOURCE
      ) {
        return devtoolsAdapter.subscribe!(ref, scope, onChange);
      }
      if (base.subscribe !== undefined) {
        return base.subscribe(ref, scope, onChange);
      }
      return () => {};
    },
  };
}
