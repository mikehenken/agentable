/**
 * approval runtime — autoApprove, destructive confirm, dirty protection.
 */
import { describe, it, expect } from 'vitest';
import { defineSchemaPanel } from '../../src/panels/builder';
import { createApprovalController } from '../../src/panels/approval';
import { computePayloadDiff } from '../../src/panels/approval/payloadDiff';
import {
  applyFillPatch,
  createPanelToolRuntime,
  type PanelToolRuntime,
} from '../../src/panels/panelToolRuntime';
import { createPanelRegistry } from '../../src/panels/registry';
import { declaredFieldPaths, derivePanelAgentMeta } from '../../src/panels/registryMetadata';
import type { PanelToolHost } from '../../src/panels/panelToolRuntime';

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
    restore: {
      kind: 'mutate',
      source: 'site.seo',
      op: 'restore',
      mutates: true,
      destructive: true,
      confirm: 'Restore this snapshot?',
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
    { block: 'actions', actions: ['save', 'restore'] },
  ],
} as const satisfies Parameters<typeof defineSchemaPanel>[0]);

function buildRuntime(options?: {
  autoApprove?: readonly string[];
  controller?: ReturnType<typeof createApprovalController>;
}): { runtime: PanelToolRuntime; controller: ReturnType<typeof createApprovalController> } {
  const controller = options?.controller ?? createApprovalController({ autoApprove: options?.autoApprove });
  const host: PanelToolHost = {
    panels: {
      open: async () => {},
      has: (id: string) => id === 'site-seo',
    },
    catalog: new Map(),
  };
  const registry = createPanelRegistry([SEO_PANEL]);
  const runtime = createPanelToolRuntime(host, registry, {
    approvalController: controller,
    autoApprove: options?.autoApprove,
  });
  return { runtime, controller };
}

describe('computePayloadDiff', () => {
  it('detects add, change, and remove entries', () => {
    const diff = computePayloadDiff(
      { title: 'Old', keywords: 'keep' },
      { title: 'New', description: 'added' });
    expect(diff).toEqual([
      { path: 'title', before: 'Old', after: 'New', kind: 'change' },
      { path: 'description', before: undefined, after: 'added', kind: 'add' },
      { path: 'keywords', before: 'keep', after: undefined, kind: 'remove' },
    ]);
  });
});

describe('runPanelAction approval flow', () => {
  it('blocks agent mutate actions until approval resolves', async () => {
    const controller = createApprovalController();
    const { runtime } = buildRuntime({ controller });
    const opened = await runtime.openPanel('site-seo');
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    await runtime.fillPanel('site-seo', { title: 'Current title' });

    const pending = runtime.runPanelAction(opened.panelId, 'save', { title: 'Agent title' });
    await Promise.resolve();
    expect(controller.getPending).toHaveLength(1);
    expect(controller.getPending[0]?.diff[0]).toMatchObject({
      path: 'title',
      kind: 'change',
    });

    controller.resolve(controller.getPending[0]!.id, 'approved');
    const result = await pending;
    expect(result).toMatchObject({
      status: 'ok',
      result: { actionId: 'save', panelId: opened.panelId },
    });
  });

  it('returns rejected_by_user when approval is rejected', async () => {
    const controller = createApprovalController();
    const { runtime } = buildRuntime({ controller });
    const opened = await runtime.openPanel('site-seo');
    if (!opened.ok) return;

    const pending = runtime.runPanelAction(opened.panelId, 'save');
    await Promise.resolve();
    controller.resolve(controller.getPending[0]!.id, 'rejected_by_user');
    const result = await pending;
    expect(result).toEqual({ status: 'rejected_by_user' });
  });

  it('autoApproves listed actions without queueing review', async () => {
    const controller = createApprovalController({ autoApprove: ['save'] });
    const { runtime } = buildRuntime({ controller, autoApprove: ['save'] });
    const opened = await runtime.openPanel('site-seo');
    if (!opened.ok) return;

    const result = await runtime.runPanelAction(opened.panelId, 'save', { title: 'Fast save' });
    expect(result.status).toBe('ok');
    expect(controller.getPending).toHaveLength(0);
  });

  it('still requires destructive confirm when autoApproved', async () => {
    const controller = createApprovalController({ autoApprove: ['restore'] });
    const { runtime } = buildRuntime({ controller, autoApprove: ['restore'] });
    const opened = await runtime.openPanel('site-seo');
    if (!opened.ok) return;

    const pending = runtime.runPanelAction(opened.panelId, 'restore');
    await Promise.resolve();
    expect(controller.getPending).toHaveLength(1);
    expect(controller.getPending[0]?.phase).toBe('destructive_confirm');

    controller.resolve(controller.getPending[0]!.id, 'approved');
    const result = await pending;
    expect(result.status).toBe('ok');
  });

  it('skips review for user-triggered non-destructive mutations', async () => {
    const controller = createApprovalController();
    const { runtime } = buildRuntime({ controller });
    const opened = await runtime.openPanel('site-seo');
    if (!opened.ok) return;

    const result = await runtime.runPanelAction(
      opened.panelId,
      'save',
      { title: 'User save' },
      { actor: 'user' });
    expect(result.status).toBe('ok');
    expect(controller.getPending).toHaveLength(0);
  });
});

describe('dirty field protection', () => {
  it('never applies agent fill to user-dirty fields', () => {
    const meta = derivePanelAgentMeta(SEO_PANEL);
    const allowed = declaredFieldPaths(meta);
    const state = {
      values: {},
      userDirtyFields: new Set(['description']),
      agentFilledFields: new Set<string>,
    };

    const result = applyFillPatch(
      state,
      { title: 'Agent', description: 'Blocked' },
      allowed);

    expect(result.applied).toEqual(['title']);
    expect(result.skippedUserDirty).toEqual(['description']);
    expect(state.values.description).toBeUndefined();
  });

  it('exposes field marker sets for chrome tinting', async () => {
    const { runtime } = buildRuntime();
    const opened = await runtime.openPanel('site-seo');
    if (!opened.ok) return;

    runtime.markFieldUserDirty(opened.panelId, 'description');
    await runtime.fillPanel('site-seo', { title: 'Agent title' });

    const markers = runtime.getFieldMarkers(opened.panelId);
    expect([...markers.userDirty]).toEqual(['description']);
    expect([...markers.agentFilled]).toEqual(['title']);
  });
});
