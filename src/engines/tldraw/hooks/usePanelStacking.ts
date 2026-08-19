import { useEffect } from 'react';
import type { Editor, TLShapeId } from 'tldraw';

function panelShapeIds(editor: Editor, shapeIds: readonly TLShapeId[]): TLShapeId[] {
  return shapeIds.filter((id) => editor.getShape(id)?.type === 'panel');
}

function sameShapeIdList(a: readonly TLShapeId[], b: readonly TLShapeId[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
}

/**
 * When the user selects a panel shape, raise it above sibling panels so
 * visual focus (selection ring) matches paint order.
 */
export function usePanelStacking(editor: Editor | null): void {
  useEffect(() => {
    if (!editor) return;

    const unsubscribe = editor.store.listen(
      (entry) => {
        for (const [prev, next] of Object.values(entry.changes.updated)) {
          if (prev.typeName !== 'instance_page_state' || next.typeName !== 'instance_page_state') {
            continue;
          }

          const prevIds = prev.selectedShapeIds;
          const nextIds = next.selectedShapeIds;
          if (sameShapeIdList(prevIds, nextIds)) continue;

          const nextPanels = panelShapeIds(editor, nextIds);
          if (nextPanels.length === 0) continue;

          const prevPanelSet = new Set(panelShapeIds(editor, prevIds));
          const newlySelected = nextPanels.filter((id) => !prevPanelSet.has(id));
          const toFront = newlySelected.length > 0 ? newlySelected: nextPanels;
          editor.bringToFront(toFront);
        }
      },
      { source: 'user', scope: 'document' });

    return unsubscribe;
  }, [editor]);
}
