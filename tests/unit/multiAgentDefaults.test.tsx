/**
 * multi-agent defaults — identity, attribution, per-agent HITL, scopes.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { defineSchemaPanel } from '../../src/panels/builder';
import { createCanvasHost, type EngineHandle, type EngineLifecycleEvent } from '../../src/panels/host';
import { createApprovalController } from '../../src/panels/approval';
import { ApprovalCard } from '../../src/panels/approval/ApprovalCard';
import {
  createPanelToolRuntime,
  createPanelToolsFromRegistry,
  type PanelToolRuntime,
} from '../../src/panels/tools';
import { createPanelRegistry } from '../../src/panels/registry';
import { registerMultiAgentDefaults, DEFAULT_MULTI_AGENT_PRESETS } from '../../src/agents/multiAgentDefaults';
import { createAgentRuntime } from '../../src/agents/runtime';
import { SCOPE_DENIED_CODE } from '../../src/agents/toolExecutor';
import type { JsonObject } from '../../src/panels/types';
import type { PendingApprovalRequest } from '../../src/panels/approval/types';

class FakeEngine implements EngineHandle {
  openRequests: string[] = [];
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

  openPanel(request: { panelId: string }): void {
    this.openRequests.push(request.panelId);
  }
}

const SEO_PANEL = defineSchemaPanel({
  id: 'site-seo',
  meta: {
    title: 'SEO',
    schemaVersion: 1,
    agentDescription: 'Edit SEO settings.',
    contextKinds: ['site'],
  },
  sources: {
    seo: { source: 'site.seo', params: {} },
  },
  actions: {
    save: { kind: 'mutate', source: 'site.seo', op: 'update', mutates: true, label: 'Save SEO' },
  },
  blocks: [
    {
      block: 'form',
      bind: 'seo',
      fields: [
        { bind: 'title', type: 'text', label: 'Title' },
        { bind: 'description', type: 'textarea', label: 'Description' },
      ],
    },
    { block: 'actions', actions: ['save'] },
  ],
} as const satisfies Parameters<typeof defineSchemaPanel>[0]);

const CONTENT_PANEL = defineSchemaPanel({
  id: 'site-content',
  meta: {
    title: 'Content',
    schemaVersion: 1,
    agentDescription: 'Edit page content.',
    contextKinds: ['page'],
  },
  sources: {
    content: { source: 'site.content', params: {} },
  },
  actions: {
    publish: { kind: 'mutate', source: 'site.content', op: 'publish', mutates: true, label: 'Publish' },
  },
  blocks: [
    {
      block: 'form',
      bind: 'content',
      fields: [{ bind: 'headline', type: 'text', label: 'Headline' }],
    },
    { block: 'actions', actions: ['publish'] },
  ],
} as const satisfies Parameters<typeof defineSchemaPanel>[0]);

function buildMultiAgentHost (){
  const engine = new FakeEngine();
  const host = createCanvasHost({
    engine,
    panels: [SEO_PANEL, CONTENT_PANEL],
  });

  registerMultiAgentDefaults(host.agents, [
    {
      id: 'editor',
      kind: 'chat',
      label: 'Content Editor',
      transport: 'chat',
      allowedTools: ['open_panel', 'fill_panel', 'run_panel_action', 'list_panels'],
      allowedPanels: ['site-seo', 'site-content'],
    },
    {
      id: 'concierge',
      kind: 'voice',
      label: 'Voice Concierge',
      transport: 'voice',
      allowedTools: ['list_panels', 'open_panel', 'fill_panel'],
      allowedPanels: ['site-content'],
    },
  ]);

  return { host, engine };
}

describe(' multi-agent defaults ', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop?.();
    }
  });

  it('runs two agents editing different panels with activity attribution', async () => {
    const { host } = buildMultiAgentHost;
    cleanups.push(() => host.dispose);

    expect(
      (await host.agents.executeTool(
        'open_panel',
        { id: 'site-seo' },
        { agentId: 'editor', agentLabel: 'Content Editor' })).ok).toBe(true);

    expect(
      (await host.agents.executeTool(
        'open_panel',
        { id: 'site-content' },
        { agentId: 'concierge', agentLabel: 'Voice Concierge' })).ok).toBe(true);

    expect(
      (await host.agents.executeTool(
        'fill_panel',
        { id: 'site-seo', patch: { title: 'SEO by editor' } },
        { agentId: 'editor', agentLabel: 'Content Editor' })).ok).toBe(true);

    expect(
      (await host.agents.executeTool(
        'fill_panel',
        { id: 'site-content', patch: { headline: 'Headline by concierge' } },
        { agentId: 'concierge', agentLabel: 'Voice Concierge' })).ok).toBe(true);

    const activity = host.agents.activity.getEntries({ limit: 20 });
    expect(activity.filter((entry) => entry.actor === 'agent:editor').length).toBeGreaterThanOrEqual(2);
    expect(activity.filter((entry) => entry.actor === 'agent:concierge').length).toBeGreaterThanOrEqual(2);
  });

  it('attributes HITL approval cards to the acting agent', async () => {
    const { host } = buildMultiAgentHost;
    cleanups.push(() => host.dispose);
    const controller = host.approvals;

    const opened = await host.agents.executeTool(
      'open_panel',
      { id: 'site-seo' },
      { agentId: 'editor', agentLabel: 'Content Editor' });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const panelId =
      typeof opened.result === 'object' &&
      opened.result !== null &&
      'panelId' in opened.result &&
      typeof (opened.result as { panelId: unknown }).panelId === 'string'
        ? (opened.result as { panelId: string }).panelId: 'site-seo-1';

    const pendingPromise = host.agents.executeTool(
      'run_panel_action',
      { panelId, actionId: 'save', payload: { title: 'New title' } },
      { agentId: 'editor', agentLabel: 'Content Editor' });

    await Promise.resolve();
    const pending = controller.getPendingForAgent('editor');
    expect(pending).toHaveLength(1);
    expect(pending[0]?.agentId).toBe('editor');
    expect(pending[0]?.agentLabel).toBe('Content Editor');

    render(<ApprovalCard request={pending[0] ?? null} />);
    expect(screen.getByTestId('approval-agent-badge')).toHaveAttribute('data-agent-id', 'editor');
    expect(screen.getByTestId('approval-agent-badge').textContent).toContain('Content Editor');

    controller.resolve(pending[0]!.id, 'approved');
    const result = await pendingPromise;
    expect(result.ok).toBe(true);
  });

  it('keeps per-agent HITL queues isolated on the same panel', async () => {
    const controller = createApprovalController();
    const registry = createPanelRegistry([SEO_PANEL, CONTENT_PANEL]);
    const runtime: PanelToolRuntime = createPanelToolRuntime(
      {
        panels: { open: async () => {}, has: registry.has },
        catalog: new Map(),
      },
      registry,
      { approvalController: controller });
    cleanups.push(() => runtime.dispose);

    const agents = createAgentRuntime({
      activity: runtime.undoReversal.activity,
      tools: createPanelToolsFromRegistry(registry, runtime),
      resolvePanelDefinitionId: (panelId) => runtime.resolveDefinitionId(panelId),
    });

    agents.register({ id: 'editor-a', kind: 'chat', label: 'Editor A', transport: 'chat' });
    agents.register({ id: 'editor-b', kind: 'chat', label: 'Editor B', transport: 'chat' });

    await agents.executeTool('open_panel', { id: 'site-seo' }, { agentId: 'editor-a', agentLabel: 'Editor A' });
    const opened = await runtime.openPanel('site-seo');
    expect(opened.ok).toBe(true);
    const panelId = opened.ok ? opened.panelId: '';

    void agents.executeTool(
      'run_panel_action',
      { panelId, actionId: 'save', payload: { title: 'From A' } },
      { agentId: 'editor-a', agentLabel: 'Editor A' });
    void agents.executeTool(
      'run_panel_action',
      { panelId, actionId: 'save', payload: { title: 'From B' } },
      { agentId: 'editor-b', agentLabel: 'Editor B' });
    await Promise.resolve();

    expect(controller.getPendingForAgent('editor-a')).toHaveLength(1);
    expect(controller.getPendingForAgent('editor-b')).toHaveLength(1);
    expect(controller.getPendingForPanel(panelId)).toHaveLength(2);
    expect(controller.getPendingForAgent('editor-a')[0]?.agentId).toBe('editor-a');
    expect(controller.getPendingForAgent('editor-b')[0]?.agentId).toBe('editor-b');
  });

  it('refuses out-of-scope tool and panel calls', async () => {
    const { host } = buildMultiAgentHost;
    cleanups.push(() => host.dispose);

    const toolDenied = await host.agents.executeTool(
      'run_panel_action',
      { panelId: 'site-seo-1', actionId: 'save' },
      { agentId: 'concierge', agentLabel: 'Voice Concierge' });
    expect(toolDenied.ok).toBe(false);
    if (toolDenied.ok) return;
    expect(toolDenied.error).toContain(SCOPE_DENIED_CODE);

    await host.agents.executeTool(
      'open_panel',
      { id: 'site-content' },
      { agentId: 'concierge', agentLabel: 'Voice Concierge' });

    const panelDenied = await host.agents.executeTool(
      'fill_panel',
      { id: 'site-seo', patch: { title: 'blocked' } },
      { agentId: 'concierge', agentLabel: 'Voice Concierge' });
    expect(panelDenied.ok).toBe(false);
    if (panelDenied.ok) return;
    expect(panelDenied.error).toContain(SCOPE_DENIED_CODE);
  });

  it('lists two registered agents in digest input', () => {
    const { host } = buildMultiAgentHost;
    cleanups.push(() => host.dispose);

    const agents = host.agents.registry.list;
    expect(agents.map((entry) => entry.id).sort()).toEqual(['concierge', 'editor']);

    const digest = host.agents.digest.compile({
      user: { id: 'test-user' },
      contexts: [],
      agents: agents.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        label: entry.label,
        status: entry.status,
      })),
      recentActivity: host.agents.activity.getEntries({ limit: 5 }),
    }).digest;

    expect(digest.agents.map((entry) => entry.id).sort()).toEqual(['concierge', 'editor']);
  });

  it('registerMultiAgentDefaults registers standing presets', () => {
    const { host } = buildMultiAgentHost;
    cleanups.push(() => host.dispose);
    expect(DEFAULT_MULTI_AGENT_PRESETS.length).toBeGreaterThanOrEqual(2);
    expect(host.agents.registry.get('editor')?.label).toBe('Content Editor');
    expect(host.agents.registry.get('concierge')?.allowedTools).toContain('list_panels');
  });
});

describe('multi-agent field attribution markers', () => {
  it('records per-field agent metadata on fill_panel', async () => {
    const registry = createPanelRegistry([SEO_PANEL]);
    const runtime = createPanelToolRuntime(
      {
        panels: { open: async () => {}, has: registry.has },
        catalog: new Map(),
      },
      registry);

    const agents = createAgentRuntime({
      activity: runtime.undoReversal.activity,
      tools: createPanelToolsFromRegistry(registry, runtime),
      resolvePanelDefinitionId: (panelId) => runtime.resolveDefinitionId(panelId),
    });

    agents.register({
      id: 'editor',
      kind: 'chat',
      label: 'Content Editor',
      transport: 'chat',
      allowedTools: ['open_panel', 'fill_panel'],
      allowedPanels: ['site-seo'],
    });

    const opened = await runtime.openPanel('site-seo');
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const fillResult = await agents.executeTool(
      'fill_panel',
      { id: 'site-seo', patch: { title: 'Attributed title' } },
      { agentId: 'editor', agentLabel: 'Content Editor' });
    expect(fillResult.ok).toBe(true);

    const attribution = runtime.getFieldAttribution(opened.panelId);
    expect(attribution.get('title')).toEqual({
      agentId: 'editor',
      agentLabel: 'Content Editor',
    });

    runtime.dispose();
  });
});

function buildPendingRequest(overrides: Partial<PendingApprovalRequest> = {}): PendingApprovalRequest {
  return {
    id: 'approval-1',
    panelId: 'site-seo-1',
    definitionId: 'site-seo',
    actionId: 'save',
    actionLabel: 'Save SEO',
    destructive: false,
    payload: {},
    currentData: {},
    diff: [],
    actor: 'agent:editor',
    agentId: 'editor',
    agentLabel: 'Content Editor',
    phase: 'review',
    reversible: true,
    createdAt: new Date().toISOString(),...overrides,
  };
}

describe('ApprovalCard agent attribution chrome', () => {
  it('renders agent badge on review and destructive cards', () => {
    const { rerender } = render(<ApprovalCard request={buildPendingRequest} />);
    expect(screen.getByTestId('approval-agent-badge')).toBeTruthy();

    rerender(
      <ApprovalCard
        request={buildPendingRequest({ destructive: true, phase: 'destructive_confirm' })}
      />);
    expect(screen.getByTestId('approval-agent-badge')).toBeTruthy();
  });
});
