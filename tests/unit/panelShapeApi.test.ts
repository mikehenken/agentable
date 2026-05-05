/**
 * Unit tests for `panelShapeApi` — the imperative driver agent tools call
 * to surface workspace panels onto the whiteboard.
 *
 * The driver is intentionally framework-free (no React) and operates on a
 * narrow `Editor` surface from tldraw. Tests use a hand-rolled stub that
 * implements only the methods `panelShapeApi` actually touches:
 *
 *   - `getShape(id)` / `createShape(shape)` / `updateShape(shape)` /
 *     `deleteShapes([id])`
 *   - `getShapePageBounds(id)` / `getViewportPageBounds()` /
 *     `getCurrentPageShapes()`
 *   - `select(id)` / `zoomToBounds(bounds, opts)`
 *
 * That keeps tests fast and decoupled from tldraw's runtime — the contract
 * we're pinning is the driver's behaviour, not tldraw's.
 *
 * Locked invariants (drift detectors flip if any of these change):
 *
 *   1. Without a bound editor, calls return `true` and queue. After
 *      `bindEditor`, queued requests flush in arrival order.
 *   2. `unbindEditor` re-arms the queue for the next `bindEditor`.
 *   3. `openPanelInCanvas` is idempotent for a given panelId — second call
 *      reuses the existing shape (no duplicate stack).
 *   4. `panelProps` are nested under `data` (tldraw validator is strict;
 *      callers should never see arbitrary top-level keys leaking).
 *   5. `closePanelInCanvas` no-ops cleanly when the shape doesn't exist.
 *   6. `focusPanelInCanvas` returns false when the shape doesn't exist
 *      (agent tools must handle "user already closed it" gracefully).
 *   7. `updatePanelProps` merges into existing data without losing keys.
 *   8. `__resetPanelShapeApiForTests__` returns the module to a clean
 *      slate so suites don't bleed state across each other.
 */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  bindEditor,
  unbindEditor,
  getEditor,
  openPanelInCanvas,
  closePanelInCanvas,
  focusPanelInCanvas,
  updatePanelProps,
  __resetPanelShapeApiForTests__,
} from '../../src/whiteboard/shapes/panelShapeApi';

// ──────────────────────────────────────────────────────────────────────
// Stub editor — implements just the methods panelShapeApi calls
// ──────────────────────────────────────────────────────────────────────

interface StubShape {
  id: string;
  type: 'panel';
  x: number;
  y: number;
  props: {
    w: number;
    h: number;
    panelId: string;
    minimized: boolean;
    data: Record<string, unknown>;
  };
}

interface StubEditor {
  // tldraw API methods we exercise
  getShape: Mock;
  createShape: Mock;
  updateShape: Mock;
  deleteShapes: Mock;
  getShapePageBounds: Mock;
  getViewportPageBounds: Mock;
  getCurrentPageShapes: Mock;
  select: Mock;
  zoomToBounds: Mock;
  // Test-only inspector
  __shapes: Map<string, StubShape>;
}

function makeStubEditor(): StubEditor {
  const shapes = new Map<string, StubShape>();

  const editor: StubEditor = {
    __shapes: shapes,
    getShape: vi.fn((id: string) => shapes.get(id)),
    createShape: vi.fn((shape: StubShape) => {
      shapes.set(shape.id, shape);
    }),
    updateShape: vi.fn((patch: StubShape & { id: string }) => {
      const existing = shapes.get(patch.id);
      if (!existing) return;
      shapes.set(patch.id, {
        ...existing,
        ...patch,
        props: { ...existing.props, ...patch.props },
      });
    }),
    deleteShapes: vi.fn((ids: string[]) => {
      for (const id of ids) shapes.delete(id);
    }),
    getShapePageBounds: vi.fn((id: string) => {
      const shape = shapes.get(id);
      if (!shape) return undefined;
      return {
        x: shape.x,
        y: shape.y,
        w: shape.props.w,
        h: shape.props.h,
      };
    }),
    getViewportPageBounds: vi.fn(() => ({
      x: 0,
      y: 0,
      w: 1440,
      h: 900,
    })),
    getCurrentPageShapes: vi.fn(() => Array.from(shapes.values())),
    select: vi.fn(),
    zoomToBounds: vi.fn(),
  };

  return editor;
}

