import { describe, it, expect, beforeEach } from 'vitest';
import { defaultWhiteboardPanelSize } from '../../src/engines/tldraw/context/contextFramePanelLayout';
import { applyCareerWhiteboardLayoutHints } from '../../packages/career-pack/src/whiteboard/careerWhiteboardLayoutHints';
import { resetWhiteboardLayoutHints } from '../../src/engines/tldraw/layout/whiteboardLayoutConfig';

function makeViewportEditor(viewport: { x: number; y: number; w: number; h: number }) {
  return {
    getViewportPageBounds: () => viewport,
  };
}

describe('defaultWhiteboardPanelSize', () => {
  beforeEach(() => {
    resetWhiteboardLayoutHints();
    applyCareerWhiteboardLayoutHints();
  });

  it('sizes list panels to usable desktop width on a 1200x800 viewport', () => {
    const editor = makeViewportEditor({ x: 0, y: 0, w: 1200, h: 800 });
    const size = defaultWhiteboardPanelSize(editor as never, 'open-positions');

    expect(size.w).toBeGreaterThanOrEqual(420);
    expect(size.w).toBeLessThanOrEqual(560);
    expect(size.h).toBeGreaterThanOrEqual(480);
    expect(size.h).toBeLessThanOrEqual(680);
  });

  it('sizes chat narrower than list panels on the same viewport', () => {
    const editor = makeViewportEditor({ x: 0, y: 0, w: 1200, h: 800 });
    const chat = defaultWhiteboardPanelSize(editor as never, 'chat');
    const list = defaultWhiteboardPanelSize(editor as never, 'open-positions');

    expect(chat.w).toBeLessThan(list.w);
    expect(chat.h).toBeGreaterThanOrEqual(480);
  });

  it('scales down on smaller viewports', () => {
    const large = makeViewportEditor({ x: 0, y: 0, w: 1200, h: 800 });
    const small = makeViewportEditor({ x: 0, y: 0, w: 640, h: 480 });

    const largeSize = defaultWhiteboardPanelSize(large as never, 'resources');
    const smallSize = defaultWhiteboardPanelSize(small as never, 'resources');

    expect(smallSize.w).toBeLessThan(largeSize.w);
    expect(smallSize.h).toBeLessThan(largeSize.h);
  });
});