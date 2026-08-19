/**
 * localStorage-backed `workspace.documents` store.
 * Survives reload when hosts use `createPersistedDocumentStore`.
 */
import type { DocumentPayload } from './types';
import { parseDocumentPayload } from './validate';
import type { DocumentStore } from './documentAdapter';

const STORAGE_PREFIX = 'agentable-workspace-documents:';

export interface PersistedDocumentStoreOptions {
  /** localStorage namespace; defaults to `default`. */
  persistenceKey?: string;
  /** Seed documents merged before persisted state (persisted entries win). */
  seed?: Record<string, DocumentPayload>;
}

function storageKey(persistenceKey: string): string {
  return `${STORAGE_PREFIX}${persistenceKey}`;
}

function loadPersistedDocuments(
  persistenceKey: string): Record<string, DocumentPayload> {
  if (typeof globalThis.localStorage === 'undefined') {
    return {};
  }
  try {
    const raw = globalThis.localStorage.getItem(storageKey(persistenceKey));
    if (raw === null || raw.length === 0) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, DocumentPayload> = {};
    for (const [documentId, value] of Object.entries(parsed)) {
      const payload = parseDocumentPayload(value);
      if (payload !== null) {
        out[documentId] = {...payload, documentId };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function savePersistedDocuments(
  persistenceKey: string,
  documents: Readonly<Record<string, DocumentPayload>>): void {
  if (typeof globalThis.localStorage === 'undefined') {
    return;
  }
  try {
    globalThis.localStorage.setItem(storageKey(persistenceKey), JSON.stringify(documents));
  } catch {
     // Quota or privacy mode — in-memory layer still holds mutations for the session.
  }
}

/** Clear persisted documents for a namespace (tests). */
export function clearPersistedDocumentsForTests(persistenceKey = 'default'): void {
  if (typeof globalThis.localStorage === 'undefined') {
    return;
  }
  globalThis.localStorage.removeItem(storageKey(persistenceKey));
}

/**
 * Document store with localStorage round-trip. Mutations through
 * `createDocumentDataAdapter` `withDocumentSource` persist on every `set`.
 */
export function createPersistedDocumentStore(
  options: PersistedDocumentStoreOptions = {}): DocumentStore {
  const persistenceKey = options.persistenceKey ?? 'default';
  const seed = options.seed ?? {};
  const persisted = loadPersistedDocuments(persistenceKey);
  const documents = new Map<string, DocumentPayload>(
    Object.entries({ ...seed, ...persisted }),
  );
  const listeners = new Map<string, Set<() => void>>();

  const notify = (documentId: string): void => {
    const set = listeners.get(documentId);
    if (set === undefined) {
      return;
    }
    for (const listener of set) {
      listener();
    }
  };

  const persistSnapshot = (): void => {
    const record: Record<string, DocumentPayload> = {};
    for (const [documentId, payload] of documents) {
      record[documentId] = payload;
    }
    savePersistedDocuments(persistenceKey, record);
  };

  return {
    get(documentId: string): DocumentPayload | undefined {
      return documents.get(documentId);
    },
    set(documentId: string, payload: DocumentPayload): void {
      documents.set(documentId, payload);
      persistSnapshot();
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

export { storageKey as documentPersistenceStorageKeyForTests };
