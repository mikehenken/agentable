/**
 * Shared multi-agent acceptance scenario ( ).
 * Used by unit tests, browser harness, and node-side e2e verification.
 */
import { registerMultiAgentDefaults } from '../../../src/agents/multiAgentDefaults';
import { SCOPE_DENIED_CODE } from '../../../src/agents/toolExecutor';
import { defineSchemaPanel } from '../../../src/panels/builder';
import { createCanvasHost, type EngineHandle, type EngineLifecycleEvent } from '../../../src/panels/host';
import type { JsonObject } from '../../../src/panels/types';

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

export interface MultiAgentE2eCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface MultiAgentE2eResult {
  ok: boolean;
  checks: MultiAgentE2eCheck[];
}

export async function runMultiAgentE2eScenario(): Promise<MultiAgentE2eResult> {
  const checks: MultiAgentE2eCheck[] = [];

  const host = createCanvasHost({
    engine: new FakeEngine,
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

  try {
    const editorOpen = await host.agents.executeTool(
      'open_panel',
      { id: 'site-seo' },
      { agentId: 'editor', agentLabel: 'Content Editor' });
    const conciergeOpen = await host.agents.executeTool(
      'open_panel',
      { id: 'site-content' },
      { agentId: 'concierge', agentLabel: 'Voice Concierge' });
    checks.push({
      name: 'two agents open different panels',
      ok: editorOpen.ok && conciergeOpen.ok,
    });

    const editorFill = await host.agents.executeTool(
      'fill_panel',
      { id: 'site-seo', patch: { title: 'SEO by editor' } },
      { agentId: 'editor', agentLabel: 'Content Editor' });
    const conciergeFill = await host.agents.executeTool(
      'fill_panel',
      { id: 'site-content', patch: { headline: 'Headline by concierge' } },
      { agentId: 'concierge', agentLabel: 'Voice Concierge' });
    checks.push({
      name: 'two agents fill different panels',
      ok: editorFill.ok && conciergeFill.ok,
    });

    const activity = host.agents.activity.getEntries({ limit: 20 });
    const editorEvents = activity.filter((entry) => entry.actor === 'agent:editor').length;
    const conciergeEvents = activity.filter((entry) => entry.actor === 'agent:concierge').length;
    checks.push({
      name: 'activity log attributes both agents',
      ok: editorEvents >= 2 && conciergeEvents >= 2,
      detail: `editor=${editorEvents}, concierge=${conciergeEvents}`,
    });

    const seoOpen = await host.agents.executeTool(
      'open_panel',
      { id: 'site-seo' },
      { agentId: 'editor', agentLabel: 'Content Editor' });
    const seoPanelId =
      seoOpen.ok &&
      typeof seoOpen.result === 'object' &&
      seoOpen.result !== null &&
      'panelId' in seoOpen.result &&
      typeof (seoOpen.result as { panelId: unknown }).panelId === 'string'
        ? (seoOpen.result as { panelId: string }).panelId: 'site-seo-1';

    void host.agents.executeTool(
      'run_panel_action',
      { panelId: seoPanelId, actionId: 'save', payload: { title: 'New title' } },
      { agentId: 'editor', agentLabel: 'Content Editor' });
    await Promise.resolve();
    const pending = host.approvals.getPendingForAgent('editor');
    checks.push({
      name: 'HITL card attributed to acting agent',
      ok:
        pending.length === 1 &&
        pending[0]?.agentId === 'editor' &&
        pending[0]?.agentLabel === 'Content Editor',
    });
    if (pending[0] !== undefined) {
      host.approvals.resolve(pending[0].id, 'approved');
    }

    const scopeDenied = await host.agents.executeTool(
      'run_panel_action',
      { panelId: seoPanelId, actionId: 'save' },
      { agentId: 'concierge', agentLabel: 'Voice Concierge' });
    checks.push({
      name: 'out-of-scope tool call refused',
      ok: !scopeDenied.ok && (scopeDenied.error?.includes(SCOPE_DENIED_CODE) ?? false),
      detail: scopeDenied.ok ? 'expected refusal': scopeDenied.error,
    });

    const registered = host.agents.registry.list.map((entry) => entry.id).sort();
    checks.push({
      name: 'two agents registered in digest input',
      ok: registered.join(',') === 'concierge,editor',
      detail: registered.join(','),
    });
  } finally {
    host.dispose();
  }

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}
