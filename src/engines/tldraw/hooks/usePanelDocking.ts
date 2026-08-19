import { useEffect, useRef } from 'react';
import type { Editor, TLEventInfo, TLShapeId } from 'tldraw';
import {
  collectContextGroupFrameIdsFromStoreDiff,
  collectPanelShapeIdsFromStoreDiff,
  findContextFrameGroupForShape,
} from '../context/contextGroupApi';
import {
  applyPanelDock,
  cascadeDockedPanelsInFrame,
  isReflowInProgress,
  previewPanelDockHighlight,
  reflowContextFrameRow,
  hitTestPanelDock,
} from '../context/panelDockEngine';
import { setPanelDockPreview } from './panelDockUiState';

/**
 * Wire panel docking on pointer-up and cascade docked siblings on resize.
 * Shows edge highlight zones during drag when within ~12px of a dock target.
 */
export function usePanelDocking(editor: Editor | null): void {
  const resizingPanelRef = useRef<TLShapeId | null>(null);

  useEffect(() => {
    if (!editor) return;

    const handlePointerMove = (): void => {
      if (!editor.isIn('select.translating')) {
        setPanelDockPreview(null);
        return;
      }

      const selectedIds = editor.getSelectedShapeIds;
      const panelIds = selectedIds().filter((id) => editor.getShape(id)?.type === 'panel');
      if (panelIds.length !== 1) {
        setPanelDockPreview(null);
        return;
      }

      const panelId = panelIds[0];
      const pagePoint = editor.inputs.currentPagePoint;
      if (!pagePoint) return;

      const preview = previewPanelDockHighlight(editor, panelId, pagePoint);
      setPanelDockPreview(preview ? { highlight: preview.highlight }: null);
    };

    const handlePointerUp = (): void => {
      setPanelDockPreview(null);
      if (!editor.isIn('select.translating')) return;

      const selectedIds = editor.getSelectedShapeIds;
      const panelIds = selectedIds().filter((id) => editor.getShape(id)?.type === 'panel');
      if (panelIds.length !== 1) return;

      const panelId = panelIds[0];
      const pagePoint = editor.inputs.currentPagePoint;
      if (!pagePoint) return;

      const dock = hitTestPanelDock(editor, panelId, pagePoint);
      if (dock) {
        applyPanelDock(editor, panelId, dock);
        const ctx = findContextFrameGroupForShape(editor, panelId);
        if (ctx) {
          cascadeDockedPanelsInFrame(editor, ctx.frameId);
        }
      }
    };

    const unsubscribeStore = editor.store.listen(
      (entry) => {
         // Ignore our own reflow writes to avoid redundant re-entrant work.
        if (isReflowInProgress()) return;

         // GROUP/frame resize → reflow docked panels + centered preview so they
         // track the new inner bounds (chat/files stay flush + full-height, and
         // the preview keeps symmetric gutters). Fires live during the resize
         // drag; the reflow settles at a fixed point so it can't fight auto-fit.
        const frameIds = collectContextGroupFrameIdsFromStoreDiff(entry.changes);
        for (const frameId of frameIds) {
          reflowContextFrameRow(editor, frameId);
        }

        const panelIds = collectPanelShapeIdsFromStoreDiff(entry.changes);
        if (panelIds.length === 0) return;

        const resizing = editor.isIn('select.resizing');
        if (resizing && panelIds.length === 1) {
          resizingPanelRef.current = panelIds[0];
        }

        if (!resizing && resizingPanelRef.current) {
          const resizedId = resizingPanelRef.current;
          resizingPanelRef.current = null;
          const ctx = findContextFrameGroupForShape(editor, resizedId);
          if (ctx) {
             // Reflow (not just cascade) so resizing one panel re-centers the
             // preview and keeps the equal-gutter row intact.
            reflowContextFrameRow(editor, ctx.frameId);
          }
        }
      },
      { source: 'user', scope: 'document' });

    const onEditorEvent = (info: TLEventInfo): void => {
      if (info.name === 'pointer_move') {
        handlePointerMove();
      }
      if (info.name === 'pointer_up') {
        handlePointerUp();
      }
    };

    editor.on('event', onEditorEvent);

    return () => {
      unsubscribeStore();
      editor.off('event', onEditorEvent);
      resizingPanelRef.current = null;
      setPanelDockPreview(null);
    };
  }, [editor]);
}
