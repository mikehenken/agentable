/**
 * Runtime bridge for digest shape slices. Binds when the tldraw
 * editor mounts (relocated from src/agents/ during the P11 pre-gate
 * cleanup): the agent layer must stay engine-agnostic, so the
 * editor-coupled collector binding lives here and the agent runtime reads
 * the live slice through `src/agents/engineBridge.ts`'s
 * `getEngineDigestShapeSlice()` instead.
 */
import type { Editor } from 'tldraw';
import { collectDigestShapeSummaries } from './digestShapeCollector';
import type { Rect } from '../../../engine/types';
import type { DigestShapeSlice } from '../../../agents/engineBridge';
import { cloneDigestShapeSummaries } from '../../../agents/digestShapes';

let boundEditor: Editor | null = null;
let changeBatchCounter = 0;
let changeBatchId = 'digest-shapes:0';
let storeUnsubscribe: (() => void) | null = null;
let viewportResolver: (() => Rect | null) | null = null;

function bumpChangeBatch(): void {
  changeBatchCounter += 1;
  changeBatchId = `digest-shapes:${changeBatchCounter}`;
}

function resolveViewport(): Rect | null {
  if (viewportResolver !== null) {
    return viewportResolver();
  }
  if (boundEditor === null) return null;
  if (typeof boundEditor.getViewportPageBounds !== 'function') {
    return null;
  }
  const bounds = boundEditor.getViewportPageBounds();
  return {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
  };
}

/** Bind the collector to a mounted tldraw editor. Returns an unbind function. */
export function bindDigestShapeCollector(
  editor: Editor,
  options?: { resolveViewport?: () => Rect | null },
): () => void {
  storeUnsubscribe?.();
  boundEditor = editor;
  viewportResolver = options?.resolveViewport ?? null;
  bumpChangeBatch();
  storeUnsubscribe = editor.store.listen(
    () => {
      bumpChangeBatch();
    },
    { source: 'all', scope: 'document' },
  );
  return () => {
    if (boundEditor !== editor) return;
    storeUnsubscribe?.();
    storeUnsubscribe = null;
    boundEditor = null;
    viewportResolver = null;
  };
}

/** Current digest shape slice from the bound editor, or null when unbound. */
export function getDigestShapeSlice(): DigestShapeSlice | null {
  if (boundEditor === null) return null;
  const shapes = collectDigestShapeSummaries(boundEditor, {
    viewport: resolveViewport(),
  });
  return {
    shapes: cloneDigestShapeSummaries(shapes),
    changeBatchId,
  };
}

export function isDigestShapeCollectorBound(): boolean {
  return boundEditor !== null;
}

export function resetDigestShapeBridgeForTests(): void {
  storeUnsubscribe?.();
  storeUnsubscribe = null;
  boundEditor = null;
  viewportResolver = null;
  changeBatchCounter = 0;
  changeBatchId = 'digest-shapes:0';
}
