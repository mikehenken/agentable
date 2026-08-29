/**
 * telemetry sink boundary.
 * Automated check: mock sink receives events across compose -> repair -> approve flow.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { defineSchemaPanel } from '../../src/panels/builder';
import {
  createCanvasHost,
  type EngineHandle,
  type EngineLifecycleEvent,
} from '../../src/panels/host';
import { resetComposedPanelIdCounterForTests } from '../../src/panels/panelToolRuntime';
import type { JsonObject, PanelSpec } from '../../src/panels/types';
import type { TelemetryEvent } from '../../src/telemetry';

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
      fields: [
        { bind: 'title', type: 'text', label: 'Title' },
        { bind: 'description', type: 'textarea', label: 'Description' },
      ],
    },
    { block: 'actions', actions: ['save'] },
  ],
} as const satisfies Parameters<typeof defineSchemaPanel>[0]);

function invalidSeoSpec(): PanelSpec {
  const base = SEO_PANEL.spec;
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

describe(' telemetry sink boundary ', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    resetComposedPanelIdCounterForTests();
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it('delivers compose, repair, and HITL approve events to a host-supplied sink', async () => {
    const events: TelemetryEvent[] = [];
    const engine = new FakeEngine();
    const host = createCanvasHost({
      engine,
      panels: [SEO_PANEL],
      telemetrySink: (event) => {
        events.push(event);
      },
    });
    cleanups.push(() => host.dispose());

    host.agents.register({
      id: 'editor',
      kind: 'chat',
      label: 'Content Editor',
      transport: 'chat',
      allowedTools: ['compose_panel', 'open_panel', 'run_panel_action'],
      allowedPanels: ['site-seo'],
    });

    const invalid = await host.agents.executeTool(
      'compose_panel',
      { spec: invalidSeoSpec },
      { agentId: 'editor', agentLabel: 'Content Editor' });
    expect(invalid.ok).toBe(true);
    if (!invalid.ok || invalid.result.ok !== false) {
      throw new Error('expected invalid compose rejection');
    }
    expect(invalid.result.agentRepairEligible).toBe(true);

    const repaired = await host.agents.executeTool(
      'compose_panel',
      { spec: SEO_PANEL.spec },
      { agentId: 'editor', agentLabel: 'Content Editor' });
    expect(repaired.ok).toBe(true);
    if (!repaired.ok || repaired.result.ok !== true) {
      throw new Error('expected repaired compose success');
    }

    const composedPanelId = repaired.result.panelId;
    expect(composedPanelId).toMatch(/^composed-/);

    const opened = await host.agents.executeTool(
      'open_panel',
      { id: 'site-seo' },
      { agentId: 'editor', agentLabel: 'Content Editor' });
    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      throw new Error('expected open_panel success');
    }

    const panelId =
      typeof opened.result === 'object' &&
      opened.result !== null &&
      'panelId' in opened.result &&
      typeof (opened.result as { panelId: unknown }).panelId === 'string'
        ? (opened.result as { panelId: string }).panelId: 'site-seo-1';

    const pendingPromise = host.agents.executeTool(
      'run_panel_action',
      {
        panelId,
        actionId: 'save',
        payload: { title: 'Telemetry title' },
      },
      { agentId: 'editor', agentLabel: 'Content Editor' });

    await Promise.resolve();
    const pending = host.approvals.getPendingForAgent('editor');
    expect(pending).toHaveLength(1);
    host.approvals.resolve(pending[0]!.id, 'approved');

    const actionResult = await pendingPromise;
    expect(actionResult.ok).toBe(true);

    const composeRejected = events.find(
      (entry) => entry.family === 'compose' && entry.outcome === 'rejected');
    expect(composeRejected).toMatchObject({
      family: 'compose',
      phase: 'compose',
      outcome: 'rejected',
      tool: 'compose_panel',
      agentRepairEligible: true,
      errorCodes: ['SPEC_ACTION_REF_MISSING'],
    });

    const composeRepaired = events.find(
      (entry) => entry.family === 'compose' && entry.outcome === 'repaired_success');
    expect(composeRepaired).toMatchObject({
      family: 'compose',
      phase: 'repair',
      outcome: 'repaired_success',
      tool: 'compose_panel',
      panelId: composedPanelId,
    });

    const hitlQueued = events.find(
      (entry) => entry.family === 'hitl' && entry.outcome === 'queued');
    expect(hitlQueued).toMatchObject({
      family: 'hitl',
      outcome: 'queued',
      panelId,
      actionId: 'save',
      agentId: 'editor',
    });

    const hitlApproved = events.find(
      (entry) => entry.family === 'hitl' && entry.outcome === 'approved');
    expect(hitlApproved).toMatchObject({
      family: 'hitl',
      outcome: 'approved',
      panelId,
      actionId: 'save',
      agentId: 'editor',
    });
  });

  it('no-ops emit when no sink is registered', async () => {
    const engine = new FakeEngine();
    const host = createCanvasHost({
      engine,
      panels: [SEO_PANEL],
    });
    cleanups.push(() => host.dispose());

    expect(() => {
      host.telemetry.emit({
        ts: new Date().toISOString(),
        family: 'compose',
        phase: 'compose',
        outcome: 'success',
        tool: 'compose_panel',
        panelId: 'composed-1',
      });
    }).not.toThrow();
  });

  it('supports late sink registration via host.telemetry.registerSink', async () => {
    const events: TelemetryEvent[] = [];
    const engine = new FakeEngine();
    const host = createCanvasHost({
      engine,
      panels: [SEO_PANEL],
    });
    cleanups.push(() => host.dispose());
    const unregister = host.telemetry.registerSink((event) => {
      events.push(event);
    });

    host.telemetry.emit({
      ts: new Date().toISOString(),
      family: 'hitl',
      outcome: 'approved',
      panelId: 'panel-1',
      definitionId: 'site-seo',
      actionId: 'save',
    });

    unregister();
    host.telemetry.emit({
      ts: new Date().toISOString(),
      family: 'hitl',
      outcome: 'rejected',
      panelId: 'panel-1',
      definitionId: 'site-seo',
      actionId: 'save',
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.outcome).toBe('approved');
  });
});
