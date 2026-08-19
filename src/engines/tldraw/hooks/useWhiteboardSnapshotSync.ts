import { useEffect, useRef } from 'react';
import type { Editor } from 'tldraw';
import { emitAgUiStatePatch } from '../../../protocol/ag-ui';
import {
  CANVAS_RESTORE_SNAPSHOT_EVENTS,
  type CanvasRestoreSnapshotEventDetail,
} from '../snapshot/canvasSnapshotEvents';
import { loadWhiteboardSnapshot } from '../shapes/panelShapeApi';

const SNAPSHOT_DEBOUNCE_MS = 1200;

/**
 * Debounced tldraw → AG-UI `/snapshot` patches for host persistence bridges.
 * Listens for canonical and legacy restore-snapshot events (A16).
 */
export function useWhiteboardSnapshotSync(editor: Editor | null): void {
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!editor) return;

    const flushSnapshot = (): void => {
      const snapshot = editor.getSnapshot;
      emitAgUiStatePatch(
        [{ op: 'replace', path: '/snapshot', value: snapshot }],
        { source: 'host' });
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

    for (const eventName of CANVAS_RESTORE_SNAPSHOT_EVENTS) {
      window.addEventListener(eventName, handleRestore);
    }

    return () => {
      unsubscribeStore();
      for (const eventName of CANVAS_RESTORE_SNAPSHOT_EVENTS) {
        window.removeEventListener(eventName, handleRestore);
      }
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [editor]);
}
