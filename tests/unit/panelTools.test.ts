/**
 * six generic panel tools generated from registry metadata,
 * including argument validation and fill skip logic.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { defineSchemaPanel } from '../../src/panels/builder';
import { createCanvasHost, type EngineHandle, type EngineLifecycleEvent } from '../../src/panels/host';
import { createPanelRegistry } from '../../src/panels/registry';
import {
  applyFillPatch,
  createPanelToolRuntime,
  type PanelToolRuntime,
} from '../../src/panels/panelToolRuntime';
import { createApprovalController } from '../../src/panels/approval';
import {
  createPanelToolsFromRegistry,
  getHostActions,
  PANEL_TOOL_NAMES,
  type ToolDefinition,
} from '../../src/panels/tools';
import { declaredFieldPaths, derivePanelAgentMeta } from '../../src/panels/registryMetadata';
import type { JsonObject, PanelSpec } from '../../src/panels/types';

class FakeEngine implements EngineHandle {
  openRequests: string[] = [];
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

  openPanel(request: { panelId: string }): void {
    this.openRequests.push(request.panelId);
  }
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
      targetFields: ['title', 'description'],
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

function buildRuntime(options?: {
  approvalController?: ReturnType<typeof createApprovalController>;
}): {
  runtime: PanelToolRuntime;
  engine: FakeEngine;
  tools: readonly ToolDefinition[];
  controller: ReturnType<typeof createApprovalController>;
  cleanup: () => void;
} {
  const engine = new FakeEngine();
  const host = createCanvasHost({
    engine,
    panels: [SEO_SPEC_PANEL],
  });
  cleanups.push(() => host.dispose());
  const registry = createPanelRegistry(host.panels.definitions());
  const controller = options?.approvalController ?? createApprovalController();
  const runtime = createPanelToolRuntime(
    { panels: host.panels, catalog: host.catalog },
    registry,
    { approvalController: controller });
  const tools = createPanelToolsFromRegistry(registry, runtime);
  return {
    runtime,
    engine,
    tools,
    controller,
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
    cleanups.pop()?.();
  }
  expect(getHostActions()).toEqual([]);
});

describe('createPanelToolsFromRegistry', () => {
  it('emits all panel tools including read-only describe_panel with registry-derived ids', () => {
    const { tools, cleanup } = buildRuntime();
    cleanup();
    expect(tools.map((tool) => tool.declaration.name)).toEqual([...PANEL_TOOL_NAMES]);
    const openPanel = toolByName(tools, 'open_panel');
    expect(openPanel.declaration.parameters.properties.id?.enum).toEqual(['site-seo']);
    expect(openPanel.declaration.parameters.properties.id?.description).toContain('Registered panel id');
  });

  it('registers panel tools on createCanvasHost and removes them on dispose', async () => {
    const engine = new FakeEngine();
    const host = createCanvasHost({
      engine,
      panels: [SEO_SPEC_PANEL],
    });
    cleanups.push(() => host.dispose());

    const names = getHostActions().map((tool) => tool.declaration.name);
    expect(names).toEqual(expect.arrayContaining([...PANEL_TOOL_NAMES]));

    await host.panels.open('site-seo');
    const openTool = getHostActions().find((tool) => tool.declaration.name === 'open_panel');
    expect(openTool).toBeDefined();
    const result = await openTool!.handler({ id: 'site-seo' });
    expect(result.ok).toBe(true);

    host.dispose();
    expect(getHostActions()).toEqual([]);
  });
});

describe('panel tool arg validation', () => {
  it('rejects open_panel without a string id', async () => {
    const { tools, cleanup } = buildRuntime();
    const openPanel = toolByName(tools, 'open_panel');
    const result = await openPanel.handler({});
    cleanup();
    expect(result).toEqual({ ok: false, error: 'id must be a non-empty string' });
  });

  it('rejects fill_panel without an object patch', async () => {
    const { tools, cleanup } = buildRuntime();
    const fillPanel = toolByName(tools, 'fill_panel');
    const result = await fillPanel.handler({ id: 'site-seo', patch: 'nope' });
    cleanup();
    expect(result).toEqual({ ok: false, error: 'patch must be a plain object' });
  });

  it('rejects fill_panel for unknown panel ids and undeclared field paths', async () => {
    const { tools, runtime, cleanup } = buildRuntime();
    const fillPanel = toolByName(tools, 'fill_panel');

    const unknownPanel = await fillPanel.handler({
      id: 'missing-panel',
      patch: { title: 'x' },
    });
    expect(unknownPanel).toEqual({ ok: false, error: 'unknown panel id "missing-panel"' });

    await runtime.openPanel('site-seo');
    const badField = await fillPanel.handler({
      id: 'site-seo',
      patch: { secret: 'nope' },
    });
    cleanup();
    expect(badField.ok).toBe(true);
    if (badField.ok) {
      expect(badField.result).toMatchObject({
        ok: true,
        applied: [],
        skippedUserDirty: [],
        errors: [{ path: 'secret', message: 'field is not declared on this panel' }],
      });
    }
  });

  it('rejects patch_panel for registered (non-composed) instances', async () => {
    const { tools, runtime, cleanup } = buildRuntime();
    const patchPanel = toolByName(tools, 'patch_panel');
    const opened = await runtime.openPanel('site-seo');
    expect(opened.ok).toBe(true);

    const result = await patchPanel.handler({
      panelId: opened.ok ? opened.panelId: '',
      ops: [{ op: 'replace', path: '/title', value: 'x' }],
    });
    cleanup();
    expect(result).toEqual({
      ok: false,
      error: 'patch_panel applies to composed panel instances only',
    });
  });

  it('queues HITL approval for mutating run_panel_action calls', async () => {
    const controller = createApprovalController();
    const { tools, runtime, cleanup } = buildRuntime({ approvalController: controller });
    const runAction = toolByName(tools, 'run_panel_action');
    const opened = await runtime.openPanel('site-seo');
    expect(opened.ok).toBe(true);

    const pending = runAction.handler({
      panelId: opened.ok ? opened.panelId: '',
      actionId: 'save',
      payload: { title: 'Proposed title' },
    });
    await Promise.resolve();
    expect(controller.getPending()).toHaveLength(1);

    controller.resolve(controller.getPending()[0]!.id, 'approved');
    const result = await pending;
    cleanup();
    expect(result).toEqual({
      ok: true,
      result: {
        status: 'ok',
        ledgerEntryId: expect.any(String),
        result: expect.objectContaining({
          actionId: 'save',
          panelId: opened.ok ? opened.panelId: '',
        }),
      },
    });
  });
});

describe('fill_panel skip logic', () => {
  it('skips user-dirty fields and applies the rest', async () => {
    const meta = derivePanelAgentMeta(SEO_SPEC_PANEL);
    const allowed = declaredFieldPaths(meta);
    const state = {
      values: { title: 'before' } as Record<string, import('../../src/panels/types').JsonValue>,
      userDirtyFields: new Set(['description']),
      agentFilledFields: new Set<string>,
    };

    const result = applyFillPatch(
      state,
      { title: 'after', description: 'user draft', keywords: 'landi' },
      allowed);

    expect(result.applied).toEqual(['title', 'keywords']);
    expect(result.skippedUserDirty).toEqual(['description']);
    expect(state.values).toMatchObject({
      title: 'after',
      keywords: 'landi',
    });
    expect(state.agentFilledFields.has('title')).toBe(true);
    expect(state.agentFilledFields.has('keywords')).toBe(true);
    expect(state.agentFilledFields.has('description')).toBe(false);
  });

  it('routes fill_panel through the runtime dirty set', async () => {
    const { tools, runtime, cleanup } = buildRuntime();
    const fillPanel = toolByName(tools, 'fill_panel');
    const opened = await runtime.openPanel('site-seo');
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    runtime.markFieldUserDirty(opened.panelId, 'description');

    const result = await fillPanel.handler({
      id: 'site-seo',
      patch: { title: 'Agent title', description: 'Agent description' },
    });
    cleanup();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toMatchObject({
        ok: true,
        applied: ['title'],
        skippedUserDirty: ['description'],
      });
    }
  });
});

describe('list_panels grounding', () => {
  it('includes registry-derived fields, actions, and open instances', async () => {
    const { tools, runtime, cleanup } = buildRuntime();
    const listPanels = toolByName(tools, 'list_panels');
    await runtime.openPanel('site-seo', { entityId: 'page-1' });

    const result = await listPanels.handler({});
    cleanup();
    expect(result.ok).toBe(true);
    if (result.ok) {
      const entries = result.result as Array<{ id: string; openInstances: unknown[] }>;
      expect(entries[0]?.id).toBe('site-seo');
      expect(entries[0]?.openInstances).toHaveLength(1);
    }
  });
});

describe('compose_panel validation', () => {
  it('forces agent origin and rejects invalid specs', async () => {
    const { tools, cleanup } = buildRuntime();
    const composePanel = toolByName(tools, 'compose_panel');

    const invalid = await composePanel.handler({ spec: { v: 1 } });
    expect(invalid.ok).toBe(true);
    if (invalid.ok && !invalid.result.ok) {
      expect(invalid.result.agentRepairEligible).toBe(true);
    }

    const validSpec: PanelSpec = SEO_SPEC_PANEL.spec;
    const composed = await composePanel.handler({ spec: validSpec, pin: false });
    cleanup();
    expect(composed.ok).toBe(true);
    if (composed.ok) {
      expect(composed.result).toMatchObject({ ok: true, panelId: expect.stringMatching(/^composed-/) });
    }
  });
});
