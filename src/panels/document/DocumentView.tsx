/**
 * DocumentView catalog composite: block model renderer with
 * pre-save undo stack and block-list virtualization.
 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { SpecNodeContextValue } from '../types';
import { useOptionalFormRuntime } from '../catalog/formRuntime';
import {
  computeVirtualWindow,
  DEFAULT_OVERSCAN_ROWS,
  DEFAULT_VIEWPORT_HEIGHT_PX,
  LIST_VIRTUALIZATION_THRESHOLD,
  shouldVirtualize,
} from '../catalog/virtualization';
import { createDocumentUndoStack, type DocumentUndoStack } from './documentUndoStack';
import { BlockRenderer } from './renderBlock';
import { DOCUMENT_BLOCK_ROW_HEIGHT_PX } from './types';
import { extractDocumentBlockRows } from './virtualBlockList';
import { isDocumentPayload } from './validate';
import type { DocBlock, BlockOp, DocumentPayload } from './types';

interface CatalogComponentProps {
  context?: SpecNodeContextValue;
}

export interface DocumentEditorApi {
  apply(op: BlockOp): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  readonly blocks: readonly DocBlock[];
}

export interface DocumentViewProps extends CatalogComponentProps {
  bind?: string;
 /** Per-instance threshold override. */
  virtualizeThreshold?: number;
 /** Optional hook for patch_panel / tests to drive the pre-save stack. */
  onEditorReady?: (api: DocumentEditorApi) => void;
}

function renderState(
  state: SpecNodeContextValue['state'] | undefined,
  children: React.ReactNode,
): React.ReactNode {
  if (state === 'loading') {
    return <div data-testid="loading-skeleton">Loading...</div>;
  }
  if (state === 'error') {
    return <div data-testid="error-card">Error loading data</div>;
  }
  if (state === 'empty') {
    return <div data-testid="empty-placeholder">No data available</div>;
  }

  return (
    <>
      <span data-testid="populated-content">{children}</span>
      {state === 'dirty' ? <span data-testid="dirty-indicator">Unsaved changes</span> : null}
      {state === 'saving' ? <span data-testid="saving-spinner">Saving...</span> : null}
      {state === 'stale' ? <span data-testid="stale-banner-inline">Data is stale</span> : null}
    </>
  );
}

interface VirtualBlockViewportProps {
  blocks: readonly DocBlock[];
  threshold: number;
}

