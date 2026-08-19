/**
 * describe_panel read-only introspection tool.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { defineSchemaPanel } from '../../src/panels/builder';
import { createCanvasHost, type EngineHandle, type EngineLifecycleEvent } from '../../src/panels/host';
import { createPanelRegistry } from '../../src/panels/registry';
import { createPanelToolRuntime } from '../../src/panels/panelToolRuntime';
import { createApprovalController } from '../../src/panels/approval';
import {
  createPanelToolsFromRegistry,
  getHostActions,
  PANEL_INTROSPECTION_TOOL_NAMES,
  PANEL_TOOL_NAMES,
  type ToolDefinition,
} from '../../src/panels/tools';
import type { JsonObject } from '../../src/panels/types';

class FakeEngine implements EngineHandle {
  private ready = true;
  private listeners: Record<EngineLifecycleEvent, Set<() => void>> = {
    ready: new Set(),
    change: new Set(),
  };

  get isReady(): boolean {
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

function buildRuntime(): {
  tools: readonly ToolDefinition[];
  cleanup: () => void;
} {
  const host = createCanvasHost({
    engine: new FakeEngine,
    panels: [SEO_SPEC_PANEL],
  });
  cleanups.push(() => host.dispose);
  const registry = createPanelRegistry(host.panels.definitions);
  const runtime = createPanelToolRuntime(
    { panels: host.panels, catalog: host.catalog },
    registry,
    { approvalController: createApprovalController });
  return {
    tools: createPanelToolsFromRegistry(registry, runtime),
    cleanup: () => {},
  };
}

function toolByName(tools: readonly ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find((entry) => entry.declaration.name === name);
  if (tool === undefined) {
    throw new Error(`missing tool ${name}`);
  }
  return tool;
}

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop?.();
  }
  expect(getHostActions()).toEqual([]);
});

describe('describe_panel tool registration', () => {
  it('registers describe_panel as the seventh read-only tool', () => {
    const { tools, cleanup } = buildRuntime;
    cleanup();
    expect(tools.map((tool) => tool.declaration.name)).toEqual([...PANEL_TOOL_NAMES]);
    expect(PANEL_INTROSPECTION_TOOL_NAMES).toEqual(['describe_panel']);
    expect(toolByName(tools, 'describe_panel').declaration.description).toContain('Read-only');
  });
});

describe('describe_panel handler', () => {
  it('describes a registered panel with metadata and curated examples', async () => {
    const { tools, cleanup } = buildRuntime;
    const describePanel = toolByName(tools, 'describe_panel');

    const result = await describePanel.handler({ panelId: 'site-seo' });
    cleanup();
    expect(result.ok).toBe(true);
    if (result.ok) {
      const payload = result.result as {
        kind: string;
        panelId: string;
        fields: unknown[];
        actions: unknown[];
        sources: unknown;
        curatedExamples: unknown[];
      };
      expect(payload.kind).toBe('panel');
      expect(payload.panelId).toBe('site-seo');
      expect(payload.fields.length).toBeGreaterThan(0);
      expect(payload.actions.length).toBeGreaterThan(0);
      expect(payload.sources).toBeDefined();
      expect(payload.curatedExamples.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('describes a catalog entry with props schema and curated examples', async () => {
    const { tools, cleanup } = buildRuntime;
    const describePanel = toolByName(tools, 'describe_panel');

    const result = await describePanel.handler({ catalogEntry: 'field-form' });
    cleanup();
    expect(result.ok).toBe(true);
    if (result.ok) {
      const payload = result.result as {
        kind: string;
        catalogEntry: string;
        propsSchema: { type: string; properties?: Record<string, unknown> };
        curatedExamples: unknown[];
      };
      expect(payload.kind).toBe('catalog');
      expect(payload.catalogEntry).toBe('field-form');
      expect(payload.propsSchema.type).toBe('object');
      expect(payload.propsSchema.properties?.bind).toBeDefined();
      expect(payload.curatedExamples.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('rejects missing target, unknown panel, unknown catalog, and both args', async () => {
    const { tools, cleanup } = buildRuntime;
    const describePanel = toolByName(tools, 'describe_panel');

    expect(await describePanel.handler({})).toEqual({
      ok: false,
      error: 'panelId or catalogEntry is required',
    });
    expect(await describePanel.handler({ panelId: 'missing', catalogEntry: 'header' })).toEqual({
      ok: false,
      error: 'provide panelId or catalogEntry, not both',
    });
    expect(await describePanel.handler({ panelId: 'missing-panel' })).toEqual({
      ok: false,
      error: 'unknown panel id "missing-panel"',
    });
    expect(await describePanel.handler({ catalogEntry: 'not-a-component' })).toEqual({
      ok: false,
      error: 'unknown catalog entry "not-a-component"',
    });
    cleanup();
  });
});
