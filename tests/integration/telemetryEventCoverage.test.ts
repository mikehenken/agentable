/**
 * event coverage with frozen error codes.
 * Automated check: mock sink observes compose/HITL/tool/voice/cost families;
 * every event errorCodes field uses the frozen telemetry vocabulary.
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
import {
  assertFrozenTelemetryErrorCodes,
  resetVoiceTelemetrySessionCounterForTests,
  type TelemetryEvent,
} from '../../src/telemetry';
import { ensureVoiceKernel } from '../../src/shared/voiceKernel';

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

function collectErrorCodes(events: readonly TelemetryEvent[]): string[] {
  const codes: string[] = [];
  for (const event of events) {
    if ('errorCodes' in event && Array.isArray(event.errorCodes)) {
      for (const code of event.errorCodes) {
        codes.push(code);
      }
    }
  }
  return codes;
}

describe('telemetry event coverage', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    resetComposedPanelIdCounterForTests();
    resetVoiceTelemetrySessionCounterForTests();
    while (cleanups.length > 0) {
      cleanups.pop?.();
    }
  });

  it('observes compose, HITL, tool, voice, and cost families with frozen error codes', async () => {
    const events: TelemetryEvent[] = [];
    const engine = new FakeEngine();
    const host = createCanvasHost({
      engine,
      panels: [SEO_PANEL],
      telemetrySink: (event) => {
        events.push(event);
      },
    });
    cleanups.push(() => host.dispose);

    host.agents.register({
      id: 'editor',
      kind: 'chat',
      label: 'Content Editor',
      transport: 'chat',
      allowedTools: ['compose_panel', 'open_panel', 'run_panel_action'],
      allowedPanels: ['site-seo'],
    });

    host.agents.register({
      id: 'restricted',
      kind: 'chat',
      label: 'Restricted',
      transport: 'chat',
      allowedTools: ['list_panels'],
      allowedPanels: ['site-seo'],
    });

    const scopeDenied = await host.agents.executeTool(
      'compose_panel',
      { spec: invalidSeoSpec },
      { agentId: 'restricted', agentLabel: 'Restricted' });
    expect(scopeDenied.ok).toBe(false);

    const invalid = await host.agents.executeTool(
      'compose_panel',
      { spec: invalidSeoSpec },
      { agentId: 'editor', agentLabel: 'Content Editor' });
    expect(invalid.ok).toBe(true);
    if (!invalid.ok || invalid.result.ok !== false) {
      throw new Error('expected invalid compose rejection');
    }

    const repaired = await host.agents.executeTool(
      'compose_panel',
      { spec: SEO_PANEL.spec },
      { agentId: 'editor', agentLabel: 'Content Editor' });
    expect(repaired.ok).toBe(true);
    if (!repaired.ok || repaired.result.ok !== true) {
      throw new Error('expected repaired compose success');
    }

    const composedPanelId = repaired.result.panelId;

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

    const rejectPromise = host.agents.executeTool(
      'run_panel_action',
      {
        panelId,
        actionId: 'save',
        payload: { title: 'Rejected title' },
      },
      { agentId: 'editor', agentLabel: 'Content Editor' });
    await Promise.resolve();
    const pendingReject = host.approvals.getPendingForAgent('editor');
    expect(pendingReject.length).toBeGreaterThan(0);
    host.approvals.resolve(pendingReject[0]!.id, 'rejected_by_user');
    await rejectPromise;

    const approvePromise = host.agents.executeTool(
      'run_panel_action',
      {
        panelId,
        actionId: 'save',
        payload: { title: 'Approved title' },
      },
      { agentId: 'editor', agentLabel: 'Content Editor' });
    await Promise.resolve();
    const pendingApprove = host.approvals.getPendingForAgent('editor');
    expect(pendingApprove.length).toBeGreaterThan(0);
    host.approvals.resolve(pendingApprove[0]!.id, 'approved');
    await approvePromise;

    const kernel = ensureVoiceKernel;
    kernel().voice._publish({ state: 'connecting' });
    kernel().voice._publish({ state: 'listening' });
    kernel().voice._publish({ state: 'error', errorMessage: 'transport drop' });
    kernel().voice._publish({ state: 'connecting' });
    kernel().voice._publish({ state: 'listening' });
    kernel().voice._publish({ state: 'idle' });

    const families = new Set(events.map((entry) => entry.family));
    expect(families.has('compose')).toBe(true);
    expect(families.has('hitl')).toBe(true);
    expect(families.has('tool')).toBe(true);
    expect(families.has('voice')).toBe(true);
    expect(families.has('cost')).toBe(true);

    const composeRejected = events.find(
      (entry) => entry.family === 'compose' && entry.outcome === 'rejected');
    expect(composeRejected).toMatchObject({
      errorCodes: ['SPEC_ACTION_REF_MISSING'],
    });

    const composeSuccess = events.find(
      (entry) =>
        entry.family === 'compose' &&
        entry.outcome === 'repaired_success' &&
        entry.panelId === composedPanelId);
    expect(composeSuccess).toBeDefined();

    const hitlRejected = events.find(
      (entry) => entry.family === 'hitl' && entry.outcome === 'rejected');
    expect(hitlRejected).toBeDefined();

    const hitlApproved = events.find(
      (entry) => entry.family === 'hitl' && entry.outcome === 'approved');
    expect(hitlApproved).toBeDefined();

    const toolScopeDenied = events.find(
      (entry) =>
        entry.family === 'tool' &&
        entry.toolName === 'compose_panel' &&
        entry.outcome === 'error' &&
        entry.errorCodes?.includes('SCOPE_DENIED'));
    expect(toolScopeDenied).toBeDefined();
    expect(typeof toolScopeDenied?.latencyMs).toBe('number');

    const toolComposeError = events.find(
      (entry) =>
        entry.family === 'tool' &&
        entry.toolName === 'compose_panel' &&
        entry.agentId === 'editor' &&
        entry.outcome === 'error' &&
        entry.errorCodes?.includes('SPEC_ACTION_REF_MISSING'));
    expect(toolComposeError).toBeDefined();

    const costRecorded = events.find(
      (entry) => entry.family === 'cost' && entry.outcome === 'recorded' && entry.costClass === 'expensive');
    expect(costRecorded).toMatchObject({
      capability: 'compose_panel',
      agentId: 'editor',
    });

    const voiceConnected = events.find(
      (entry) => entry.family === 'voice' && entry.outcome === 'connected');
    expect(voiceConnected).toBeDefined();

    const emittedCodes = collectErrorCodes(events);
    expect(emittedCodes.length).toBeGreaterThan(0);
    assertFrozenTelemetryErrorCodes(emittedCodes);
    expect([...new Set(emittedCodes)].sort()).toMatchSnapshot('event-error-codes');
  });
});
