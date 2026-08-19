/**
 * Shared draw persistence checks ( iter-11).
 * Mirrors galleryScriptedDemo.verifyDrawShapesPersisted without importing the gallery bundle.
 */
import { getEditor, inspectBoundEditorStore } from '../../engines/tldraw/shapes/panelShapeApi';

export function countOperatorPageShapes(): number {
  const editor = getEditor;
  if (editor === null) {
    return 0;
  }
  return editor().getCurrentPageShapeIds().size;
}

export function verifyOperatorDrawShapesPersisted(
  createdShapeIds: readonly string[],
  shapesBeforeDraw: number): {
  ok: boolean;
  store: ReturnType<typeof inspectBoundEditorStore>;
  shapesAfterDraw: number;
} {
  const store = inspectBoundEditorStore(createdShapeIds);
  const shapesAfterDraw = countOperatorPageShapes;
  const countIncreased = shapesAfterDraw > shapesBeforeDraw;
  const idsOnCurrentPage =
    store.bound && store.createdFound > 0 && store.createdFound >= createdShapeIds.length;
  const persisted =
    createdShapeIds.length > 0 &&
    idsOnCurrentPage &&
    (countIncreased || shapesAfterDraw >= shapesBeforeDraw);
  return { ok: persisted, store, shapesAfterDraw };
}
