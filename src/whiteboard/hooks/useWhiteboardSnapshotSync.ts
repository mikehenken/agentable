import { useEffect, useRef } from 'react';
import type { Editor } from 'tldraw';
import { emitAgUiStatePatch } from '../../canvas/protocol/ag-ui';
import {
  CANVAS_RESTORE_SNAPSHOT_EVENT,
  type CanvasRestoreSnapshotEventDetail,
} from '../snapshot/canvasSnapshotEvents';
import { loadWhiteboardSnapshot } from '../shapes/panelShapeApi';

const SNAPSHOT_DEBOUNCE_MS = 1200;

/**
 * Debounced tldraw → AG-UI `/snapshot` patches for host persistence bridges.
 * Also listens for `landi:canvas-restore-snapshot` to load server snapshots.
 */
export function useWhiteboardSnapshotSync(editor: Editor | null): void {
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!editor) return;

    const flushSnapshot = (): void => {
      const snapshot = editor.getSnapshot();
      emitAgUiStatePatch(
        [{ op: 'replace', path: '/snapshot', value: snapshot }],
        { source: 'host' },
      );
    };

    const scheduleSnapshot = (): void => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        flushSnapshot();
      }, SNAPSHOT_DEBOUNCE_MS);
    };

    const unsubscribeStore = editor.store.listen(scheduleSnapshot, { source: 'user', scope: 'all' });

    const handleRestore = (event: Event): void => {
      const detail = (event as CustomEvent<CanvasRestoreSnapshotEventDetail>).detail;
      if (!detail?.snapshot) return;
      loadWhiteboardSnapshot(detail.snapshot);
    };

    window.addEventListener(CANVAS_RESTORE_SNAPSHOT_EVENT, handleRestore);

    return () => {
      unsubscribeStore();
      window.removeEventListener(CANVAS_RESTORE_SNAPSHOT_EVENT, handleRestore);
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [editor]);
}