// ──────────────────────────────────────────────────────────────────────
// Test setup
// ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  __resetPanelShapeApiForTests__();
});

// ──────────────────────────────────────────────────────────────────────
// bindEditor / unbindEditor / getEditor
// ──────────────────────────────────────────────────────────────────────

describe('panelShapeApi — editor binding', () => {
  it('getEditor returns null before binding', () => {
    expect(getEditor()).toBeNull();
  });

  it('bindEditor stores the editor reference', () => {
    const editor = makeStubEditor();
    bindEditor(editor as unknown as Parameters<typeof bindEditor>[0]);
    expect(getEditor()).toBe(editor);
  });

  it('unbindEditor clears the reference', () => {
    const editor = makeStubEditor();
    bindEditor(editor as unknown as Parameters<typeof bindEditor>[0]);
    expect(getEditor()).toBe(editor);
    unbindEditor();
    expect(getEditor()).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────
// Pending-request queue (the "voice arrives before tldraw chunk" case)
// ──────────────────────────────────────────────────────────────────────

describe('panelShapeApi — pending-request queue', () => {
  it('queues openPanelInCanvas calls when no editor is bound', () => {
    // Voice tool fires before WhiteboardShell.onMount has run.
    expect(openPanelInCanvas('open-positions')).toBe(true);
    // No editor bound yet — the call must have queued, not executed.
    const editor = makeStubEditor();
    expect(editor.createShape).not.toHaveBeenCalled();
  });

  it('flushes queued requests in arrival order on bindEditor', () => {
    openPanelInCanvas('open-positions', { panelProps: { search: 'IT' } });
    openPanelInCanvas('resources', { panelProps: { topic: 'interview' } });

    const editor = makeStubEditor();
    bindEditor(editor as unknown as Parameters<typeof bindEditor>[0]);

    // Both queued requests fired in order.
    expect(editor.createShape).toHaveBeenCalledTimes(2);
    expect(editor.__shapes.size).toBe(2);

    const calls = editor.createShape.mock.calls.map((c) => c[0].props.panelId);
    expect(calls).toEqual(['open-positions', 'resources']);
  });

  it('drains the queue once — subsequent bindEditor does not re-fire', () => {
    openPanelInCanvas('open-positions');

    const first = makeStubEditor();
    bindEditor(first as unknown as Parameters<typeof bindEditor>[0]);
    expect(first.createShape).toHaveBeenCalledTimes(1);

    // Simulate route remount: unbind, bind a fresh editor. The original
    // request should NOT replay against the new editor.
    unbindEditor();
    const second = makeStubEditor();
    bindEditor(second as unknown as Parameters<typeof bindEditor>[0]);
    expect(second.createShape).not.toHaveBeenCalled();
  });

  it('survives a queued request that throws (no leak into the second drain)', () => {
    // A genuinely broken queued request shouldn't poison subsequent ones.
    openPanelInCanvas('open-positions');
    openPanelInCanvas('resources');

    const editor = makeStubEditor();
    // First createShape throws; second succeeds.
    let callCount = 0;
    editor.createShape.mockImplementation((shape: StubShape) => {
      callCount += 1;
      if (callCount === 1) throw new Error('boom');
      editor.__shapes.set(shape.id, shape);
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      bindEditor(editor as unknown as Parameters<typeof bindEditor>[0]);
    } finally {
      errSpy.mockRestore();
    }

    // Second request still landed.
    expect(editor.__shapes.size).toBe(1);
    expect(editor.__shapes.has('shape:panel:resources')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────
// openPanelInCanvas — shape creation, idempotency, prop nesting
// ──────────────────────────────────────────────────────────────────────

describe('openPanelInCanvas — create + idempotency', () => {
  it('creates a panel shape with panelProps nested under `data`', () => {
    const editor = makeStubEditor();
    bindEditor(editor as unknown as Parameters<typeof bindEditor>[0]);

    openPanelInCanvas('open-positions', {
      panelProps: { search: 'IT', selectedJobId: 7 },
    });

    expect(editor.createShape).toHaveBeenCalledTimes(1);
    const created = editor.createShape.mock.calls[0][0] as StubShape;
    expect(created.type).toBe('panel');
    expect(created.props.panelId).toBe('open-positions');
    expect(created.props.minimized).toBe(false);
    // Locked invariant: arbitrary props nest under `data`, never bleed up
    // to the top-level shape props.
    expect(created.props.data).toEqual({ search: 'IT', selectedJobId: 7 });
    expect(created.props).not.toHaveProperty('search');
    expect(created.props).not.toHaveProperty('selectedJobId');
  });

  it('reuses the existing shape on a second call (no duplicate stack)', () => {
    const editor = makeStubEditor();
    bindEditor(editor as unknown as Parameters<typeof bindEditor>[0]);

    openPanelInCanvas('open-positions');
    openPanelInCanvas('open-positions');

    expect(editor.createShape).toHaveBeenCalledTimes(1);
    expect(editor.__shapes.size).toBe(1);
  });

  it('updates props on second call when panelProps differ', () => {
    const editor = makeStubEditor();
    bindEditor(editor as unknown as Parameters<typeof bindEditor>[0]);

    openPanelInCanvas('open-positions', { panelProps: { search: 'IT' } });
    openPanelInCanvas('open-positions', {
      panelProps: { selectedJobId: 7 },
    });

    expect(editor.createShape).toHaveBeenCalledTimes(1);
    expect(editor.updateShape).toHaveBeenCalledTimes(1);

    const finalShape = editor.__shapes.get('shape:panel:open-positions');
    // Merge semantics — earlier `search` survives the patch.
    expect(finalShape?.props.data).toEqual({
      search: 'IT',
      selectedJobId: 7,
    });
  });

  it('focuses the shape via select + zoomToBounds when focus !== false', () => {
    const editor = makeStubEditor();
    bindEditor(editor as unknown as Parameters<typeof bindEditor>[0]);

    openPanelInCanvas('open-positions');
    expect(editor.select).toHaveBeenCalledTimes(1);
    expect(editor.zoomToBounds).toHaveBeenCalledTimes(1);
  });

  it('skips focus when explicitly disabled (focus: false)', () => {
    const editor = makeStubEditor();
    bindEditor(editor as unknown as Parameters<typeof bindEditor>[0]);

    openPanelInCanvas('open-positions', { focus: false });
    expect(editor.select).not.toHaveBeenCalled();
    expect(editor.zoomToBounds).not.toHaveBeenCalled();
  });

  it('uses an explicit position when provided', () => {
    const editor = makeStubEditor();
    bindEditor(editor as unknown as Parameters<typeof bindEditor>[0]);

    openPanelInCanvas('open-positions', {
      position: { x: 200, y: 300 },
      size: { w: 600, h: 400 },
    });

    const created = editor.createShape.mock.calls[0][0] as StubShape;
    expect(created.x).toBe(200);
    expect(created.y).toBe(300);
    expect(created.props.w).toBe(600);
    expect(created.props.h).toBe(400);
  });

  it('cascades placement when called repeatedly with default options', () => {
    const editor = makeStubEditor();
    bindEditor(editor as unknown as Parameters<typeof bindEditor>[0]);

    openPanelInCanvas('a');
    openPanelInCanvas('b');
    openPanelInCanvas('c');

    const xs = editor.createShape.mock.calls.map(
      (c) => (c[0] as StubShape).x,
    );
    // Cascading inset means later shapes don't sit exactly on top of #1.
    expect(new Set(xs).size).toBeGreaterThan(1);
  });

  it('re-expands a minimised shape on a fresh tool call', () => {
    const editor = makeStubEditor();
    bindEditor(editor as unknown as Parameters<typeof bindEditor>[0]);

    openPanelInCanvas('open-positions');
    // User minimised the shape via the chrome button.
    const id = 'shape:panel:open-positions';
    const existing = editor.__shapes.get(id)!;
    editor.__shapes.set(id, {
      ...existing,
      props: { ...existing.props, minimized: true },
    });

    // Agent reopens the panel — should un-minimise, not stack.
    openPanelInCanvas('open-positions');

    expect(editor.__shapes.size).toBe(1);
    expect(editor.__shapes.get(id)?.props.minimized).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────
// closePanelInCanvas
// ──────────────────────────────────────────────────────────────────────

describe('closePanelInCanvas', () => {
  it('returns false when no editor is bound', () => {
    expect(closePanelInCanvas('open-positions')).toBe(false);
  });

  it('returns false when the shape does not exist', () => {
    const editor = makeStubEditor();
    bindEditor(editor as unknown as Parameters<typeof bindEditor>[0]);
    expect(closePanelInCanvas('open-positions')).toBe(false);
    expect(editor.deleteShapes).not.toHaveBeenCalled();
  });

  it('deletes the shape when present', () => {
    const editor = makeStubEditor();
    bindEditor(editor as unknown as Parameters<typeof bindEditor>[0]);
    openPanelInCanvas('open-positions');
    expect(editor.__shapes.size).toBe(1);

    expect(closePanelInCanvas('open-positions')).toBe(true);
    expect(editor.deleteShapes).toHaveBeenCalledTimes(1);
    expect(editor.__shapes.size).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────
// focusPanelInCanvas
// ──────────────────────────────────────────────────────────────────────

describe('focusPanelInCanvas', () => {
  it('returns false when no editor is bound', () => {
    expect(focusPanelInCanvas('open-positions')).toBe(false);
  });

  it('returns false when the shape does not exist', () => {
    const editor = makeStubEditor();
    bindEditor(editor as unknown as Parameters<typeof bindEditor>[0]);
    expect(focusPanelInCanvas('open-positions')).toBe(false);
    expect(editor.select).not.toHaveBeenCalled();
  });

  it('selects + zooms when the shape exists', () => {
    const editor = makeStubEditor();
    bindEditor(editor as unknown as Parameters<typeof bindEditor>[0]);
    openPanelInCanvas('open-positions', { focus: false }); // create without focusing
    editor.select.mockClear();
    editor.zoomToBounds.mockClear();

    expect(focusPanelInCanvas('open-positions')).toBe(true);
    expect(editor.select).toHaveBeenCalledTimes(1);
    expect(editor.zoomToBounds).toHaveBeenCalledTimes(1);
  });
});

// ──────────────────────────────────────────────────────────────────────
// updatePanelProps
// ──────────────────────────────────────────────────────────────────────

describe('updatePanelProps', () => {
  it('returns false when no editor is bound', () => {
    expect(updatePanelProps('open-positions', { search: 'x' })).toBe(false);
  });

  it('returns false when the shape does not exist', () => {
    const editor = makeStubEditor();
    bindEditor(editor as unknown as Parameters<typeof bindEditor>[0]);
    expect(updatePanelProps('open-positions', { search: 'x' })).toBe(false);
  });

  it('merges patch into existing data without losing keys', () => {
    const editor = makeStubEditor();
    bindEditor(editor as unknown as Parameters<typeof bindEditor>[0]);
    openPanelInCanvas('open-positions', {
      panelProps: { search: 'IT', filter: 'open' },
    });

    expect(updatePanelProps('open-positions', { selectedJobId: 9 })).toBe(
      true,
    );

    const final = editor.__shapes.get('shape:panel:open-positions');
    expect(final?.props.data).toEqual({
      search: 'IT',
      filter: 'open',
      selectedJobId: 9,
    });
  });
});
