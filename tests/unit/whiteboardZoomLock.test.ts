import { describe, expect, it, vi } from 'vitest';
import {
  WHITEBOARD_UI_ZOOM_STEPS,
  applyCanvasModeToEditor,
} from '../../src/engines/tldraw/engine';

describe('applyCanvasModeToEditor zoom lock semantics', () => {
  it('keeps UI zoom steps when wheel zoom is locked', () => {
    const setCameraOptions = vi.fn();
    const editor = {
      getZoomLevel: () => 1,
      setCameraOptions,
    };

    applyCanvasModeToEditor(editor as never, {
      kind: 'bounded',
      bounds: { w: 1200, h: 800 },
      zoom: 'locked',
    });

    expect(setCameraOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        wheelBehavior: 'pan',
        zoomSteps: [...WHITEBOARD_UI_ZOOM_STEPS],
        isLocked: false,
      }));
  });
});