function VirtualBlockViewport(props: VirtualBlockViewportProps): React.ReactElement {
  const { blocks, threshold } = props;
  const [scrollTop, setScrollTop] = useState(0);
  const virtualized = shouldVirtualize(blocks.length, threshold);
  const rows = useMemo(() => extractDocumentBlockRows(blocks), [blocks]);

  if (!virtualized) {
    return (
      <div
        data-testid="document-block-viewport"
        part="viewport"
        role="list"
        data-virtualized="false"
      >
        {rows.map((row, index) => (
          <div
            key={row.key}
            data-row-key={row.key}
            style={{ minHeight: DOCUMENT_BLOCK_ROW_HEIGHT_PX }}
          >
            <BlockRenderer block={row.block} position={index + 1} setSize={rows.length} />
          </div>
        ))}
      </div>
    );
  }

  const window = computeVirtualWindow({
    scrollTop,
    viewportHeightPx: DEFAULT_VIEWPORT_HEIGHT_PX,
    rowHeightPx: DOCUMENT_BLOCK_ROW_HEIGHT_PX,
    itemCount: rows.length,
    overscanRows: DEFAULT_OVERSCAN_ROWS,
  });

  const visible = rows.slice(window.start, window.end);

  return (
    <div
      data-testid="document-block-viewport"
      part="viewport"
      role="list"
      data-virtualized="true"
      data-window-start={window.start}
      data-window-end={window.end}
      style={{
        height: DEFAULT_VIEWPORT_HEIGHT_PX,
        overflowY: 'auto',
      }}
      onScroll={(event) => {
        setScrollTop(event.currentTarget.scrollTop);
      }}
    >
      <div
        style={{
          paddingTop: window.padTopPx,
          paddingBottom: window.padBottomPx,
        }}
      >
        {visible.map((row, index) => (
          <div
            key={row.key}
            data-row-key={row.key}
            style={{ height: DOCUMENT_BLOCK_ROW_HEIGHT_PX, overflow: 'hidden' }}
          >
            <BlockRenderer
              block={row.block}
              position={window.start + index + 1}
              setSize={rows.length}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export const DocumentView = (props: DocumentViewProps): React.ReactElement => {
  const { bind, context, virtualizeThreshold, onEditorReady } = props;
  const formRuntime = useOptionalFormRuntime();
  const ownerId = useId();
  const bound = bind !== undefined ? context?.data[bind] : undefined;
  const payload = isDocumentPayload(bound) ? bound : null;
  const serverBlocks = useMemo(
    () => payload?.blocks ?? [],
    [payload?.blocks],
  );

  const stackRef = useRef<DocumentUndoStack | null>(null);
  if (stackRef.current === null) {
    stackRef.current = createDocumentUndoStack([]);
  }

  const stack = stackRef.current;
  const serverKey = useMemo(
    () => JSON.stringify(serverBlocks.map((block) => block.id)),
    [serverBlocks],
  );

  const latestRef = useRef({ context, payload, stack });
  latestRef.current = { context, payload, stack };

  const submitDocument = useCallback((actionRef: string) => {
    const current = latestRef.current;
    if (current.context === undefined || current.payload === null) {
      return;
    }
    const documentPayload: DocumentPayload = {
      documentId: current.payload.documentId,
      title: current.payload.title,
      blocks: [...current.stack.blocks],
      version: current.payload.version,
    };
    current.context.dispatch(actionRef, documentPayload as unknown as Record<string, unknown>);
  }, []);

  const fillDocument = useCallback((patch: Record<string, unknown>) => {
    void patch;
    latestRef.current.context?.setDirty(true);
  }, []);

  useEffect(() => {
    if (
      formRuntime === null ||
      bind === undefined ||
      context === undefined ||
      payload === null
    ) {
      return undefined;
    }
    const source = formRuntime.sources?.[bind]?.source;
    if (source === undefined) {
      return undefined;
    }
    return formRuntime.formBus.register(ownerId, {
      source,
      submit: submitDocument,
      fill: fillDocument,
    });
  }, [formRuntime, bind, context, payload, ownerId, submitDocument, fillDocument]);

  const [draftRevision, setDraftRevision] = useState(0);

  // serverKey encodes block-id snapshot; omit serverBlocks to avoid reset loops.
  useEffect(() => {
    stack.reset(serverBlocks);
    setDraftRevision((value) => value + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- serverKey encodes block-id snapshot
  }, [serverKey, stack]);

  const threshold = virtualizeThreshold ?? LIST_VIRTUALIZATION_THRESHOLD;
  const blocks = stack.blocks;
  void draftRevision;

  const applyLocalBlocks = useCallback(
    (next: readonly DocBlock[]) => {
      context?.setDirty(true);
      setDraftRevision((value) => value + 1);
      void next;
    },
    [context],
  );

  const editorApi = useMemo((): DocumentEditorApi => {
    return {
      get blocks(): readonly DocBlock[] {
        return stack.blocks;
      },
      apply(op: BlockOp): void {
        const next = stack.apply(op);
        applyLocalBlocks(next);
      },
      undo(): void {
        const next = stack.undo();
        if (next !== null) applyLocalBlocks(next);
      },
      redo(): void {
        const next = stack.redo();
        if (next !== null) applyLocalBlocks(next);
      },
      canUndo(): boolean {
        return stack.canUndo();
      },
      canRedo(): boolean {
        return stack.canRedo();
      },
    };
  }, [stack, applyLocalBlocks]);

  useEffect(() => {
    onEditorReady?.(editorApi);
  }, [editorApi, onEditorReady, draftRevision]);

  if (
    payload === null ||
    context?.state === 'loading' ||
    context?.state === 'error' ||
    context?.state === 'empty'
  ) {
    return (
      <article data-testid="document-view">
        {renderState(context?.state, bind)}
      </article>
    );
  }

  const documentBody =
    blocks.length === 0 ? (
      <div data-testid="document-empty-blocks">Empty document</div>
    ) : (
      <VirtualBlockViewport blocks={blocks} threshold={threshold} />
    );

  return (
    <article
      data-testid="document-view"
      data-document-editor-host
      data-document-id={payload.documentId}
      data-can-undo={stack.canUndo()}
      data-can-redo={stack.canRedo()}
    >
      <header data-testid="document-title">{payload.title}</header>
      {renderState(context?.state ?? 'populated', documentBody)}
      <div data-testid="document-editor-controls" hidden>
        <button
          type="button"
          data-testid="document-undo"
          disabled={!stack.canUndo()}
          onClick={() => {
            editorApi.undo();
          }}
        >
          Undo
        </button>
        <button
          type="button"
          data-testid="document-redo"
          disabled={!stack.canRedo()}
          onClick={() => {
            editorApi.redo();
          }}
        >
          Redo
        </button>
      </div>
    </article>
  );
};
