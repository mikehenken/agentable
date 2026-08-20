/**
 * automated_check: one `open_panel` call targets DOM region vs tldraw position.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { createDomEngine } from '../../src/engines/dom';
import { createWhiteboardEngine } from '../../src/engines/tldraw/engine';
import { bindEditor } from '../../src/engines/tldraw/shapes/panelShapeApi';
import { createPanelRegistry } from '../../src/panels/registry';
import { createPanelToolRuntime } from '../../src/panels/panelToolRuntime';
import { createPanelToolsFromRegistry } from '../../src/panels/tools';
import { defineSchemaPanel } from '../../src/panels/builder';
import { defaultCatalog } from '../../src/panels/spec';
import type { EngineHandle } from '../../src/panels/host';
import type { JsonObject } from '../../src/panels/types';

const TEST_PANEL = defineSchemaPanel({
  id: 'site-seo',
  meta: {
    title: 'SEO',
    schemaVersion: 1,
    agentDescription: 'Edit search engine settings for the active site or page.',
    contextKinds: ['site', 'page'],
  },
  sources: {
    seo: { source: 'site.seo', params: { pageId: '$scope.entityId' } },
  },
  actions: {
    save: { kind: 'mutate', source: 'site.seo', op: 'update', mutates: true },
  },
  blocks: [
    {
      block: 'form',
      bind: 'seo',
      fields: [{ bind: 'title', type: 'text', label: 'Meta title' }],
    },
    { block: 'actions', actions: ['save'] },
  ],
} as const satisfies Parameters<typeof defineSchemaPanel>[0]);

class RecordingEngine implements EngineHandle {
  lastOpen: import('../../src/engine/types').EnginePanelPlacement | null = null;
  private listeners: { ready: Set<() => void>; change: Set<() => void> } = {
    ready: new Set(),
    change: new Set(),
  };

  isReady(): boolean {
    return true;
  }

  on(event: 'ready' | 'change', listener: () => void): () => void {
    this.listeners[event].add(listener);
    return () => {
      this.listeners[event].delete(listener);
    };
  }

  exportSnapshot(): JsonObject {
    return {};
  }

  importSnapshot(): void {}

  openPanel(request: import('../../src/engine/types').EnginePanelPlacement): void {
    this.lastOpen = request;
  }
}

function toolByName(
  tools: ReturnType<typeof createPanelToolsFromRegistry>,
  name: string): (typeof tools)[number] {
  const tool = tools.find((entry) => entry.declaration.name === name);
  if (tool === undefined) {
    throw new Error(`missing tool ${name}`);
  }
  return tool;
}

describe('unified panel targeting — same open_panel call', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it('routes region target through DOM engine openPanel', async () => {
    const domEngine = createDomEngine();
    const registry = createPanelRegistry([TEST_PANEL]);
    const runtime = createPanelToolRuntime(
      {
        panels: {
          open: async (id, options) => {
            domEngine.openPanel({ panelId: id,...options });
          },
          has: registry.has,
          get: registry.get,
          ids: registry.ids,
          definitions: registry.definitions,
        },
        catalog: defaultCatalog,
      },
      registry);
    cleanups.push(() => runtime.dispose());

    const tools = createPanelToolsFromRegistry(registry, runtime);
    const openPanel = toolByName(tools, 'open_panel');

    const result = await openPanel.handler({
      id: 'site-seo',
      target: { kind: 'region', region: 'sidebar', order: 1 },
    });
    expect(result.ok).toBe(true);

    const layout = domEngine.getDomLayout;
    const panel = layout().panels.find((entry) => entry.panelId === 'site-seo');
    expect(panel?.regionId).toBe('sidebar');
    expect(panel?.tabIndex).toBe(1);
    expect(layout().activeTab.sidebar).toBe(1);
  });

  it('routes canvas target through tldraw engine openPanel', async () => {
    const shapes = new Map<string, {
      id: string;
      type: 'panel';
      x: number;
      y: number;
      props: { w: number; h: number; panelId: string; minimized: boolean; data: Record<string, unknown> };
    }>;
    const storeListeners: Array<(entry: unknown) => void> = [];
    const stub = {
      __shapes: shapes,
      getSnapshot: () => ({ document: { pages: 1 } }),
      getShape: (id: string) => shapes.get(id),
      createShape: (shape: {
        id: string;
        type: 'panel';
        x: number;
        y: number;
        props: { w: number; h: number; panelId: string; minimized: boolean; data: Record<string, unknown> };
      }) => {
        shapes.set(shape.id, shape);
      },
      updateShape: (partial: {
        id: string;
        x?: number;
        y?: number;
        props?: Partial<{ w: number; h: number; panelId: string; minimized: boolean; data: Record<string, unknown> }>;
      }) => {
        const existing = shapes.get(partial.id);
        if (!existing) return;
        shapes.set(partial.id, {...existing,...(partial.x !== undefined ? { x: partial.x }: {}),...(partial.y !== undefined ? { y: partial.y }: {}),
          props: {...existing.props,...(partial.props ?? {}) },
        });
      },
      select: () => undefined,
      zoomToBounds: () => undefined,
      getCurrentPageShapes: () => [...shapes.values()],
      bringToFront: () => undefined,
      sendToBack: () => undefined,
      getShapePageBounds: (id: string) => {
        const shape = shapes.get(id);
        return shape ? { x: shape.x, y: shape.y, w: shape.props.w, h: shape.props.h }: undefined;
      },
      getViewportPageBounds: () => ({ x: 0, y: 0, w: 1440, h: 900 }),
      getViewportScreenBounds: () => ({ x: 0, y: 0, w: 1440, h: 900 }),
      getCamera: () => ({ x: 0, y: 0, z: 1 }),
      setCamera: () => undefined,
      setCameraOptions: () => undefined,
      getZoomLevel: () => 1,
      store: {
        listen: (listener: (entry: unknown) => void) => {
          storeListeners.push(listener);
          return () => {
            const index = storeListeners.indexOf(listener);
            if (index >= 0) storeListeners.splice(index, 1);
          };
        },
      },
    };

    const tldrawEngine = createWhiteboardEngine();
    tldrawEngine.attachEditor(stub as never);
    bindEditor(stub as never);

    const registry = createPanelRegistry([TEST_PANEL]);
    const runtime = createPanelToolRuntime(
      {
        panels: {
          open: async (id, options) => {
            tldrawEngine.openPanel({ panelId: id,...options });
          },
          has: registry.has,
          get: registry.get,
          ids: registry.ids,
          definitions: registry.definitions,
        },
        catalog: defaultCatalog,
      },
      registry);
    cleanups.push(() => runtime.dispose());

    const tools = createPanelToolsFromRegistry(registry, runtime);
    const openPanel = toolByName(tools, 'open_panel');

    const result = await openPanel.handler({
      id: 'site-seo',
      target: {
        kind: 'canvas',
        position: { x: 240, y: 120 },
        size: { w: 400, h: 300 },
      },
    });
    expect(result.ok).toBe(true);

    const shape = shapes.get('shape:panel:site-seo');
    expect(shape).toBeDefined();
    expect(shape!.x).toBe(240);
    expect(shape!.y).toBe(120);
    expect(shape!.props.w).toBe(400);
    expect(shape!.props.h).toBe(300);
  });

  it('uses the same legacy position call shape for canvas engines', async () => {
    const engine = new RecordingEngine();
    const registry = createPanelRegistry([TEST_PANEL]);
    const runtime = createPanelToolRuntime(
      {
        panels: {
          open: async (id, options) => {
            engine.openPanel({ panelId: id,...options });
          },
          has: registry.has,
          get: registry.get,
          ids: registry.ids,
          definitions: registry.definitions,
        },
        catalog: defaultCatalog,
      },
      registry);
    cleanups.push(() => runtime.dispose());

    const tools = createPanelToolsFromRegistry(registry, runtime);
    const openPanel = toolByName(tools, 'open_panel');

    const sharedArgs = {
      id: 'site-seo',
      position: { x: 512, y: 256 },
      size: { w: 320, h: 240 },
    };

    const result = await openPanel.handler(sharedArgs);
    expect(result.ok).toBe(true);
    expect(engine.lastOpen).toMatchObject({
      panelId: 'site-seo',
      position: { x: 512, y: 256 },
      size: { w: 320, h: 240 },
    });
    expect(engine.lastOpen?.region).toBeUndefined();
  });

  it('uses the same legacy region call shape for DOM engines', async () => {
    const domEngine = createDomEngine();
    const registry = createPanelRegistry([TEST_PANEL]);
    const runtime = createPanelToolRuntime(
      {
        panels: {
          open: async (id, options) => {
            domEngine.openPanel({ panelId: id,...options });
          },
          has: registry.has,
          get: registry.get,
          ids: registry.ids,
          definitions: registry.definitions,
        },
        catalog: defaultCatalog,
      },
      registry);
    cleanups.push(() => runtime.dispose());

    const tools = createPanelToolsFromRegistry(registry, runtime);
    const openPanel = toolByName(tools, 'open_panel');

    const sharedArgs = {
      id: 'site-seo',
      region: 'sidebar',
      order: 0,
    };

    const result = await openPanel.handler(sharedArgs);
    expect(result.ok).toBe(true);

    const panel = domEngine.getDomLayout().panels.find((entry) => entry.panelId === 'site-seo');
    expect(panel?.regionId).toBe('sidebar');
    expect(panel?.tabIndex).toBe(0);
  });
});
