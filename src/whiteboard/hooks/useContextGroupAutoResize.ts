import { useEffect, useRef } from 'react';
import type { Editor, TLEventInfo, TLShapeId } from 'tldraw';
import {
  collectPanelShapeIdsFromStoreDiff,
  findSiteContextGroupForShape,
  fitContextGroupFrameToContent,
  ensurePanelInSiteContextFrame,
  type ContextGroupFitMode,
} from '../context/contextGroupApi';

/** Minimum ms between preview fits while dragging (throttles store-driven churn). */
const PREVIEW_FIT_INTERVAL_MS = 48;

function isPanelDragInProgress(editor: Editor): boolean {
  return editor.isIn('select.translating') || editor.isIn('select.resizing');
}

function resolveFitMode(editor: Editor, forceFinal: boolean): ContextGroupFitMode {
  if (forceFinal) return 'final';
  return isPanelDragInProgress(editor) ? 'preview' : 'final';
}

/**
 * Keep site/agency context frames fitted to their panel children while the user
 * drags or resizes panels. Preview mode uses capped incremental growth during
 * drag; pointer-up triggers a final snap fit.
 */
export function useContextGroupAutoResize(editor: Editor | null): void {
  const fittingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const pendingPanelIdsRef = useRef(new Set<TLShapeId>());
  const forceFinalFitRef = useRef(false);
  const lastPreviewFitAtRef = useRef(0);

  useEffect(() => {
    if (!editor) return;

    const pendingPanelIds = pendingPanelIdsRef.current;

    const flushPendingFits = (): void => {
      rafRef.current = null;
      if (fittingRef.current) return;

      const panelIds = [...pendingPanelIds];
      pendingPanelIds.clear();
      if (panelIds.length === 0) return;

      const forceFinal = forceFinalFitRef.current;
      forceFinalFitRef.current = false;

      const mode = resolveFitMode(editor, forceFinal);
      if (mode === 'preview') {
        const now = performance.now();
        if (now - lastPreviewFitAtRef.current < PREVIEW_FIT_INTERVAL_MS) {
          for (const id of panelIds) pendingPanelIds.add(id);
          rafRef.current = window.requestAnimationFrame(flushPendingFits);
          return;
        }
        lastPreviewFitAtRef.current = now;
      }

      fittingRef.current = true;
      try {
        const fittedFrames = new Set<TLShapeId>();
        for (const panelId of panelIds) {
          const shape = editor.getShape(panelId);
          if (!shape || shape.type !== 'panel') continue;

          const ctx = findSiteContextGroupForShape(editor, panelId);
          if (!ctx || fittedFrames.has(ctx.frameId)) continue;

          ensurePanelInSiteContextFrame(editor, panelId, ctx.frameId);
          fitContextGroupFrameToContent(editor, ctx.frameId, { mode });
          fittedFrames.add(ctx.frameId);
        }
      } finally {
        fittingRef.current = false;
      }
    };

    const scheduleFit = (panelIds: TLShapeId[], options?: { final?: boolean }): void => {
      if (panelIds.length === 0) return;
      if (options?.final) {
        forceFinalFitRef.current = true;
      }
      for (const id of panelIds) pendingPanelIds.add(id);
      if (rafRef.current === null) {
        rafRef.current = window.requestAnimationFrame(flushPendingFits);
      }
    };

    const unsubscribeStore = editor.store.listen(
      (entry) => {
        const panelIds = collectPanelShapeIdsFromStoreDiff(entry.changes);
        scheduleFit(panelIds);
      },
      { source: 'user', scope: 'document' },
    );

    const handlePointerUp = (): void => {
      const selectedIds = editor.getSelectedShapeIds();
      const panelIds = selectedIds.filter((id) => editor.getShape(id)?.type === 'panel');
      scheduleFit(panelIds, { final: true });
    };

    const onEditorEvent = (info: TLEventInfo): void => {
      if (info.name === 'pointer_up') {
        handlePointerUp();
      }
    };

    editor.on('event', onEditorEvent);

    return () => {
      unsubscribeStore();
      editor.off('event', onEditorEvent);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingPanelIds.clear();
      forceFinalFitRef.current = false;
      lastPreviewFitAtRef.current = 0;
    };
  }, [editor]);
}
