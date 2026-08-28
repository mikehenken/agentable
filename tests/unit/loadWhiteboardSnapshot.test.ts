import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  __resetPanelShapeApiForTests__,
  bindEditor,
  loadWhiteboardSnapshot,
} from '../../src/engines/tldraw/shapes/panelShapeApi';

describe('loadWhiteboardSnapshot', () => {
  beforeEach(() => {
    __resetPanelShapeApiForTests__();
  });

  it('returns false for invalid snapshot payloads', () => {
    expect(loadWhiteboardSnapshot(null)).toBe(false);
    expect(loadWhiteboardSnapshot('bad')).toBe(false);
  });

  it('queues snapshot until editor binds', () => {
    const snapshot = { document: { store: {} }, session: {} };
    expect(loadWhiteboardSnapshot(snapshot)).toBe(true);

    const loadSnapshot = vi.fn();
    // `bindEditor` schedules a post-load auto-arrange + layout repair pass
    // (requestAnimationFrame) that iterates the page; stub those readers so
    // the deferred work no-ops instead of throwing on a bare mock.
    bindEditor({ loadSnapshot, getCurrentPageShapes: () => [], getSelectedShapeIds: () => [] } as never);
    expect(loadSnapshot).toHaveBeenCalledWith(snapshot);
  });

  it('loads immediately when editor is already bound', () => {
    const loadSnapshot = vi.fn();
    bindEditor({ loadSnapshot, getCurrentPageShapes: () => [], getSelectedShapeIds: () => [] } as never);

    const snapshot = { document: { store: {} }, session: {} };
    expect(loadWhiteboardSnapshot(snapshot)).toBe(true);
    expect(loadSnapshot).toHaveBeenCalledWith(snapshot);
  });

  it('runs the deferred repair pass against the editor it loaded into', async () => {
    // Regression: the animation-frame repair used to dereference the live
    // module binding, crashing when an unbind or reset landed between the
    // load and the frame. It must use the editor captured at load time.
    const loadSnapshot = vi.fn();
    const getCurrentPageShapes = vi.fn(() => []);
    bindEditor({ loadSnapshot, getCurrentPageShapes, getSelectedShapeIds: () => [] } as never);

    expect(loadWhiteboardSnapshot({ document: { store: {} }, session: {} })).toBe(true);
    __resetPanelShapeApiForTests__();

    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    expect(getCurrentPageShapes).toHaveBeenCalled();
  });
});
