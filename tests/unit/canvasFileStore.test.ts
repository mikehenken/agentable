import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasFileStore } from '../../src/stores/canvasFileStore';
import { AG_UI_STATE_PATCH_EVENT, type AgUiStatePatchEventDetail } from '../../src/protocol/ag-ui';

function captureNextPatchDetail(): { read: () => AgUiStatePatchEventDetail | null; dispose: () => void } {
  let detail: AgUiStatePatchEventDetail | null = null;
  const listener = (event: Event) => {
    detail = (event as CustomEvent<AgUiStatePatchEventDetail>).detail;
  };
  window.addEventListener(AG_UI_STATE_PATCH_EVENT, listener);
  return {
    read: () => detail,
    dispose: () => window.removeEventListener(AG_UI_STATE_PATCH_EVENT, listener),
  };
}

describe('useCanvasFileStore AG-UI patch emission', () => {
  beforeEach(() => {
    useCanvasFileStore.setState({ siteId: null, files: {} });
  });

  it('writeFile emits a replace patch array (not a raw string path)', () => {
    const capture = captureNextPatchDetail();
    try {
      const entry = useCanvasFileStore.getState().writeFile('pages/index.html', '<h1>hi</h1>', 'text/html');
      const detail = capture.read();
      expect(detail).not.toBeNull();
      expect(Array.isArray(detail!.patches)).toBe(true);
      expect(detail!.patches).toEqual([
        { op: 'replace', path: '/files/pages/index.html', value: entry },
      ]);
    } finally {
      capture.dispose();
    }
  });

  it('deleteFile emits a remove patch for the normalized path', () => {
    useCanvasFileStore.getState().writeFile('a.txt', 'x');
    const capture = captureNextPatchDetail();
    try {
      const removed = useCanvasFileStore.getState().deleteFile('a.txt');
      expect(removed).toBe(true);
      expect(capture.read()!.patches).toEqual([{ op: 'remove', path: '/files/a.txt' }]);
    } finally {
      capture.dispose();
    }
  });

  it('setSiteId emits a replace patch carrying the new site id', () => {
    const capture = captureNextPatchDetail();
    try {
      useCanvasFileStore.getState().setSiteId('site-42');
      expect(capture.read()!.patches).toEqual([
        { op: 'replace', path: '/files/siteId', value: 'site-42' },
      ]);
    } finally {
      capture.dispose();
    }
  });
});
