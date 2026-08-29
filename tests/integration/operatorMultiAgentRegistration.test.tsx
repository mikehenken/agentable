/**
 * integration: canvas-wide operator registration coexists with scoped
 * page agents — attribution, leases, and per-agent HITL remain correct.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { defineSchemaPanel } from '../../src/panels/builder';
import { createCanvasHost, type EngineHandle, type EngineLifecycleEvent } from '../../src/panels/host';
import { ApprovalCard } from '../../src/panels/approval/ApprovalCard';
import { registerMultiAgentDefaults } from '../../src/agents/multiAgentDefaults';
import {
  bindOperatorModeEnforcement,
  resetOperatorModeBridgeForTests,
  unbindOperatorModeEnforcement,
} from '../../src/agents/surface/operatorModeBridge';
import {
  bindOperatorRegistration,
  OPERATOR_TOOL_CONTEXT,
  resetOperatorRegistrationBridgeForTests,
  setOperatorRegistrationRuntime,
  unbindOperatorRegistration,
} from '../../src/agents/surface/operatorRegistrationBridge';
import {
  OPERATOR_AGENT_ID,
  OPERATOR_LABEL,
  OPERATOR_LEASE_SCOPE,
  OPERATOR_REGISTRY_SCOPE,
} from '../../src/agents/surface/constants';
import { SCOPE_DENIED_CODE } from '../../src/agents/toolExecutor';
import type { JsonObject } from '../../src/panels/types';

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
      fields: [{ bind: 'title', type: 'text', label: 'Title' }],
    },
    { block: 'actions', actions: ['save'] },
  ],
} as const satisfies Parameters<typeof defineSchemaPanel>[0]);

function buildCoexistenceHost (){
  const engine = new FakeEngine();
  const host = createCanvasHost({
    engine,
    panels: [SEO_PANEL],
  });

  registerMultiAgentDefaults(host.agents, [
    {
      id: 'editor',
      kind: 'chat',
      label: 'Content Editor',
      transport: 'chat',
      allowedTools: ['open_panel', 'fill_panel', 'run_panel_action', 'list_panels'],
      allowedPanels: ['site-seo'],
    },
  ]);

  return { host, engine };
}

describe('operator multi-agent registration ', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    unbindOperatorRegistration();
    unbindOperatorModeEnforcement();
    resetOperatorRegistrationBridgeForTests();
    resetOperatorModeBridgeForTests();
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it('coexists with a scoped agent: operator ask denies operator mutations, scoped agent unaffected', async () => {
    const { host } = buildCoexistenceHost();
    cleanups.push(() => host.dispose());

    bindOperatorModeEnforcement('ask');
    bindOperatorRegistration('ask');

    const opened = await host.agents.executeTool(
      'open_panel',
      { id: 'site-seo' },
      { agentId: 'editor', agentLabel: 'Content Editor' });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const scopedFill = await host.agents.executeTool(
      'fill_panel',
      { id: 'site-seo', patch: { title: 'Scoped title' } },
      { agentId: 'editor', agentLabel: 'Content Editor' });
    expect(scopedFill.ok).toBe(true);

    const operatorDenied = await host.agents.executeTool(
      'fill_panel',
      { id: 'site-seo', patch: { title: 'Operator blocked' } },
      OPERATOR_TOOL_CONTEXT);
    expect(operatorDenied.ok).toBe(false);
    if (operatorDenied.ok) return;
    expect(operatorDenied.error).toContain(SCOPE_DENIED_CODE);

    const registryIds = host.agents.registry.list().map((entry) => entry.id).sort();
    expect(registryIds).toEqual(['editor', OPERATOR_AGENT_ID]);

    const operatorEntry = host.agents.registry.get(OPERATOR_AGENT_ID);
    expect(operatorEntry?.scope).toBe(OPERATOR_REGISTRY_SCOPE);
    expect(operatorEntry?.label).toBe(OPERATOR_LABEL);
    expect(operatorEntry?.transport).toBe('operator-surface');

    const activity = host.agents.activity.getEntries({ limit: 20 });
    expect(activity.some((entry) => entry.actor === 'agent:editor' && entry.verb === 'tool_call')).toBe(
      true);
    expect(
      activity.some(
        (entry) =>
          entry.actor === 'agent:operator' &&
          (entry.verb === 'operator_mode_scope_denied' || entry.verb === 'tool_scope_denied'))).toBe(true);
    expect(activity.some((entry) => entry.verb === 'operator_registered')).toBe(true);
  });

  it('attributes HITL pending approvals to the originating agent while operator is registered', async () => {
    const { host } = buildCoexistenceHost();
    cleanups.push(() => host.dispose());

    bindOperatorModeEnforcement('build');
    bindOperatorRegistration('build');

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

    const editorPendingPromise = host.agents.executeTool(
      'run_panel_action',
      { panelId, actionId: 'save', payload: { title: 'Editor save' } },
      { agentId: 'editor', agentLabel: 'Content Editor' });

    await Promise.resolve();

    const operatorPendingPromise = host.agents.executeTool(
      'run_panel_action',
      { panelId, actionId: 'save', payload: { title: 'Operator save' } },
      OPERATOR_TOOL_CONTEXT);

    await Promise.resolve();

    const editorPending = host.approvals.getPendingForAgent('editor');
    const operatorPending = host.approvals.getPendingForAgent(OPERATOR_AGENT_ID);

    expect(editorPending).toHaveLength(1);
    expect(operatorPending).toHaveLength(1);
    expect(editorPending[0]?.agentId).toBe('editor');
    expect(editorPending[0]?.agentLabel).toBe('Content Editor');
    expect(operatorPending[0]?.agentId).toBe(OPERATOR_AGENT_ID);
    expect(operatorPending[0]?.agentLabel).toBe(OPERATOR_LABEL);

    render(<ApprovalCard request={editorPending[0] ?? null} />);
    expect(screen.getByTestId('approval-agent-badge')).toHaveAttribute('data-agent-id', 'editor');

    host.approvals.resolve(editorPending[0]!.id, 'approved');
    host.approvals.resolve(operatorPending[0]!.id, 'approved');

    expect((await editorPendingPromise).ok).toBe(true);
    expect((await operatorPendingPromise).ok).toBe(true);
  });

  it('keeps operator canvas lease separate from scoped panel leases', () => {
    const { host } = buildCoexistenceHost();
    cleanups.push(() => host.dispose());

    bindOperatorRegistration('ask');

    const operatorLease = host.agents.leases.get(OPERATOR_LEASE_SCOPE);
    expect(operatorLease?.source).toBe(OPERATOR_AGENT_ID);

    const panelClaim = host.agents.claim({
      source: 'editor',
      scope: 'panel:site-seo',
      ttlMs: 5_000,
    });
    expect(panelClaim.ok).toBe(true);

    expect(host.agents.leases.list()).toHaveLength(2);
    expect(host.agents.registry.get('editor')?.id).toBe('editor');
    expect(host.agents.registry.get(OPERATOR_AGENT_ID)?.id).toBe(OPERATOR_AGENT_ID);
  });

  it('unregisters operator without removing scoped agents', () => {
    const { host } = buildCoexistenceHost();
    cleanups.push(() => host.dispose());

    bindOperatorRegistration('ask');
    expect(host.agents.registry.get(OPERATOR_AGENT_ID)?.id).toBe(OPERATOR_AGENT_ID);

    unbindOperatorRegistration();
    expect(host.agents.registry.get(OPERATOR_AGENT_ID)).toBeUndefined();
    expect(host.agents.registry.get('editor')?.id).toBe('editor');
    expect(host.agents.leases.get(OPERATOR_LEASE_SCOPE)).toBeUndefined();
  });

  it('wires runtime from createCanvasHost for surface registration', () => {
    const { host } = buildCoexistenceHost();
    cleanups.push(() => host.dispose());

    setOperatorRegistrationRuntime(host.agents);
    bindOperatorRegistration('ask');

    expect(host.agents.registry.get(OPERATOR_AGENT_ID)?.scope).toBe(OPERATOR_REGISTRY_SCOPE);
    expect(host.agents.activity.getEntries().some((entry) => entry.verb === 'operator_registered')).toBe(
      true);
  });
});
