/**
 * Regression coverage for applyCareerHomepageFirstPaint editor-method usage.
 *
 * Two real bugs lived here:
 *  1. `for (const shape of editor.getCurrentPageShapes)` iterated over the
 *     METHOD instead of its result (TypeError: not iterable at runtime).
 *  2. `const viewport = editor.getViewportPageBounds;` captured the method
 *     unbound and invoked it later as `viewport()`, losing `this`.
 *
 * The fake editor below throws on unbound invocation, so either bug
 * reintroduced makes these tests fail loudly.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Editor } from 'tldraw';

const openPanelInCanvas = vi.fn();
const repairOpenPositionsBesideChatIfStacked = vi.fn(() => false);

vi.mock('../../src/engines/tldraw/shapes/panelShapeApi', () => ({
  openPanelInCanvas: (...args: unknown[]) => openPanelInCanvas(...args),
  repairOpenPositionsBesideChatIfStacked: (...args: unknown[]) =>
    repairOpenPositionsBesideChatIfStacked(...args),
}));
vi.mock('../../src/engines/tldraw/context/contextFramePanelLayout', () => ({
  defaultWhiteboardPanelSize: vi.fn(() => ({ w: 360, h: 480 })),
}));
vi.mock('../../src/engines/tldraw/choreography/chatReserved', () => ({
  computeBesideChatPlacement: vi.fn(() => ({ x: 400, y: 0 })),
}));

import { applyCareerHomepageFirstPaint } from '../../packages/career-pack/src/whiteboard/applyCareerHomepageFirstPaint';

interface FakeShape {
  type: string;
  id: string;
  props: { panelId?: string };
}

function makeEditor(shapes: FakeShape[]) {
  const editor = {
    getCurrentPageShapes() {
      assertBound(this);
      return shapes;
    },
    getViewportPageBounds() {
      assertBound(this);
      return { x: 0, y: 0, w: 1440, h: 900 };
    },
    getViewportScreenBounds() {
      assertBound(this);
      return { x: 0, y: 0, w: 1440, h: 900 };
    },
    getShapesPageBounds() {
      assertBound(this);
      return { x: 0, y: 0, w: 800, h: 600 };
    },
    zoomToBounds: vi.fn(),
  };
  function assertBound(self: unknown) {
    if (self !== editor) {
      throw new TypeError('editor method invoked unbound (lost `this`)');
    }
  }
  return editor as unknown as Editor;
}

beforeEach(() => {
  openPanelInCanvas.mockClear();
  repairOpenPositionsBesideChatIfStacked.mockClear();
});

describe('applyCareerHomepageFirstPaint', () => {
  it('opens chat and open-positions on an empty canvas without unbound editor calls', () => {
    const editor = makeEditor([]);
    const changed = applyCareerHomepageFirstPaint(editor, { fitCamera: false });
    expect(changed).toBe(true);
    const openedIds = openPanelInCanvas.mock.calls.map((call) => call[0]);
    expect(openedIds).toEqual(['chat', 'open-positions']);
  });

  it('is idempotent when both panels already exist (iterates shapes, not the method)', () => {
    const editor = makeEditor([
      { type: 'panel', id: 'shape:a', props: { panelId: 'chat' } },
      { type: 'panel', id: 'shape:b', props: { panelId: 'open-positions' } },
    ]);
    const changed = applyCareerHomepageFirstPaint(editor, { fitCamera: false });
    expect(changed).toBe(false);
    expect(openPanelInCanvas).not.toHaveBeenCalled();
    expect(repairOpenPositionsBesideChatIfStacked).toHaveBeenCalledOnce();
  });

  it('fits the camera to panel bounds when panels were opened', () => {
    const editor = makeEditor([
      { type: 'panel', id: 'shape:a', props: { panelId: 'chat' } },
    ]);
    const changed = applyCareerHomepageFirstPaint(editor);
    expect(changed).toBe(true);
    expect((editor as unknown as { zoomToBounds: ReturnType<typeof vi.fn> }).zoomToBounds).toHaveBeenCalledOnce();
  });
});
