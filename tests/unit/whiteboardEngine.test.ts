/**
 * Behavior of `createWhiteboardEngine`, the tldraw implementation of the
 * canvas engine SPI (src/engine/types).
 *
 * A stub editor implements only the methods the adapter touches, the
 * same approach as panelShapeApi.test.ts: the contract pinned here is
 * the adapter's behavior, not tldraw's. Because panel opening routes
 * through the shared `panelShapeApi` module state, suites bind the stub
 * there too and reset it between tests.
 *
 * Locked invariants:
 *   1. `ready` fires once on attach; `isReady` tracks attachment.
 *   2. `change` mirrors user store entries and stays silent during
 *      `importSnapshot` (restores must not persist themselves back).
 *   3. Panel geometry ops address shapes by the `panel:` id convention
 *      and are no-ops for absent shapes.
 *   4. Layout export/import round-trips through WorkspaceLayoutRecord.
 *   5. Engine events (panel moved/resized/removed, selection, camera
 *      settle) derive from store entries.
 *   6. Camera reads throw without an attached editor rather than
 *      returning garbage.
 *   7. A full SPI handle drives `createCanvasHost` unchanged.
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import type { Editor } from 'tldraw';
import { createWhiteboardEngine } from '../../src/engines/tldraw/engine';
import {
  bindEditor,
  __resetPanelShapeApiForTests__,
} from '../../src/engines/tldraw/shapes/panelShapeApi';
import { createCanvasHost } from '../../src/panels/host';
import type { WorkspaceLayoutRecord } from '../../src/engine/types';

interface StubShape {
  id: string;
  typeName: 'shape';
  type: 'panel';
  x: number;
  y: number;
  index: string;
  props: {
    w: number;
    h: number;
    panelId: string;
    minimized: boolean;
    data: Record<string, unknown>;
  };
}

type StoreListener = (entry: {
  changes: {
    added: Record<string, unknown>;
    updated: Record<string, [unknown, unknown]>;
    removed: Record<string, unknown>;
  };
}) => void;

interface StubEditor {
  getShape: Mock;
  createShape: Mock;
  updateShape: Mock;
  deleteShapes: Mock;
  getShapePageBounds: Mock;
  getViewportPageBounds: Mock;
  getViewportScreenBounds: Mock;
  getCurrentPageShapes: Mock;
  getSelectedShapeIds: Mock;
  select: Mock;
  zoomToBounds: Mock;
  getCamera: Mock;
  setCamera: Mock;
  setCameraOptions: Mock;
  getZoomLevel: Mock;
  getSnapshot: Mock;
  loadSnapshot: Mock;
  bringToFront: Mock;
  sendToBack: Mock;
  bringForward: Mock;
  store: { listen: Mock };
  __shapes: Map<string, StubShape>;
  __storeListeners: StoreListener[];
  __emitStoreEntry: (entry: Parameters<StoreListener>[0]) => void;
}

function makeStubEditor(): StubEditor {
  const shapes = new Map<string, StubShape>();
  const storeListeners: StoreListener[] = [];

  const editor: StubEditor = {
    __shapes: shapes,
    __storeListeners: storeListeners,
    __emitStoreEntry: (entry) => {
      for (const listener of [...storeListeners]) listener(entry);
    },
    getShape: vi.fn((id: string) => shapes.get(id)),
    createShape: vi.fn((shape: Omit<StubShape, 'typeName' | 'index'>) => {
      shapes.set(shape.id, { ...shape, typeName: 'shape', index: `a${shapes.size + 1}` });
    }),
    updateShape: vi.fn((patch: Partial<StubShape> & { id: string }) => {
      const existing = shapes.get(patch.id);
      if (!existing) return;
      shapes.set(patch.id, {...existing,...patch,
        props: { ...existing.props, ...(patch.props ?? {}) },
      } as StubShape);
    }),
    deleteShapes: vi.fn((ids: string[]) => {
      for (const id of ids) shapes.delete(id);
    }),
    getShapePageBounds: vi.fn((id: string) => {
      const shape = shapes.get(id);
      if (!shape) return undefined;
      return { x: shape.x, y: shape.y, w: shape.props.w, h: shape.props.h };
    }),
    getViewportPageBounds: vi.fn(() => ({ x: 0, y: 0, w: 1440, h: 900 })),
    // Live engine's setCamera clamps via clampCameraForMode, which reads
    // the screen viewport (no-op clamp in the default infinite mode).
    getViewportScreenBounds: vi.fn(() => ({ x: 0, y: 0, w: 1440, h: 900 })),
    getCurrentPageShapes: vi.fn(() => Array.from(shapes.values())),
    getSelectedShapeIds: vi.fn(() => [] as string[]),
    select: vi.fn(),
    zoomToBounds: vi.fn(),
    getCamera: vi.fn(() => ({ x: 10, y: 20, z: 2 })),
    setCamera: vi.fn(),
    setCameraOptions: vi.fn(),
    getZoomLevel: vi.fn(() => 2),
    getSnapshot: vi.fn(() => ({ document: { pages: 1 } })),
    loadSnapshot: vi.fn(),
    bringToFront: vi.fn(),
    sendToBack: vi.fn(),
    bringForward: vi.fn(),
    store: {
      listen: vi.fn((listener: StoreListener) => {
        storeListeners.push(listener);
        return () => {
          const index = storeListeners.indexOf(listener);
          if (index >= 0) storeListeners.splice(index, 1);
        };
      }),
    },
  };
  return editor;
}

function asEditor(stub: StubEditor): Editor {
  return stub as unknown as Editor;
}

function panelShape(
  panelId: string,
  rect: { x: number; y: number; w: number; h: number },
  data: Record<string, unknown> = {}): StubShape {
  return {
    id: `shape:panel:${panelId}`,
    typeName: 'shape',
    type: 'panel',
    x: rect.x,
    y: rect.y,
    index: 'a1',
    props: { w: rect.w, h: rect.h, panelId, minimized: false, data },
  };
}

const emptyEntry = () => ({
  changes: {
    added: {},
    updated: {} as Record<string, [unknown, unknown]>,
    removed: {} as Record<string, unknown>,
  },
});

beforeEach(() => {
  __resetPanelShapeApiForTests__();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('lifecycle', () => {
  it('reports ready exactly once on attach', () => {
    const stub = makeStubEditor();
    const engine = createWhiteboardEngine();
    const readySpy = vi.fn();
    engine.on('ready', readySpy);

    expect(engine.isReady()).toBe(false);
    engine.attachEditor(asEditor(stub));
    engine.attachEditor(asEditor(stub));
    expect(engine.isReady()).toBe(true);
    expect(readySpy).toHaveBeenCalledTimes(1);
  });

  it('attaches the editor already bound in panelShapeApi', () => {
    const stub = makeStubEditor();
    const engine = createWhiteboardEngine();
    expect(engine.tryAttachBoundEditor()).toBe(false);
    bindEditor(asEditor(stub));
    expect(engine.tryAttachBoundEditor()).toBe(true);
    expect(engine.isReady()).toBe(true);
  });

  it('emits change for user store entries and stops after detach', () => {
    const stub = makeStubEditor();
    const engine = createWhiteboardEngine();
    const changeSpy = vi.fn();
    engine.on('change', changeSpy);

    const detach = engine.attachEditor(asEditor(stub));
    stub.__emitStoreEntry(emptyEntry());
    expect(changeSpy).toHaveBeenCalledTimes(1);

    detach();
    expect(engine.isReady()).toBe(false);
    stub.__emitStoreEntry(emptyEntry());
    expect(changeSpy).toHaveBeenCalledTimes(1);
  });

  it('suppresses change during importSnapshot', () => {
    const stub = makeStubEditor();
    stub.loadSnapshot.mockImplementation(() => {
      stub.__emitStoreEntry(emptyEntry());
    });
    const engine = createWhiteboardEngine();
    const changeSpy = vi.fn();
    engine.on('change', changeSpy);
    engine.attachEditor(asEditor(stub));
    bindEditor(asEditor(stub));

    engine.importSnapshot({ document: {} });
    expect(stub.loadSnapshot).toHaveBeenCalledTimes(1);
    expect(changeSpy).not.toHaveBeenCalled();

    stub.__emitStoreEntry(emptyEntry());
    expect(changeSpy).toHaveBeenCalledTimes(1);
  });

  it('exports the native snapshot, or an empty object unattached', () => {
    const stub = makeStubEditor();
    const engine = createWhiteboardEngine();
    expect(engine.exportSnapshot()).toEqual({});
    engine.attachEditor(asEditor(stub));
    expect(engine.exportSnapshot()).toEqual({ document: { pages: 1 } });
  });
});

describe('panel geometry', () => {
  it('openPanel routes through panelShapeApi with data and chrome', () => {
    const stub = makeStubEditor();
    const engine = createWhiteboardEngine();
    engine.attachEditor(asEditor(stub));
    bindEditor(asEditor(stub));

    engine.openPanel({
      panelId: 'jobs',
      position: { x: 100, y: 80 },
      size: { w: 300, h: 200 },
      focus: false,
      data: { selectedJobId: 2 },
      chrome: { title: 'Jobs' },
    });

    const shape = stub.__shapes.get('shape:panel:jobs');
    expect(shape).toBeDefined();
    expect(shape?.x).toBe(100);
    expect(shape?.y).toBe(80);
    expect(shape?.props.w).toBe(300);
    expect(shape?.props.h).toBe(200);
    expect(shape?.props.data.selectedJobId).toBe(2);
  });

  it('placePanel creates the container at the exact rect without focus', () => {
    const stub = makeStubEditor();
    const engine = createWhiteboardEngine();
    engine.attachEditor(asEditor(stub));
    bindEditor(asEditor(stub));

    engine.placePanel('jobs', { x: 105, y: 83, w: 301, h: 199 });

    const shape = stub.__shapes.get('shape:panel:jobs');
    expect(shape).toMatchObject({ x: 105, y: 83 });
    expect(shape?.props).toMatchObject({ w: 301, h: 199 });
    expect(stub.select).not.toHaveBeenCalled();
    expect(stub.zoomToBounds).not.toHaveBeenCalled();
  });

  it('resizePanel updates geometry and ignores absent shapes', () => {
    const stub = makeStubEditor();
    stub.__shapes.set('shape:panel:jobs', panelShape('jobs', { x: 0, y: 0, w: 100, h: 100 }));
    const engine = createWhiteboardEngine();
    engine.attachEditor(asEditor(stub));

    engine.resizePanel('jobs', { x: 40, y: 60, w: 500, h: 400 });
    expect(stub.__shapes.get('shape:panel:jobs')).toMatchObject({ x: 40, y: 60 });
    expect(stub.__shapes.get('shape:panel:jobs')?.props).toMatchObject({ w: 500, h: 400 });

    engine.resizePanel('missing', { x: 0, y: 0, w: 10, h: 10 });
    expect(stub.__shapes.has('shape:panel:missing')).toBe(false);
  });

  it('removePanel deletes the shape through panelShapeApi', () => {
    const stub = makeStubEditor();
    stub.__shapes.set('shape:panel:jobs', panelShape('jobs', { x: 0, y: 0, w: 100, h: 100 }));
    const engine = createWhiteboardEngine();
    engine.attachEditor(asEditor(stub));
    bindEditor(asEditor(stub));

    engine.removePanel('jobs');
    expect(stub.__shapes.has('shape:panel:jobs')).toBe(false);
  });

  it('setZOrder maps front, back, and numeric slots onto reorder ops', () => {
    const stub = makeStubEditor();
    stub.__shapes.set('shape:panel:a', panelShape('a', { x: 0, y: 0, w: 10, h: 10 }));
    stub.__shapes.set('shape:panel:b', panelShape('b', { x: 0, y: 0, w: 10, h: 10 }));
    stub.__shapes.set('shape:panel:c', panelShape('c', { x: 0, y: 0, w: 10, h: 10 }));
    const engine = createWhiteboardEngine();
    engine.attachEditor(asEditor(stub));

    engine.setZOrder('a', 'front');
    expect(stub.bringToFront).toHaveBeenCalledWith(['shape:panel:a']);

    engine.setZOrder('a', 'back');
    expect(stub.sendToBack).toHaveBeenCalledWith(['shape:panel:a']);

    stub.sendToBack.mockClear();
    engine.setZOrder('a', 1);
    expect(stub.sendToBack).toHaveBeenCalledWith(['shape:panel:a']);
    expect(stub.bringForward).toHaveBeenCalledTimes(1);
  });
});

describe('camera and viewport', () => {
  it('translates camera state both ways', () => {
    const stub = makeStubEditor();
    const engine = createWhiteboardEngine();
    engine.attachEditor(asEditor(stub));

    expect(engine.getCamera()).toEqual({ x: 10, y: 20, zoom: 2 });

    engine.setCamera({ x: 1, y: 2, zoom: 0.5 });
    expect(stub.setCamera).toHaveBeenCalledWith({ x: 1, y: 2, z: 0.5 }, undefined);

    engine.setCamera({ x: 1, y: 2, zoom: 0.5 }, { animate: true });
    expect(stub.setCamera).toHaveBeenLastCalledWith(
      { x: 1, y: 2, z: 0.5 },
      { animation: { duration: 350 } });
  });

  it('throws on camera reads without an attached editor', () => {
    const engine = createWhiteboardEngine();
    expect(() => engine.getCamera()).toThrowError(/requires an attached editor/);
    expect(() => engine.getViewportInfo()).toThrowError(/requires an attached editor/);
  });

  it('maps canvas modes onto tldraw camera options', () => {
    const stub = makeStubEditor();
    const engine = createWhiteboardEngine();
    engine.attachEditor(asEditor(stub));

    engine.setMode({ kind: 'fixed' });
    expect(stub.setCameraOptions).toHaveBeenLastCalledWith({ isLocked: true });

    engine.setMode({ kind: 'infinite' });
    expect(stub.setCameraOptions).toHaveBeenLastCalledWith({
      isLocked: false,
      wheelBehavior: 'pan',
      constraints: undefined,
    });

    engine.setMode({
      kind: 'bounded',
      bounds: { w: 1200, h: 800 },
      behavior: 'inside',
      zoom: { min: 0.5, max: 4 },
    });
    const lastCall = stub.setCameraOptions.mock.calls.at(-1)?.[0] as {
      constraints: { bounds: { w: number; h: number }; behavior: string };
      zoomSteps: number[];
      isLocked: boolean;
    };
    expect(lastCall.isLocked).toBe(false);
    expect(lastCall.zoomSteps).toEqual([0.5, 1, 4]);
    expect(lastCall.constraints.bounds).toMatchObject({ w: 1200, h: 800 });
    expect(lastCall.constraints.behavior).toBe('inside');
  });

  it('zoomTo forwards the rect with inset and animation', () => {
    const stub = makeStubEditor();
    const engine = createWhiteboardEngine();
    engine.attachEditor(asEditor(stub));

    engine.zoomTo({ x: 0, y: 0, w: 400, h: 300 }, { inset: 32 });
    expect(stub.zoomToBounds).toHaveBeenCalledWith(
      { x: 0, y: 0, w: 400, h: 300 },
      { inset: 32, animation: { duration: 350 } });
  });

  it('reports viewport info with per-panel visibility ratios', () => {
    const stub = makeStubEditor();
    stub.__shapes.set('shape:panel:inside', panelShape('inside', { x: 100, y: 100, w: 200, h: 200 }));
    stub.__shapes.set('shape:panel:half', panelShape('half', { x: -150, y: 0, w: 300, h: 300 }));
    stub.__shapes.set('shape:panel:out', panelShape('out', { x: 5000, y: 5000, w: 100, h: 100 }));
    const engine = createWhiteboardEngine();
    engine.attachEditor(asEditor(stub));

    const info = engine.getViewportInfo();
    expect(info.visibleRect).toEqual({ x: 0, y: 0, w: 1440, h: 900 });
    expect(info.zoom).toBe(2);
    expect(info.panelVisibility.inside).toBe(1);
    expect(info.panelVisibility.half).toBe(0.5);
    expect(info.panelVisibility.out).toBe(0);
  });
});

describe('workspace layout records', () => {
  it('round-trips export and import through WorkspaceLayoutRecord', () => {
    const first = makeStubEditor();
    const engine = createWhiteboardEngine();
    engine.attachEditor(asEditor(first));
    bindEditor(asEditor(first));

    engine.openPanel({
      panelId: 'jobs',
      position: { x: 100, y: 80 },
      size: { w: 300, h: 200 },
      focus: false,
      data: { contextRef: 'site:ctx-1', origin: 'agent' },
    });
    engine.openPanel({
      panelId: 'notes',
      position: { x: 500, y: 80 },
      size: { w: 200, h: 160 },
      focus: false,
    });

    const records = engine.exportLayout();
    expect(records).toEqual<WorkspaceLayoutRecord[]>([
      {
        panelId: 'jobs',
        contextId: 'site:ctx-1',
        position: { x: 100, y: 80 },
        size: { w: 300, h: 200 },
        pinned: false,
        origin: 'agent',
      },
      {
        panelId: 'notes',
        contextId: null,
        position: { x: 500, y: 80 },
        size: { w: 200, h: 160 },
        pinned: false,
        origin: 'host',
      },
    ]);

    __resetPanelShapeApiForTests__();
    const second = makeStubEditor();
    const restored = createWhiteboardEngine();
    restored.attachEditor(asEditor(second));
    bindEditor(asEditor(second));

    restored.importLayout(records);
    expect(restored.exportLayout()).toEqual(records);
  });

  it('returns an empty layout when unattached', () => {
    const engine = createWhiteboardEngine();
    expect(engine.exportLayout()).toEqual([]);
  });
});

describe('engine events from store entries', () => {
  it('emits panel moved, resized, and removed events', () => {
    const stub = makeStubEditor();
    const engine = createWhiteboardEngine();
    const moved = vi.fn();
    const resized = vi.fn();
    const removed = vi.fn();
    engine.on('panel:moved', moved);
    engine.on('panel:resized', resized);
    engine.on('panel:removed', removed);
    engine.attachEditor(asEditor(stub));

    const before = panelShape('jobs', { x: 0, y: 0, w: 300, h: 200 });
    const afterMove = panelShape('jobs', { x: 40, y: 20, w: 300, h: 200 });
    const afterResize = panelShape('jobs', { x: 40, y: 20, w: 500, h: 300 });

    stub.__emitStoreEntry({
      changes: { added: {}, updated: { [before.id]: [before, afterMove] }, removed: {} },
    });
    expect(moved).toHaveBeenCalledWith({
      id: 'jobs',
      rect: { x: 40, y: 20, w: 300, h: 200 },
    });
    expect(resized).not.toHaveBeenCalled();

    stub.__emitStoreEntry({
      changes: { added: {}, updated: { [before.id]: [afterMove, afterResize] }, removed: {} },
    });
    expect(resized).toHaveBeenCalledWith({
      id: 'jobs',
      rect: { x: 40, y: 20, w: 500, h: 300 },
    });

    stub.__emitStoreEntry({
      changes: { added: {}, updated: {}, removed: { [before.id]: afterResize } },
    });
    expect(removed).toHaveBeenCalledWith({ id: 'jobs' });
  });

  it('emits selection changes mapped to panel instance ids', () => {
    const stub = makeStubEditor();
    stub.__shapes.set('shape:panel:jobs', panelShape('jobs', { x: 0, y: 0, w: 10, h: 10 }));
    const engine = createWhiteboardEngine();
    const selection = vi.fn();
    engine.on('selection:changed', selection);
    engine.attachEditor(asEditor(stub));

    stub.__emitStoreEntry({
      changes: {
        added: {},
        updated: {
          'instance_page_state:page': [
            { typeName: 'instance_page_state', selectedShapeIds: [] },
            { typeName: 'instance_page_state', selectedShapeIds: ['shape:panel:jobs'] },
          ],
        },
        removed: {},
      },
    });
    expect(selection).toHaveBeenCalledWith({ ids: ['jobs'] });
  });

  it('emits camera settle after the camera holds still', () => {
    vi.useFakeTimers();
    const stub = makeStubEditor();
    const engine = createWhiteboardEngine();
    const settled = vi.fn();
    engine.on('camera:settled', settled);
    engine.attachEditor(asEditor(stub));

    const cameraEntry = () => ({
      changes: {
        added: {},
        updated: {
          'camera:page': [
            { typeName: 'camera', x: 0, y: 0, z: 1 },
            { typeName: 'camera', x: 5, y: 5, z: 1 },
          ] as [unknown, unknown],
        },
        removed: {},
      },
    });

    stub.__emitStoreEntry(cameraEntry());
    vi.advanceTimersByTime(150);
    stub.__emitStoreEntry(cameraEntry());
    vi.advanceTimersByTime(150);
    expect(settled).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(settled).toHaveBeenCalledTimes(1);
    expect(settled).toHaveBeenCalledWith({ camera: { x: 10, y: 20, zoom: 2 } });
  });
});

describe('host integration', () => {
  it('drives createCanvasHost as its engine', async () => {
    const stub = makeStubEditor();
    const engine = createWhiteboardEngine();
    const host = createCanvasHost({ engine });

    const order: string[] = [];
    const ready = host.whenReady().then(() => order.push('ready'));
    engine.attachEditor(asEditor(stub));
    await ready;
    expect(order).toEqual(['ready']);
    host.dispose();
  });
});
