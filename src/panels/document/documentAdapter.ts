/**
 * In-memory `workspace.documents` adapter. Host persistence via
 * `createPersistedDocumentStore`.
 */
import type { JsonValue, PanelScope } from '../types';
import type {
  DataAdapter,
  DeclaredAction,
  MutationResult,
  SourceRef,
  Unsubscribe,
} from '../renderer/types';
import type { DocumentPayload } from './types';
import { WORKSPACE_DOCUMENTS_SOURCE } from './types';
import { parseDocumentPayload } from './validate';

export interface DocumentStore {
  get(documentId: string): DocumentPayload | undefined;
  set(documentId: string, payload: DocumentPayload): void;
  subscribe(documentId: string, listener: () => void): () => void;
}

export function createInMemoryDocumentStore(
  seed: Record<string, DocumentPayload> = {},
): DocumentStore {
  const documents = new Map<string, DocumentPayload>(Object.entries(seed));
  const listeners = new Map<string, Set<() => void>>();

  const notify = (documentId: string): void => {
    const set = listeners.get(documentId);
    if (set === undefined) return;
    for (const listener of set) {
      listener();
    }
  };

  return {
    get(documentId: string): DocumentPayload | undefined {
      return documents.get(documentId);
    },
    set(documentId: string, payload: DocumentPayload): void {
      documents.set(documentId, payload);
      notify(documentId);
    },
    subscribe(documentId: string, listener: () => void): () => void {
      let set = listeners.get(documentId);
      if (set === undefined) {
        set = new Set();
        listeners.set(documentId, set);
      }
      set.add(listener);
      return () => {
        set?.delete(listener);
      };
    },
  };
}

function readDocumentId(ref: SourceRef, scope: PanelScope): string | null {
  if (typeof ref.params === 'object' && ref.params !== null && !Array.isArray(ref.params)) {
    const fromParams = (ref.params as Record<string, unknown>).documentId;
    if (typeof fromParams === 'string' && fromParams.length > 0) {
      return fromParams;
    }
  }
  if (scope.entityId !== undefined && scope.entityId.length > 0) {
    return scope.entityId;
  }
  return null;
}

export function createDocumentDataAdapter(store: DocumentStore): DataAdapter {
  return {
    query(ref: SourceRef, scope: PanelScope, signal: AbortSignal): Promise<unknown> {
      if (ref.source !== WORKSPACE_DOCUMENTS_SOURCE) {
        return Promise.reject({
          code: 'not_found',
          message: `Unknown source "${ref.source}"`,
        });
      }
      if (signal.aborted) {
        return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
      }
      const documentId = readDocumentId(ref, scope);
      if (documentId === null) {
        return Promise.reject({
          code: 'validation',
          message: 'workspace.documents requires documentId param or scope.entityId',
        });
      }
      const payload = store.get(documentId);
      if (payload === undefined) {
        return Promise.reject({
          code: 'not_found',
          message: `Document "${documentId}" not found`,
        });
      }
      return Promise.resolve(payload);
    },

    mutate(action: DeclaredAction, payload: unknown, scope: PanelScope): Promise<MutationResult> {
      if (action.source !== WORKSPACE_DOCUMENTS_SOURCE) {
        return Promise.reject({
          code: 'not_found',
          message: `Unknown source "${action.source}"`,
        });
      }
      const documentId = readDocumentId({ source: action.source, params: {} }, scope);
      if (documentId === null) {
        return Promise.resolve({
          ok: false,
          error: { code: 'validation', message: 'Missing document id' },
        });
      }
      const parsed = parseDocumentPayload(payload);
      if (parsed === null) {
        return Promise.resolve({
          ok: false,
          error: { code: 'validation', message: 'Invalid document payload' },
        });
      }
      store.set(documentId, { ...parsed, documentId, version: (parsed.version ?? 0) + 1 });
      // Safe: parsed is the output of parseDocumentPayload over JSON input, a plain JSON shape.
      return Promise.resolve({ ok: true, data: parsed as unknown as JsonValue });
    },

    subscribe(ref: SourceRef, scope: PanelScope, onChange: () => void): Unsubscribe {
      if (ref.source !== WORKSPACE_DOCUMENTS_SOURCE) {
        return () => {};
      }
      const documentId = readDocumentId(ref, scope);
      if (documentId === null) {
        return () => {};
      }
      return store.subscribe(documentId, onChange);
    },
  };
}

export function withDocumentSource(store: DocumentStore, base?: DataAdapter): DataAdapter {
  const documentAdapter = createDocumentDataAdapter(store);
  if (base === undefined) {
    return documentAdapter;
  }

  return {
    query(ref: SourceRef, scope: PanelScope, signal: AbortSignal): Promise<unknown> {
      if (ref.source === WORKSPACE_DOCUMENTS_SOURCE) {
        return documentAdapter.query(ref, scope, signal);
      }
      return base.query(ref, scope, signal);
    },

    mutate(action: DeclaredAction, payload: unknown, scope: PanelScope): Promise<MutationResult> {
      if (action.source === WORKSPACE_DOCUMENTS_SOURCE) {
        return documentAdapter.mutate(action, payload, scope);
      }
      return base.mutate(action, payload, scope);
    },

    subscribe(ref: SourceRef, scope: PanelScope, onChange: () => void): Unsubscribe {
      if (ref.source === WORKSPACE_DOCUMENTS_SOURCE) {
        return documentAdapter.subscribe!(ref, scope, onChange);
      }
      if (base.subscribe !== undefined) {
        return base.subscribe(ref, scope, onChange);
      }
      return () => {};
    },
  };
}
