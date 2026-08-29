/**
 * automated checks: document panel states, block ops undo/redo,
 * block list virtualization.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyBlockOp,
  createDocumentPanelDefinition,
  createDocumentUndoStack,
  createInMemoryDocumentStore,
  DOCUMENT_PANEL_ID,
  resetDocumentBlockIdCounterForTests,
  sanitizePlainText,
  withDocumentSource,
  WORKSPACE_DOCUMENTS_SOURCE,
  type DocBlock,
  type DocumentPayload,
} from '../../src/agents';
import { validateSpec, defaultCatalog } from '../../src/panels/spec';
import type { NormalizedPanelSpec } from '../../src/panels/spec';
import { createDataLifecycle, SpecRenderer } from '../../src/panels/renderer';
import type { DataLifecycle } from '../../src/panels/renderer';
import type { PanelScope } from '../../src/panels/types';
import {
  DEFAULT_OVERSCAN_ROWS,
  DEFAULT_VIEWPORT_HEIGHT_PX,
  LIST_VIRTUALIZATION_THRESHOLD,
  maxWindowRowCount,
} from '../../src/panels/catalog/virtualization';
import { DOCUMENT_BLOCK_ROW_HEIGHT_PX } from '../../src/panels/document/types';
import { DocumentView } from '../../src/panels/document/DocumentView';
import type { SpecNodeContextValue } from '../../src/panels/types';

const SCOPE: PanelScope = { contextId: 'workspace', entityId: 'doc-seed' };

const WINDOW_BLOCK_BOUND = maxWindowRowCount(
  DEFAULT_VIEWPORT_HEIGHT_PX,
  DOCUMENT_BLOCK_ROW_HEIGHT_PX,
  DEFAULT_OVERSCAN_ROWS);

function seedDocument(blockCount: number): DocumentPayload {
  const blocks: DocBlock[] = [];
  for (let index = 0; index < blockCount; index += 1) {
    blocks.push({
      id: `block-${index}`,
      type: 'heading',
      level: 2,
      text: `Section ${index}`,
    });
  }
  return {
    documentId: SCOPE.entityId,
    title: 'Seed document',
    blocks,
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

interface MountedDocumentPanel {
  lifecycle: DataLifecycle;
  unmount: () => void;
}

async function mountDocumentPanel(
  blockCount: number,
  extraDocumentProps: Record<string, unknown> = {}): Promise<MountedDocumentPanel> {
  const store = createInMemoryDocumentStore({
    [SCOPE.entityId]: seedDocument(blockCount),
  });
  const adapter = withDocumentSource(store);
  const lifecycle = createDataLifecycle({ adapter, retryBackoffMs: 5 });
  const view = render(
    <SpecRenderer
      spec={documentPanelSpec(extraDocumentProps)}
      scope={SCOPE}
      lifecycle={lifecycle}
    />);

  await waitFor(() => {
    expect(screen.getByTestId('document-view')).toBeInTheDocument();
    expect(screen.getByTestId('document-block-viewport')).toBeInTheDocument();
  });

  return {
    lifecycle,
    unmount: () => {
      view.unmount();
      lifecycle.dispose();
    },
  };
}

function populatedContext(blocks: DocBlock[]): SpecNodeContextValue {
  const payload: DocumentPayload = {
    documentId: 'doc-1',
    title: 'Inline',
    blocks,
  };
  return {
    state: 'populated',
    data: { document: payload },
    dispatch: () => {},
    setDirty: () => {},
    isDirty: false,
  };
}

describe('document panel definition ', () => {
  it('compiles a Tier 2 spec panel bound to workspace.documents', () => {
    const definition = createDocumentPanelDefinition();
    expect(definition.kind).toBe('spec');
    expect(definition.id).toBe(DOCUMENT_PANEL_ID);
    expect(definition.spec.sources?.document?.source).toBe(WORKSPACE_DOCUMENTS_SOURCE);
    expect(definition.spec.nodes.document?.type).toBe('document-view');
  });
});

describe('document block ops undo/redo ', () => {
  beforeEach(() => {
    resetDocumentBlockIdCounterForTests(0);
  });

  it('insert, replace, move, and remove via applyBlockOp', () => {
    const initial: DocBlock[] = [
      { id: 'a', type: 'heading', level: 1, text: 'Title' },
      { id: 'b', type: 'paragraph', runs: [{ text: 'Body' }] },
    ];

    let blocks = applyBlockOp(initial, {
      op: 'insert',
      index: 1,
      block: { type: 'callout', tone: 'info', runs: [{ text: 'Note' }] },
    });
    expect(blocks).toHaveLength(3);
    expect(blocks[1]?.type).toBe('callout');

    blocks = applyBlockOp(blocks, {
      op: 'replace',
      blockId: 'b',
      block: { type: 'paragraph', runs: [{ text: 'Updated body', bold: true }] },
    });
    expect(blocks.find((block) => block.id === 'b')?.type).toBe('paragraph');

    blocks = applyBlockOp(blocks, { op: 'move', blockId: 'a', toIndex: 2 });
    expect(blocks[2]?.id).toBe('a');

    blocks = applyBlockOp(blocks, { op: 'remove', blockId: blocks[1]?.id ?? '' });
    expect(blocks.some((block) => block.id === 'b')).toBe(false);
  });

  it('stack undo/redo restores prior block snapshots', () => {
    const stack = createDocumentUndoStack([
      { id: 'h1', type: 'heading', level: 1, text: 'Draft' },
    ]);

    stack.apply({
      op: 'insert',
      index: 1,
      block: { id: 'p1', type: 'paragraph', runs: [{ text: 'First' }] },
    });
    stack.apply({
      op: 'insert',
      index: 2,
      block: { id: 'p2', type: 'paragraph', runs: [{ text: 'Second' }] },
    });
    expect(stack.blocks).toHaveLength(3);

    expect(stack.canUndo).toBe(true);
    const undoneOnce = stack.undo;
    expect(undoneOnce).toHaveLength(2);

    const undoneTwice = stack.undo;
    expect(undoneTwice).toHaveLength(1);

    expect(stack.canRedo).toBe(true);
    const redone = stack.redo;
    expect(redone).toHaveLength(2);
  });
});

describe('document sanitization (G4)', () => {
  it('strips HTML-shaped strings from text runs', () => {
    expect(sanitizePlainText('<script>alert(1)</script>Hello')).toBe('alert(1)Hello');
  });
});

describe('DocumentView component states', () => {
  it('renders loading, error, and empty lifecycle states', () => {
    const loading: SpecNodeContextValue = {
      state: 'loading',
      data: {},
      dispatch: () => {},
      setDirty: () => {},
      isDirty: false,
    };
    const { rerender } = render(
      <DocumentView bind="document" context={loading} />);
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();

    rerender(
      <DocumentView
        bind="document"
        context={{...loading, state: 'error' }}
      />);
    expect(screen.getByTestId('error-card')).toBeInTheDocument();

    rerender(
      <DocumentView
        bind="document"
        context={{...loading, state: 'empty' }}
      />);
    expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
  });

  it('renders populated document blocks', () => {
    render(
      <DocumentView
        bind="document"
        context={populatedContext([
          { id: 'h', type: 'heading', level: 1, text: 'Hello' },
          { id: 'p', type: 'paragraph', runs: [{ text: 'World' }] },
        ])}
      />);
    expect(screen.getByTestId('populated-content')).toBeInTheDocument();
    expect(screen.getByTestId('doc-block-heading')).toHaveTextContent('Hello');
    expect(screen.getByTestId('doc-block-paragraph')).toHaveTextContent('World');
  });
});

describe('document block list virtualization ', () => {
  it('virtualizes above the row threshold', async () => {
    const aboveThreshold = LIST_VIRTUALIZATION_THRESHOLD + 1;
    const mounted = await mountDocumentPanel(aboveThreshold);
    const viewport = screen.getByTestId('document-block-viewport');
    expect(viewport.dataset.virtualized).toBe('true');

    const rows = viewport.querySelectorAll('[data-row-key]');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(WINDOW_BLOCK_BOUND);
    const firstBlock = rows[0]?.querySelector('[aria-setsize]');
    expect(firstBlock?.getAttribute('aria-setsize')).toBe(String(aboveThreshold));

    mounted.unmount();
  });

  it('does not virtualize at or below the threshold', async () => {
    const mounted = await mountDocumentPanel(LIST_VIRTUALIZATION_THRESHOLD);
    const viewport = screen.getByTestId('document-block-viewport');
    expect(viewport.dataset.virtualized).toBe('false');
    expect(viewport.querySelectorAll('[data-row-key]')).toHaveLength(
      LIST_VIRTUALIZATION_THRESHOLD);
    mounted.unmount();
  });

  it('raises threshold above block count to prove virtualization is required', async () => {
    const blockCount = LIST_VIRTUALIZATION_THRESHOLD + 10;
    const mounted = await mountDocumentPanel(blockCount, {
      virtualizeThreshold: blockCount + 50,
    });
    const viewport = screen.getByTestId('document-block-viewport');
    expect(viewport.dataset.virtualized).toBe('false');
    expect(viewport.querySelectorAll('[data-row-key]')).toHaveLength(blockCount);
    mounted.unmount();
  });
});

describe('DocumentView undo/redo controls', () => {
  it('exposes undo/redo after local block ops through the editor stack', async () => {
    let editor: import('../../src/panels/document/DocumentView').DocumentEditorApi | null = null;

    render(
      <DocumentView
        bind="document"
        onEditorReady={(api) => {
          editor = api;
        }}
        context={populatedContext([
          { id: 'only', type: 'heading', level: 1, text: 'Start' },
        ])}
      />);

    await waitFor(() => {
      expect(editor).not.toBeNull();
    });

    editor?.apply({
      op: 'insert',
      index: 1,
      block: { id: 'added', type: 'paragraph', runs: [{ text: 'Added' }] },
    });

    await waitFor(() => {
      expect(screen.getByTestId('doc-block-paragraph')).toBeInTheDocument();
    });

    const undoButton = screen.getByTestId('document-undo');
    expect(undoButton).not.toBeDisabled();
    fireEvent.click(undoButton);
    expect(screen.queryByTestId('doc-block-paragraph')).not.toBeInTheDocument();
  });
});
