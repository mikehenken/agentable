/**
 * automated checks: workspace.documents localStorage persistence 
 * and SpecRenderer save round-trip through DocumentView FormBus wiring.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPersistedDocumentsForTests,
  createPersistedDocumentStore,
  documentPersistenceStorageKeyForTests,
  withDocumentSource,
  WORKSPACE_DOCUMENTS_SOURCE,
  type DocumentPayload,
} from '../../src/panels/document';
import type { DocumentEditorApi } from '../../src/panels/document/DocumentView';
import { createDataLifecycle, SpecRenderer } from '../../src/panels/renderer';
import type { DataLifecycle } from '../../src/panels/renderer';
import type { PanelScope } from '../../src/panels/types';
import { defaultCatalog, validateSpec } from '../../src/panels/spec';
import type { NormalizedPanelSpec } from '../../src/panels/spec';
import {
  createDocumentPanelDefinition,
  DOCUMENT_PANEL_ID,
} from '../../src/agents/panels/documentPanel';

const SCOPE: PanelScope = { contextId: 'workspace', entityId: 'doc-persist' };
const PERSISTENCE_KEY = 'p12-t3-unit';

function seedDocument(): DocumentPayload {
  return {
    documentId: SCOPE.entityId,
    title: 'Persist me',
    blocks: [{ id: 'h1', type: 'heading', level: 1, text: 'Initial' }],
  };
}

function documentPanelSpec(
  extraDocumentProps: Record<string, unknown> = {}): NormalizedPanelSpec {
  const definition = createDocumentPanelDefinition();
  if (definition.kind !== 'spec') {
    throw new Error('expected spec panel definition');
  }
  const spec = structuredClone(definition.spec);
  const documentNode = spec.nodes.document;
  if (documentNode === undefined || documentNode.type !== 'document-view') {
    throw new Error('document panel spec missing document-view node');
  }
  documentNode.props = {...(documentNode.props ?? {}),...extraDocumentProps,
  };
  const result = validateSpec(spec, {
    catalog: defaultCatalog,
    adapterSources: new Set([WORKSPACE_DOCUMENTS_SOURCE]),
    hostActions: new Set(),
    panelRegistry: new Set([DOCUMENT_PANEL_ID]),
  });
  if (!result.ok) {
    throw new Error(`document panel spec failed validation: ${JSON.stringify(result.errors)}`);
  }
  return result.spec;
}

function documentPanelSpecWithEditorReady(
  onEditorReady: (api: DocumentEditorApi) => void): NormalizedPanelSpec {
  const spec = documentPanelSpec;
  const documentNode = spec().nodes.document;
  if (documentNode !== undefined) {
    documentNode.props = {...(documentNode.props ?? {}),
      onEditorReady,
    };
  }
  return spec;
}

function makePersistedLifecycle(): DataLifecycle {
  const store = createPersistedDocumentStore({
    persistenceKey: PERSISTENCE_KEY,
    seed: { [SCOPE.entityId]: seedDocument },
  });
  return createDataLifecycle({ adapter: withDocumentSource(store), retryBackoffMs: 5 });
}

describe('createPersistedDocumentStore ', () => {
  beforeEach(() => {
    localStorage.clear();
    clearPersistedDocumentsForTests(PERSISTENCE_KEY);
  });

  it('persists mutate payloads to localStorage', async () => {
    const store = createPersistedDocumentStore({
      persistenceKey: PERSISTENCE_KEY,
      seed: { [SCOPE.entityId]: seedDocument },
    });
    const adapter = withDocumentSource(store);

    const updated: DocumentPayload = {...seedDocument,
      blocks: [
        { id: 'h1', type: 'heading', level: 1, text: 'Saved title' },
        { id: 'p1', type: 'paragraph', runs: [{ text: 'Persisted body' }] },
      ],
    };

    const result = await adapter.mutate(
      { kind: 'mutate', source: WORKSPACE_DOCUMENTS_SOURCE, op: 'save' },
      updated,
      SCOPE);
    expect(result.ok).toBe(true);

    const raw = localStorage.getItem(documentPersistenceStorageKeyForTests(PERSISTENCE_KEY));
    expect(raw).toContain('Persisted body');

    const reloadedStore = createPersistedDocumentStore({ persistenceKey: PERSISTENCE_KEY });
    const reloaded = reloadedStore.get(SCOPE.entityId);
    expect(reloaded?.blocks).toHaveLength(2);
    expect(reloaded?.blocks[1]?.type).toBe('paragraph');
  });

  it('survives store reload (persistence round-trip)', async () => {
    const store = createPersistedDocumentStore({
      persistenceKey: PERSISTENCE_KEY,
      seed: { [SCOPE.entityId]: seedDocument },
    });
    const adapter = withDocumentSource(store);

    await adapter.mutate(
      { kind: 'mutate', source: WORKSPACE_DOCUMENTS_SOURCE, op: 'save' },
      {...seedDocument,
        title: 'Round trip',
        blocks: [{ id: 'h1', type: 'heading', level: 1, text: 'After reload' }],
      },
      SCOPE);

    const roundTripStore = createPersistedDocumentStore({ persistenceKey: PERSISTENCE_KEY });
    const payload = roundTripStore.get(SCOPE.entityId);
    expect(payload?.title).toBe('Round trip');
    expect(payload?.blocks[0]?.type).toBe('heading');
    if (payload?.blocks[0]?.type === 'heading') {
      expect(payload.blocks[0].text).toBe('After reload');
    }
  });
});

describe('document panel save integration ', () => {
  beforeEach(() => {
    localStorage.clear();
    clearPersistedDocumentsForTests(PERSISTENCE_KEY);
  });

  it('SpecRenderer save dispatches draft blocks and persists across remount', async () => {
    let editor: DocumentEditorApi | null = null;
    const lifecycle = makePersistedLifecycle();
    const view = render(
      <SpecRenderer
        spec={documentPanelSpecWithEditorReady((api) => {
          editor = api;
        })}
        scope={SCOPE}
        lifecycle={lifecycle}
      />);

    await waitFor(() => {
      expect(editor).not.toBeNull();
      expect(screen.getByTestId('doc-block-heading')).toHaveTextContent('Initial');
    });

    editor?.apply({
      op: 'insert',
      index: 1,
      block: { id: 'p-new', type: 'paragraph', runs: [{ text: 'Draft paragraph' }] },
    });

    await waitFor(() => {
      expect(screen.getByTestId('doc-block-paragraph')).toHaveTextContent('Draft paragraph');
      expect(screen.getByTestId('dirty-indicator')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('panel-action-save'));

    await waitFor(() => {
      expect(screen.queryByTestId('dirty-indicator')).not.toBeInTheDocument();
    });

    expect(
      localStorage.getItem(documentPersistenceStorageKeyForTests(PERSISTENCE_KEY))).toContain('Draft paragraph');

    view.unmount();
    lifecycle.dispose();
    const reloadedLifecycle = makePersistedLifecycle();
    render(
      <SpecRenderer spec={documentPanelSpec} scope={SCOPE} lifecycle={reloadedLifecycle} />);

    await waitFor(() => {
      expect(screen.getByTestId('doc-block-heading')).toHaveTextContent('Initial');
      expect(screen.getByTestId('doc-block-paragraph')).toHaveTextContent('Draft paragraph');
    });

    reloadedLifecycle.dispose();
  });
});
