/**
 * compose_panel port-order gate.
 * Automated check: compose reachable only post-gate.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { defineSchemaPanel } from '../../src/panels/builder';
import {
  COMPOSE_GATE_CLOSED_CODE,
  evaluateComposeGate,
  POST_SEO_COMPOSE_GATE_CRITERIA,
  POST_SEO_COMPOSE_GATE_ID,
} from '../../src/panels/composeGate';
import { createCanvasHost, type EngineHandle, type EngineLifecycleEvent } from '../../src/panels/host';
import { createPanelRegistry } from '../../src/panels/registry';
import {
  PANEL_TOOL_NAMES,
} from '../../src/panels/tools';
import { createPanelToolRuntime } from '../../src/panels/panelToolRuntime';
import {
  executeTool,
  getFunctionDeclarations,
  getTool,
} from '../../src/agents/tools/canvasTools';
import type { JsonObject, PanelSpec } from '../../src/panels/types';

class FakeEngine implements EngineHandle {
  private ready = true;
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

  openPanel(): void {}
}

const SEO_SPEC_PANEL = defineSchemaPanel({
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
    aiGenerate: {
      kind: 'mutate',
      source: 'seo.generate',
      op: 'invoke',
      mutates: true,
      variant: 'ai',
      targetFields: ['title', 'description', 'keywords'],
    },
  },
  blocks: [
    {
      block: 'form',
      bind: 'seo',
      fields: [
        { bind: 'title', type: 'text', label: 'Meta title' },
        { bind: 'description', type: 'textarea', label: 'Meta description' },
        { bind: 'keywords', type: 'text', label: 'Keywords' },
      ],
    },
    { block: 'actions', actions: ['save', 'aiGenerate'] },
  ],
} as const satisfies Parameters<typeof defineSchemaPanel>[0]);

const MINIMAL_COMPOSE_SPEC: PanelSpec = {
  v: 1,
  root: 'root',
  nodes: {
    root: { type: 'stack', children: ['title'] },
    title: { type: 'text', props: { text: 'Hello' } },
  },
};

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

describe('evaluateComposeGate', () => {
  it('closes when enabled is false', () => {
    const registry = createPanelRegistry([SEO_SPEC_PANEL]);
    const result = evaluateComposeGate(
      {
        id: POST_SEO_COMPOSE_GATE_ID,
        enabled: false,
        criteria: POST_SEO_COMPOSE_GATE_CRITERIA,
      },
      registry);

    expect(result.open).toBe(false);
    expect(result.code).toBe(COMPOSE_GATE_CLOSED_CODE);
  });

  it('opens when enabled and site SEO criteria are met', () => {
    const registry = createPanelRegistry([SEO_SPEC_PANEL]);
    const result = evaluateComposeGate(
      {
        id: POST_SEO_COMPOSE_GATE_ID,
        enabled: true,
        criteria: POST_SEO_COMPOSE_GATE_CRITERIA,
      },
      registry);

    expect(result).toEqual({ id: POST_SEO_COMPOSE_GATE_ID, open: true });
  });

  it('closes when enabled but required SEO panel is missing', () => {
    const registry = createPanelRegistry([]);
    const result = evaluateComposeGate(
      {
        id: POST_SEO_COMPOSE_GATE_ID,
        enabled: true,
        criteria: POST_SEO_COMPOSE_GATE_CRITERIA,
      },
      registry);

    expect(result.open).toBe(false);
    expect(result.code).toBe(COMPOSE_GATE_CLOSED_CODE);
    expect(result.reason).toContain('site-seo');
  });
});

describe('compose_panel reachability post-gate', () => {
  it('omits compose_panel from declarations pre-gate and rejects execution', async () => {
    const host = createCanvasHost({
      engine: new FakeEngine(),
      panels: [SEO_SPEC_PANEL],
      composeGate: {
        id: POST_SEO_COMPOSE_GATE_ID,
        enabled: false,
        criteria: POST_SEO_COMPOSE_GATE_CRITERIA,
      },
    });
    cleanups.push(() => host.dispose());

    const declarations = getFunctionDeclarations().map((entry) => entry.name);
    expect(declarations).not.toContain('compose_panel');
    expect(getTool('compose_panel')).toBeUndefined();

    await expect(executeTool('compose_panel', { spec: MINIMAL_COMPOSE_SPEC })).resolves.toEqual({
      ok: false,
      error: 'unknown tool "compose_panel"',
    });
  });

  it('exposes compose_panel post-gate and accepts a valid spec', async () => {
    const host = createCanvasHost({
      engine: new FakeEngine(),
      panels: [SEO_SPEC_PANEL],
      composeGate: {
        id: POST_SEO_COMPOSE_GATE_ID,
        enabled: true,
        criteria: POST_SEO_COMPOSE_GATE_CRITERIA,
      },
    });
    cleanups.push(() => host.dispose());

    const declarations = getFunctionDeclarations().map((entry) => entry.name);
    expect(declarations).toContain('compose_panel');
    expect(getTool('compose_panel')).toBeDefined();

    const result = await executeTool('compose_panel', { spec: MINIMAL_COMPOSE_SPEC });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toMatchObject({ ok: true, panelId: expect.stringMatching(/^composed-/) });
    }
  });

  it('keeps the other five panel tools registered when compose is gated', () => {
    const host = createCanvasHost({
      engine: new FakeEngine(),
      panels: [SEO_SPEC_PANEL],
      composeGate: {
        id: POST_SEO_COMPOSE_GATE_ID,
        enabled: false,
        criteria: POST_SEO_COMPOSE_GATE_CRITERIA,
      },
    });
    cleanups.push(() => host.dispose());

    const declarations = getFunctionDeclarations().map((entry) => entry.name);
    for (const name of PANEL_TOOL_NAMES) {
      if (name === 'compose_panel') continue;
      expect(declarations).toContain(name);
    }
  });
});

describe('compose_panel runtime gate defense', () => {
  it('returns COMPOSE_GATE_CLOSED from runtime when gate evaluation is closed', async () => {
    const host = createCanvasHost({ engine: new FakeEngine(), panels: [SEO_SPEC_PANEL] });
    cleanups.push(() => host.dispose());
    const registry = createPanelRegistry(host.panels.definitions());
    const gate = evaluateComposeGate(
      {
        id: POST_SEO_COMPOSE_GATE_ID,
        enabled: false,
        criteria: POST_SEO_COMPOSE_GATE_CRITERIA,
      },
      registry);
    const runtime = createPanelToolRuntime(
      { panels: host.panels, catalog: host.catalog },
      registry,
      { composeGate: gate });

    const result = await runtime.composePanel(MINIMAL_COMPOSE_SPEC);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe(COMPOSE_GATE_CLOSED_CODE);
      expect(result.agentRepairEligible).toBe(false);
    }
  });
});
