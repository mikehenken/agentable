/**
 * frozen repair vocabulary + compose/patch rejection codes.
 * Automated check: repair rejections match the frozen error-code vocabulary (snapshot).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { defineSchemaPanel } from '../../src/panels/builder';
import { createCanvasHost, type EngineHandle, type EngineLifecycleEvent } from '../../src/panels/host';
import { createPanelRegistry } from '../../src/panels/registry';
import { createPanelToolRuntime } from '../../src/panels/panelToolRuntime';
import { createApprovalController } from '../../src/panels/approval';
import {
  COMPOSE_GATE_CLOSED_CODE,
  FROZEN_REPAIR_ERROR_CODES,
  SPEC_ERROR_CODES,
  isFrozenRepairErrorCode,
  type SpecErrorCode,
} from '../../src/panels/spec';
import {
  createPanelToolsFromRegistry,
  getHostActions,
  PANEL_TOOL_COST_CLASS,
  PANEL_TOOL_NAMES,
  type ComposeGateEvaluation,
  type ToolDefinition,
} from '../../src/panels/tools';
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

function buildRuntime(options?: { composeGate?: ComposeGateEvaluation }): {
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
    {
      approvalController: createApprovalController(),
      composeGate: options?.composeGate,
    });
  const tools = createPanelToolsFromRegistry(registry, runtime, {
    composeGate: options?.composeGate,
  });
  return { tools, cleanup: () => {} };
}

function toolByName(tools: readonly ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find((entry) => entry.declaration.name === name);
  if (tool === undefined) {
    throw new Error(`missing tool ${name}`);
  }
  return tool;
}

function collectErrorCodes(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.errors)) return [];
  return record.errors.filter((entry): entry is { code?: unknown } => typeof entry === 'object' && entry !== null).map((entry) => entry.code).filter((code): code is string => typeof code === 'string');
}

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
  expect(getHostActions()).toEqual([]);
});

describe('frozen repair vocabulary', () => {
  it('matches the canonical sorted snapshot', () => {
    expect([...FROZEN_REPAIR_ERROR_CODES].sort()).toMatchSnapshot();
  });

  it('covers every SpecErrorCode union member', () => {
    const unionCoverage: Record<SpecErrorCode, true> = Object.fromEntries(
      SPEC_ERROR_CODES.map((code) => [code, true]),
    ) as Record<SpecErrorCode, true>;
    expect(Object.keys(unionCoverage).sort()).toEqual([...SPEC_ERROR_CODES].sort());
  });

  it('includes only codes emitted by validate.ts issue calls', () => {
    const source = readFileSync(
      resolve(__dirname, '../../src/panels/spec/validate.ts'),
      'utf8');
    const emitted = new Set<string>();
    for (const match of source.matchAll(/issue\(\s*'([A-Z0-9_]+)'/g)) {
      emitted.add(match[1]!);
    }
    expect(emitted.size).toBeGreaterThan(0);
    for (const code of emitted) {
      expect(isFrozenRepairErrorCode(code)).toBe(true);
    }
  });

  it('includes panel tool rejection codes used by compose/patch runtime', () => {
    const source = readFileSync(
      resolve(__dirname, '../../src/panels/panelToolRuntime.ts'),
      'utf8');
    const emitted = new Set<string>();
    for (const match of source.matchAll(/code:\s*'([A-Z0-9_]+)'/g)) {
      emitted.add(match[1]!);
    }
    expect(emitted.size).toBeGreaterThan(0);
    for (const code of emitted) {
      expect(isFrozenRepairErrorCode(code)).toBe(true);
    }
  });

  it('compose_panel validation rejections use only frozen codes', async () => {
    const { tools, cleanup } = buildRuntime();
    const composePanel = toolByName(tools, 'compose_panel');
    const result = await composePanel.handler({ spec: invalidSeoSpec() });
    cleanup();
    expect(result.ok).toBe(true);
    if (result.ok && !result.result.ok) {
      for (const code of collectErrorCodes(result.result)) {
        expect(isFrozenRepairErrorCode(code)).toBe(true);
      }
    }
  });

  it('patch_panel validation rejections use only frozen codes', async () => {
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
      for (const code of collectErrorCodes(broken.result)) {
        expect(isFrozenRepairErrorCode(code)).toBe(true);
      }
    }
  });

  it('compose gate rejections use COMPOSE_GATE_CLOSED from the frozen set', async () => {
    const engine = new FakeEngine();
    const host = createCanvasHost({ engine, panels: [SEO_SPEC_PANEL] });
    cleanups.push(() => host.dispose());
    const registry = createPanelRegistry(host.panels.definitions());
    const runtime = createPanelToolRuntime(
      { panels: host.panels, catalog: host.catalog },
      registry,
      {
        approvalController: createApprovalController(),
        composeGate: {
          id: 'test-gate',
          open: false,
          code: COMPOSE_GATE_CLOSED_CODE,
          reason: 'compose_panel is gated for test',
        },
      });

    const result = await runtime.composePanel(SEO_SPEC_PANEL.spec);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      for (const code of result.errors.map((entry) => entry.code)) {
        expect(isFrozenRepairErrorCode(code)).toBe(true);
      }
      expect(result.errors[0]?.code).toBe(COMPOSE_GATE_CLOSED_CODE);
    }
  });
});

describe('panel tool costClass declarations ', () => {
  it('assigns costClass on every panel tool declaration', () => {
    const { tools, cleanup } = buildRuntime();
    cleanup();
    for (const name of PANEL_TOOL_NAMES) {
      const tool = toolByName(tools, name);
      expect(tool.declaration.costClass).toBe(PANEL_TOOL_COST_CLASS[name]);
    }
  });

  it('marks compose_panel expensive and typical tools cheap', () => {
    expect(PANEL_TOOL_COST_CLASS.compose_panel).toBe('expensive');
    expect(PANEL_TOOL_COST_CLASS.list_panels).toBe('cheap');
    expect(PANEL_TOOL_COST_CLASS.describe_panel).toBe('cheap');
    expect(PANEL_TOOL_COST_CLASS.run_panel_action).toBe('cheap');
  });
});
