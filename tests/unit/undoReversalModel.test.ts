/**
 * undo/reversal model.
 *
 * E2e-style scenarios:
 * - canvas op stack-undone
 * - approved saved mutation reversed via compensating action under HITL
 * - irreversible action correctly refuses stack-undo
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { defineSchemaPanel } from '../../src/panels/builder';
import { createApprovalController } from '../../src/panels/approval';
import { createCanvasHost, type EngineHandle } from '../../src/panels/host';
import { createPanelRegistry } from '../../src/panels/registry';
import { createPanelToolRuntime, type PanelToolHost } from '../../src/panels/panelToolRuntime';
import { resetActivityLogCounterForTests } from '../../src/agents/activity';
import type { JsonObject } from '../../src/panels/types';

class FakeEngine implements EngineHandle {
  private ready = true;
  private listeners: Record<'ready' | 'change', Set<() => void>> = {
    ready: new Set(),
    change: new Set(),
  };

  isReady(): boolean {
    return this.ready;
  }

  on(event: 'ready' | 'change', listener: () => void): () => void {
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
  },
  sources: {
    seo: { source: 'site.seo', params: {} },
  },
  actions: {
    save: { kind: 'mutate', source: 'site.seo', op: 'update', mutates: true },
    revert: {
      kind: 'mutate',
      source: 'site.seo',
      op: 'revert',
      mutates: true,
      inverse: 'save',
    },
    purge: {
      kind: 'mutate',
      source: 'site.seo',
      op: 'purge',
      mutates: true,
      destructive: true,
      reversible: false,
      confirm: 'Purge all SEO data?',
    },
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
    { block: 'actions', actions: ['save', 'revert', 'purge'] },
  ],
} as const satisfies Parameters<typeof defineSchemaPanel>[0]);

function buildRuntime (){
  const controller = createApprovalController();
  const host: PanelToolHost = {
    panels: {
      open: async () => {},
      has: (id: string) => id === 'site-seo',
    },
    catalog: new Map(),
  };
  const registry = createPanelRegistry([SEO_PANEL]);
  const runtime = createPanelToolRuntime(host, registry, { approvalController: controller });
  return { runtime, controller, registry, host };
}

beforeEach(() => {
  resetActivityLogCounterForTests();
});

describe('canvas-local stack undo (.a)', () => {
  it('undoes and redoes a canvas op on the per-actor stack', () => {
    const { runtime } = buildRuntime;
    let x = 0;

    runtime.pushCanvasOp('user', {
      verb: 'move_panel',
      target: 'site-seo',
      undo: () => {
        x -= 1;
      },
      redo: () => {
        x += 1;
      },
    });
    expect(x).toBe(0);

    runtime.pushCanvasOp('user', {
      verb: 'move_panel',
      target: 'site-seo',
      undo: () => {
        x -= 1;
      },
      redo: () => {
        x += 1;
      },
    });
    x = 2;

    const undone = runtime.stackUndo('user');
    expect(undone.ok).toBe(true);
    expect(x).toBe(1);

    const redone = runtime.stackRedo('user');
    expect(redone.ok).toBe(true);
    expect(x).toBe(2);

    const ledger = runtime.getActivityLedger;
    expect(ledger.some((entry) => entry.verb === 'undo')).toBe(true);
    expect(ledger.some((entry) => entry.verb === 'redo')).toBe(true);
  });

  it('does not let one actor undo another actor canvas stack', () => {
    const { runtime } = buildRuntime;
    let agentMoved = false;

    runtime.pushCanvasOp('agent-a', {
      verb: 'arrange',
      target: 'workspace',
      undo: () => {
        agentMoved = false;
      },
      redo: () => {
        agentMoved = true;
      },
    });
    agentMoved = true;

    const denied = runtime.stackUndo('agent-b');
    expect(denied).toEqual({
      ok: false,
      code: 'STACK_EMPTY',
      message: 'nothing to undo',
    });
    expect(agentMoved).toBe(true);

    const ownerUndo = runtime.stackUndo('agent-a');
    expect(ownerUndo.ok).toBe(true);
    expect(agentMoved).toBe(false);
  });

  it('refuses stack-undo for irreversible canvas ops', () => {
    const { runtime } = buildRuntime;
    let deleted = true;

    runtime.pushCanvasOp('user', {
      verb: 'delete_shape',
      target: 'shape-1',
      reversible: false,
      undo: () => {
        deleted = false;
      },
      redo: () => {
        deleted = true;
      },
    });

    const result = runtime.stackUndo('user');
    expect(result).toEqual({
      ok: false,
      code: 'IRREVERSIBLE',
      message: 'this action cannot be undone',
    });
    expect(deleted).toBe(true);
  });
});

describe('persisted mutation reversal (.b)', () => {
  it('records applied mutations in the per-actor ledger with inverse metadata', async () => {
    const { runtime, controller } = buildRuntime;
    const opened = await runtime.openPanel('site-seo');
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    await runtime.fillPanel('site-seo', { title: 'Before title' });

    const pending = runtime.runPanelAction(opened.panelId, 'save', { title: 'After title' });
    await Promise.resolve();
    controller.resolve(controller.getPending[0]!.id, 'approved');
    const result = await pending;

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.ledgerEntryId).toBeDefined();

    const entry = runtime.undoReversal.activity.get(result.ledgerEntryId!);
    expect(entry?.reversal.persisted).toBe(true);
    expect(entry?.reversal.reversible).toBe(true);
    expect(entry?.reversal.inverse).toMatchObject({
      panelId: opened.panelId,
      actionId: 'save',
      payload: { title: 'Before title' },
    });
    expect(entry?.actor).toBe('agent:default');
  });

  it('does not stack-undo persisted mutations — only compensating HITL reversal', async () => {
    const { runtime, controller } = buildRuntime;
    const opened = await runtime.openPanel('site-seo');
    if (!opened.ok) return;

    await runtime.fillPanel('site-seo', { title: 'Original' });

    const pending = runtime.runPanelAction(opened.panelId, 'save', { title: 'Saved' });
    await Promise.resolve();
    controller.resolve(controller.getPending[0]!.id, 'approved');
    const applied = await pending;
    expect(applied.status).toBe('ok');

    const stackResult = runtime.stackUndo('user');
    expect(stackResult).toEqual({
      ok: false,
      code: 'STACK_EMPTY',
      message: 'nothing to undo',
    });
  });

  it('reverses an approved saved mutation via compensating action under HITL', async () => {
    const { runtime, controller } = buildRuntime;
    const opened = await runtime.openPanel('site-seo');
    if (!opened.ok) return;

    await runtime.fillPanel('site-seo', { title: 'Original', description: 'Old desc' });

    const savePending = runtime.runPanelAction(opened.panelId, 'save', {
      title: 'Agent title',
      description: 'Agent desc',
    });
    await Promise.resolve();
    controller.resolve(controller.getPending[0]!.id, 'approved');
    const saveResult = await savePending;
    expect(saveResult.status).toBe('ok');
    if (saveResult.status !== 'ok' || saveResult.ledgerEntryId === undefined) return;

    const reversePending = runtime.reverseMutation(saveResult.ledgerEntryId, 'user');
    await Promise.resolve();
    const compensationRequest = controller.getPending[0];
    expect(compensationRequest?.actionId).toBe('save');
    expect(compensationRequest?.payload).toMatchObject({
      title: 'Original',
      description: 'Old desc',
    });

    controller.resolve(compensationRequest!.id, 'approved');
    const reverseResult = await reversePending;

    expect(reverseResult.ok).toBe(true);
    if (!reverseResult.ok) return;

    const original = runtime.undoReversal.activity.get(saveResult.ledgerEntryId);
    expect(original?.reversal.reversedByEntryId).toBe(reverseResult.reversalEntryId);

    const ledger = runtime.getActivityLedger;
    expect(ledger.filter((entry) => entry.reversal.persisted).length).toBeGreaterThanOrEqual(2);
  });

  it('uses declared inverse action id when reversing', async () => {
    const { runtime, controller } = buildRuntime;
    const opened = await runtime.openPanel('site-seo');
    if (!opened.ok) return;

    await runtime.fillPanel('site-seo', { title: 'Baseline' });

    const revertPending = runtime.runPanelAction(opened.panelId, 'revert', { title: 'Changed' });
    await Promise.resolve();
    controller.resolve(controller.getPending[0]!.id, 'approved');
    const revertResult = await revertPending;
    if (revertResult.status !== 'ok' || revertResult.ledgerEntryId === undefined) return;

    const entry = runtime.undoReversal.activity.get(revertResult.ledgerEntryId);
    expect(entry?.reversal.inverse?.actionId).toBe('save');
  });
});

describe('irreversible persisted mutations (.d)', () => {
  it('marks destructive actions irreversible and refuses compensating reversal', async () => {
    const { runtime, controller } = buildRuntime;
    const opened = await runtime.openPanel('site-seo');
    if (!opened.ok) return;

    const pending = runtime.runPanelAction(opened.panelId, 'purge');
    await Promise.resolve();
    expect(controller.getPending[0]?.reversible).toBe(false);
    controller.advancePhase(controller.getPending[0]!.id);
    controller.resolve(controller.getPending[0]!.id, 'approved');
    const result = await pending;
    expect(result.status).toBe('ok');
    if (result.status !== 'ok' || result.ledgerEntryId === undefined) return;

    const entry = runtime.undoReversal.activity.get(result.ledgerEntryId);
    expect(entry?.reversal.reversible).toBe(false);
    expect(entry?.reversal.inverse).toBeUndefined();

    const canReverse = runtime.undoReversal.canReverse(result.ledgerEntryId);
    expect(canReverse).toEqual({
      ok: false,
      code: 'NOT_REVERSIBLE',
      message: 'this action is irreversible',
    });

    const reverseAttempt = await runtime.reverseMutation(result.ledgerEntryId, 'user');
    expect(reverseAttempt.ok).toBe(false);
  });
});

describe('host wiring', () => {
  it('exposes undo reversal runtime on createCanvasHost', async () => {
    const engine = new FakeEngine();
    const host = createCanvasHost({
      engine,
      panels: [SEO_PANEL],
    });

    expect(host.undo).toBeDefined();
    expect(typeof host.undo.stackUndo).toBe('function');
    expect(typeof host.undo.reverseMutation).toBe('function');

    host.dispose();
  });
});
