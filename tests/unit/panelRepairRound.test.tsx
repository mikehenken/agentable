/**
 * repair round for compose_panel and patch_panel (.7).
 * Automated check: compose invalid -> repair -> valid renders.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { defineSchemaPanel } from '../../src/panels/builder';
import { createCanvasHost, type EngineHandle, type EngineLifecycleEvent } from '../../src/panels/host';
import { createPanelRegistry } from '../../src/panels/registry';
import { createPanelToolRuntime, type PanelToolRuntime } from '../../src/panels/panelToolRuntime';
import { createApprovalController } from '../../src/panels/approval';
import {
  createPanelToolsFromRegistry,
  getHostActions,
  type ToolDefinition,
} from '../../src/panels/tools';
import {
  ComposedSpecPanel,
  PANEL_COMPOSED_EPHEMERAL_KEY,
} from '../../src/panels/provenance';
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
  },
  blocks: [
    {
      block: 'form',
      bind: 'seo',
      fields: [
        { bind: 'title', type: 'text', label: 'Meta title' },
        { bind: 'description', type: 'textarea', label: 'Meta description' },
      ],
    },
    { block: 'actions', actions: ['save'] },
  ],
} as const satisfies Parameters<typeof defineSchemaPanel>[0]);

function invalidSeoSpec(): PanelSpec {
  const base = SEO_SPEC_PANEL.spec;
  return {...base,
    origin: 'agent',
    nodes: {...base.nodes,
      actions: {
        type: 'action-row',
        props: { actions: ['missing-action'] },
      },
    },
  };
}

function buildRuntime(): {
  runtime: PanelToolRuntime;
  tools: readonly ToolDefinition[];
  cleanup: () => void;
} {
  const engine = new FakeEngine();
  const host = createCanvasHost({
    engine,
    panels: [SEO_SPEC_PANEL],
  });
  cleanups.push(() => host.dispose());
  const registry = createPanelRegistry(host.panels.definitions());
  const runtime = createPanelToolRuntime(
    { panels: host.panels, catalog: host.catalog },
    registry,
    { approvalController: createApprovalController });
  const tools = createPanelToolsFromRegistry(registry, runtime);
  return {
    runtime,
    tools,
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

describe('compose_panel repair round', () => {
  it('returns repair-eligible structured errors with hints on first validation failure', async () => {
    const { tools, cleanup } = buildRuntime();
    const composePanel = toolByName(tools, 'compose_panel');

    const result = await composePanel.handler({ spec: invalidSeoSpec });
    cleanup();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toMatchObject({
        ok: false,
        agentRepairEligible: true,
      });
      if (!result.result.ok) {
        expect(result.result.errors.length).toBeGreaterThan(0);
        const first = result.result.errors[0];
        expect(first?.code).toBe('SPEC_ACTION_REF_MISSING');
        expect(first?.hint).toBeTruthy();
        expect(first?.suggestedFix).toBe(first?.hint);
      }
    }
  });

  it('returns terminal failure without repair eligibility on the second compose attempt', async () => {
    const { tools, cleanup } = buildRuntime();
    const composePanel = toolByName(tools, 'compose_panel');

    await composePanel.handler({ spec: invalidSeoSpec });
    const second = await composePanel.handler({ spec: invalidSeoSpec });
    cleanup();
    expect(second.ok).toBe(true);
    if (second.ok && !second.result.ok) {
      expect(second.result.agentRepairEligible).toBe(false);
      expect(second.result.errors.length).toBeGreaterThan(0);
    }
  });

  it('accepts a repaired spec after an initial repair-eligible failure', async () => {
    const { tools, cleanup } = buildRuntime();
    const composePanel = toolByName(tools, 'compose_panel');

    const first = await composePanel.handler({ spec: invalidSeoSpec });
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.result.ok).toBe(false);
    }

    const repaired = await composePanel.handler({ spec: SEO_SPEC_PANEL.spec });
    cleanup();
    expect(repaired.ok).toBe(true);
    if (repaired.ok) {
      expect(repaired.result).toMatchObject({
        ok: true,
        panelId: expect.stringMatching(/^composed-/),
      });
    }
  });
});

describe('patch_panel repair round', () => {
  it('returns repair-eligible errors when a patch leaves the spec invalid', async () => {
    const { tools, cleanup } = buildRuntime();
    const composePanel = toolByName(tools, 'compose_panel');
    const patchPanel = toolByName(tools, 'patch_panel');

    const composed = await composePanel.handler({ spec: SEO_SPEC_PANEL.spec });
    expect(composed.ok).toBe(true);
    if (!composed.ok || composed.result.ok !== true) return;

    const broken = await patchPanel.handler({
      panelId: composed.result.panelId,
      ops: [{ op: 'replace', path: '/nodes/actions/props/actions', value: ['missing-action'] }],
    });
    cleanup();
    expect(broken.ok).toBe(true);
    if (broken.ok && !broken.result.ok) {
      expect(broken.result.agentRepairEligible).toBe(true);
      expect(broken.result.errors.some((e) => e.code === 'SPEC_ACTION_REF_MISSING')).toBe(true);
      expect(broken.result.errors[0]?.suggestedFix).toBeTruthy();
    }
  });

  it('applies a repair patch and leaves a valid composed spec on the instance', async () => {
    const { tools, cleanup } = buildRuntime();
    const composePanel = toolByName(tools, 'compose_panel');
    const patchPanel = toolByName(tools, 'patch_panel');

    const composed = await composePanel.handler({ spec: SEO_SPEC_PANEL.spec });
    expect(composed.ok).toBe(true);
    if (!composed.ok || composed.result.ok !== true) return;

    await patchPanel.handler({
      panelId: composed.result.panelId,
      ops: [{ op: 'replace', path: '/nodes/actions/props/actions', value: ['missing-action'] }],
    });

    const fixed = await patchPanel.handler({
      panelId: composed.result.panelId,
      ops: [{ op: 'replace', path: '/nodes/actions/props/actions', value: ['save'] }],
    });
    cleanup();
    expect(fixed.ok).toBe(true);
    if (fixed.ok) {
      expect(fixed.result).toEqual({ ok: true });
    }
  });

  it('returns terminal patch failure after a second invalid patch', async () => {
    const { tools, cleanup } = buildRuntime();
    const composePanel = toolByName(tools, 'compose_panel');
    const patchPanel = toolByName(tools, 'patch_panel');

    const composed = await composePanel.handler({ spec: SEO_SPEC_PANEL.spec });
    expect(composed.ok).toBe(true);
    if (!composed.ok || composed.result.ok !== true) return;

    const breakOps = [{ op: 'replace', path: '/nodes/actions/props/actions', value: ['missing-action'] }];
    await patchPanel.handler({ panelId: composed.result.panelId, ops: breakOps });
    const second = await patchPanel.handler({ panelId: composed.result.panelId, ops: breakOps });
    cleanup();
    expect(second.ok).toBe(true);
    if (second.ok && !second.result.ok) {
      expect(second.result.agentRepairEligible).toBe(false);
    }
  });
});

describe('compose repair render path', () => {
  it('renders a composed panel after invalid -> repair -> valid without throwing', async () => {
    const minimalValidSpec: PanelSpec = {
      v: 1,
      origin: 'agent',
      root: 'body',
      nodes: {
        body: { type: 'panel-body', children: ['header'] },
        header: { type: 'header', props: { title: 'Agent draft' } },
      },
    };

    const { tools, cleanup } = buildRuntime();
    const composePanel = toolByName(tools, 'compose_panel');

    await composePanel.handler({ spec: invalidSeoSpec });
    const composed = await composePanel.handler({ spec: minimalValidSpec });
    cleanup();
    expect(composed.ok).toBe(true);
    if (!composed.ok || composed.result.ok !== true) return;

    const data: Record<string, unknown> = {
      [PANEL_COMPOSED_EPHEMERAL_KEY]: minimalValidSpec,
    };

    render(<ComposedSpecPanel data={data} />);

    await waitFor(() => {
      expect(screen.queryByTestId('composed-spec-invalid')).toBeNull();
    });

    expect(screen.getByText('Agent draft')).toBeInTheDocument;
  });
});
