/**
 * tldraw engine harness for the engine conformance kit.
 *
 * Uses a stub Editor (same approach as whiteboardEngine.test.ts) so the
 * conformance suite pins SPI behavior without mounting tldraw in jsdom.
 */
import { vi, type Mock } from 'vitest';
import type { Editor } from 'tldraw';
import { createWhiteboardEngine } from '../../../src/engines/tldraw/engine';
import {
  bindEditor,
  __resetPanelShapeApiForTests__,
} from '../../../src/engines/tldraw/shapes/panelShapeApi';
import type {
  EngineConformanceContext,
  EngineConformanceHarness,
  EngineReorderSpies,
} from '../../../src/engine/testing/types';
import type { Rect } from '../../../src/engine/types';

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
  getShape(): Mock;
  createShape: Mock;
  updateShape: Mock;
  deleteShapes: Mock;
  getShapePageBounds(): Mock;
  getViewportPageBounds(): Mock;
  getViewportScreenBounds(): Mock;
  getCurrentPageShapes(): Mock;
  getSelectedShapeIds(): Mock;
  select: Mock;
  zoomToBounds: Mock;
  getCamera: Mock;
  setCamera: Mock;
  setCameraOptions: Mock;
  getZoomLevel(): Mock;
  getSnapshot(): Mock;
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
      shapes.set(shape.id, {...shape, typeName: 'shape', index: `a${shapes.size + 1}` });
    }),
    updateShape: vi.fn((patch: Partial<StubShape> & { id: string }) => {
      const existing = shapes.get(patch.id);
      if (!existing) return;
      const next = {...existing,...patch,
        props: {...existing.props,...(patch.props ?? {}) },
      } as StubShape;
      shapes.set(patch.id, next);
      editor.__emitStoreEntry({
        changes: { added: {}, updated: { [patch.id]: [existing, next] }, removed: {} },
      });
    }),
    deleteShapes: vi.fn((ids: string[]) => {
      for (const id of ids) {
        const removed = shapes.get(id);
        if (!removed) continue;
        shapes.delete(id);
        editor.__emitStoreEntry({
          changes: { added: {}, updated: {}, removed: { [id]: removed } },
        });
      }
    }),
    getShapePageBounds: vi.fn((id: string) => {
      const shape = shapes.get(id);
      if (!shape) return undefined;
      return { x: shape.x, y: shape.y, w: shape.props.w, h: shape.props.h };
    }),
    getViewportPageBounds: vi.fn(() => ({ x: 0, y: 0, w: 1440, h: 900 })),
    getViewportScreenBounds: vi.fn(() => ({ x: 0, y: 0, w: 1440, h: 900 })),
    getCurrentPageShapes: vi.fn(() => Array.from(shapes.values())),
    getSelectedShapeIds: vi.fn(() => [] as string[]),
    select: vi.fn(),
    zoomToBounds: vi.fn(),
    getCamera: vi.fn(() => ({ x: 10, y: 20, z: 2 })),
    setCamera: vi.fn((state: { x: number; y: number; z: number }) => {
      editor.getCamera.mockReturnValue(state);
    }),
    setCameraOptions: vi.fn(),
    getZoomLevel: vi.fn(() => 2),
    getSnapshot: vi.fn(() => ({ document: { pages: 1 } })),
    loadSnapshot: vi.fn(() => {
      editor.__emitStoreEntry(emptyEntry());
    }),
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
  rect: Rect,
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

const emptyEntry = (): Parameters<StubEditor['__emitStoreEntry']>[0] => ({
  changes: {
    added: {},
    updated: {},
    removed: {},
  },
});

interface ActiveHarnessState {
  stub: StubEditor;
  detach: (() => void) | undefined;
}

let activeState: ActiveHarnessState | undefined;

function panelShapeId(panelId: string): string {
  return `shape:panel:${panelId}`;
}

export function createTldrawConformanceHarness(): EngineConformanceHarness {
  return {
    name: 'tldraw',
    createContext(): EngineConformanceContext {
      __resetPanelShapeApiForTests__();
      const stub = makeStubEditor();
      const engine = createWhiteboardEngine();
      bindEditor(asEditor(stub));
      const detach = engine.attachEditor(asEditor(stub));
      activeState = { stub, detach };

      const reorderSpies: EngineReorderSpies = {
        bringToFront: stub.bringToFront,
        sendToBack: stub.sendToBack,
        bringForward: stub.bringForward,
      };

      return {
        engine,
        reorderSpies,
        reset: () => {
          __resetPanelShapeApiForTests__();
          stub.__shapes.clear();
          bindEditor(asEditor(stub));
          if (!engine.isReady) {
            engine.attachEditor(asEditor(stub));
          }
        },
        teardown: () => {
          detach?.();
          engine.destroy();
          __resetPanelShapeApiForTests__();
          activeState = undefined;
        },
        seedPanel: (panelId, rect) => {
          stub.__shapes.set(panelShapeId(panelId), panelShape(panelId, rect));
        },
        emitUserStoreChange: () => {
          stub.__emitStoreEntry(emptyEntry());
        },
        emitCameraMotion: () => {
          stub.__emitStoreEntry({
            changes: {
              added: {},
              updated: {
                'camera:page': [
                  { typeName: 'camera', x: 0, y: 0, z: 1 },
                  { typeName: 'camera', x: 5, y: 5, z: 1 },
                ],
              },
              removed: {},
            },
          });
        },
        emitSelectionChange: (panelId: string) => {
          const seeded = stub.__shapes.get(panelShapeId(panelId));
          if (!seeded) return;
          stub.__emitStoreEntry({
            changes: {
              added: {},
              updated: {
                'instance_page_state:page': [
                  { typeName: 'instance_page_state', selectedShapeIds: [] },
                  {
                    typeName: 'instance_page_state',
                    selectedShapeIds: [seeded.id],
                  },
                ],
              },
              removed: {},
            },
          });
        },
      };
    },
  };
}

/** Creates an unattached tldraw engine for lifecycle edge-case tests. */
export function createUnattachedTldrawEngine() {
  __resetPanelShapeApiForTests__();
  return createWhiteboardEngine();
}

export function getActiveTldrawHarnessState(): ActiveHarnessState | undefined {
  return activeState;
}
