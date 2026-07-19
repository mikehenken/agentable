/**
 * Registered panels open end to end through the host API: a loader map in
 * today's registration shape wraps into `kind: 'react'` definitions,
 * `createCanvasHost` indexes them, and `host.panels.open` validates the id
 * against the registry, waits for engine readiness, and hands the
 * placement request to the engine.
 *
 * The five panel ids are the ones existing whiteboard hosts register
 * today; the framework already knows them through the site grid spans
 * and the canvas-global panel list. Their components live in host
 * codebases, so stand-ins in the same loader shape represent them here.
 * A fake engine drives every scenario, the same pattern as
 * canvasHost.test.ts; nothing touches tldraw.
 */
import { describe, it, expect } from 'vitest';
import type { ComponentType } from 'react';
import {
  createCanvasHost,
  type EngineHandle,
  type EngineLifecycleEvent,
  type PanelOpenRequest,
} from '../../src/panels/host';
import {
  reactPanelDefinitions,
  type ReactPanelLoaderProps,
} from '../../src/panels/registry';
import type { JsonObject } from '../../src/panels/types';

class FakeEngine implements EngineHandle {
  requests: PanelOpenRequest[] = [];
  private ready = false;
  private listeners: Record<EngineLifecycleEvent, Set<() => void>> = {
    ready: new Set(),
    change: new Set(),
  };

  isReady(): boolean {
    return this.ready;
  }

  on(event: EngineLifecycleEvent, listener: () => void): () => void {
    this.listeners[event].add(listener);
    return () => {
      this.listeners[event].delete(listener);
    };
  }

  exportSnapshot(): JsonObject {
    return {};
  }

  importSnapshot(): void {}

  openPanel(request: PanelOpenRequest): void {
    this.requests.push(request);
  }

  becomeReady(): void {
    this.ready = true;
    for (const listener of [...this.listeners.ready]) listener();
  }
}

function panelComponent(name: string): ComponentType<ReactPanelLoaderProps> {
  const component: ComponentType<ReactPanelLoaderProps> = () => null;
  component.displayName = name;
  return component;
}

const PANEL_COMPONENTS = {
  chat: panelComponent('ChatPanelStandIn'),
  'project-brief': panelComponent('ProjectBriefPanelStandIn'),
  'web-preview': panelComponent('WebPreviewPanelStandIn'),
  'file-manager': panelComponent('FileManagerPanelStandIn'),
  'all-sites': panelComponent('AllSitesPanelStandIn'),
};

const PANEL_IDS = Object.keys(PANEL_COMPONENTS);

const EXISTING_PANEL_LOADERS = Object.fromEntries(
  Object.entries(PANEL_COMPONENTS).map(([id, component]) => [
    id,
    () => Promise.resolve({ default: component }),
  ]),
);

async function settled(promise: Promise<unknown>): Promise<boolean> {
  const marker = Symbol('pending');
  const result = await Promise.race([promise, Promise.resolve(marker)]);
  return result !== marker;
}

describe('host panel registry', () => {
  it('indexes react definitions wrapped from the loader map', async () => {
    const engine = new FakeEngine();
    const definitions = reactPanelDefinitions(EXISTING_PANEL_LOADERS);
    const host = createCanvasHost({ engine, panels: definitions });

    expect([...host.panels.ids()]).toEqual(PANEL_IDS);
    for (const id of PANEL_IDS) {
      const definition = host.panels.get(id);
      expect(definition?.kind).toBe('react');
      if (definition?.kind !== 'react') continue;
      const module = await definition.loader();
      expect(module.default).toBe(
        PANEL_COMPONENTS[id as keyof typeof PANEL_COMPONENTS],
      );
    }
  });
});

describe('host.panels.open', () => {
  it('opens all five existing panels through the host API', async () => {
    const engine = new FakeEngine();
    engine.becomeReady();
    const host = createCanvasHost({
      engine,
      panels: reactPanelDefinitions(EXISTING_PANEL_LOADERS),
    });

    for (const id of PANEL_IDS) {
      await expect(host.panels.open(id)).resolves.toBeUndefined();
    }
    expect(engine.requests.map((request) => request.panelId)).toEqual(PANEL_IDS);
  });

  it('holds an open until the engine reports ready', async () => {
    const engine = new FakeEngine();
    const host = createCanvasHost({
      engine,
      panels: reactPanelDefinitions(EXISTING_PANEL_LOADERS),
    });

    const openPromise = host.panels.open('chat');
    expect(await settled(openPromise)).toBe(false);
    expect(engine.requests).toEqual([]);

    engine.becomeReady();
    await expect(openPromise).resolves.toBeUndefined();
    expect(engine.requests.map((request) => request.panelId)).toEqual(['chat']);
  });

  it('forwards scope, data, and placement options to the engine', async () => {
    const engine = new FakeEngine();
    engine.becomeReady();
    const host = createCanvasHost({
      engine,
      panels: reactPanelDefinitions(EXISTING_PANEL_LOADERS),
    });

    await host.panels.open('web-preview', {
      scope: { contextId: 'ctx-1', entityId: 'ent-9' },
      data: { url: 'https://example.com/draft' },
      position: { x: 120, y: 80 },
      size: { w: 640, h: 480 },
      focus: false,
    });

    expect(engine.requests).toEqual([
      {
        panelId: 'web-preview',
        scope: { contextId: 'ctx-1', entityId: 'ent-9' },
        data: { url: 'https://example.com/draft' },
        position: { x: 120, y: 80 },
        size: { w: 640, h: 480 },
        focus: false,
      },
    ]);
  });

  it('rejects ids missing from the registry without touching the engine', async () => {
    const engine = new FakeEngine();
    engine.becomeReady();
    const host = createCanvasHost({
      engine,
      panels: reactPanelDefinitions(EXISTING_PANEL_LOADERS),
    });

    await expect(host.panels.open('journey')).rejects.toThrow(
      'no panel registered for id "journey"',
    );
    expect(engine.requests).toEqual([]);
  });

  it('rejects when the engine does not implement panel placement', async () => {
    const engine: EngineHandle = {
      isReady: () => true,
      on: () => () => {},
      exportSnapshot: () => ({}),
      importSnapshot: () => {},
    };
    const host = createCanvasHost({
      engine,
      panels: reactPanelDefinitions(EXISTING_PANEL_LOADERS),
    });

    await expect(host.panels.open('chat')).rejects.toThrow(
      'engine does not implement panel placement',
    );
  });

  it('rejects an open that was still waiting when the host was disposed', async () => {
    const engine = new FakeEngine();
    const host = createCanvasHost({
      engine,
      panels: reactPanelDefinitions(EXISTING_PANEL_LOADERS),
    });

    const openPromise = host.panels.open('chat');
    host.dispose();
    engine.becomeReady();

    await expect(openPromise).rejects.toThrow(
      'host disposed before panel "chat" could open',
    );
    expect(engine.requests).toEqual([]);
  });
});
