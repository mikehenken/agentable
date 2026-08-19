/**
 * spec inspector panel + runtime bridge tests.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { createSpecDevtoolsSession, resetSpecDevtoolsCounterForTests } from '../../src/devtools';
import { createSpecInspectorPanelDefinition } from '../../src/devtools/panels/specInspectorPanel';
import {
  DEVTOOLS_BINDINGS_SOURCE,
  DEVTOOLS_EVENTS_SOURCE,
  DEVTOOLS_VALIDATION_SOURCE,
} from '../../src/devtools/specDevtoolsRows';
import { createSpecDevtoolsDataAdapter } from '../../src/devtools/specDevtoolsAdapter';
import { defineSchemaPanel } from '../../src/panels/builder';
import { createPanelRegistry } from '../../src/panels/registry';
import { createPanelToolRuntime } from '../../src/panels/panelToolRuntime';
import { createApprovalController } from '../../src/panels/approval';
import { catalog as hostCatalog } from '../../src/panels/catalog';
import type { PanelScope } from '../../src/panels/types';

const SCOPE: PanelScope = { contextId: 'devtools', entityId: 'inspector' };

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

function invalidSeoSpec (){
  const base = SEO_SPEC_PANEL.spec;
  return {...base,
    origin: 'agent' as const,
    nodes: {...base.nodes,
      actions: {
        type: 'action-row',
        props: { actions: ['missing-action'] },
      },
    },
  };
}

describe('Spec Inspector panel ', () => {
  beforeEach(() => {
    resetSpecDevtoolsCounterForTests();
  });

  it('compiles a Tier 2 debug panel with three devtools sources', () => {
    const definition = createSpecInspectorPanelDefinition();
    expect(definition.kind).toBe('spec');
    expect(definition.id).toBe('spec-inspector');
    expect(definition.spec.sources?.validation?.source).toBe(DEVTOOLS_VALIDATION_SOURCE);
    expect(definition.spec.sources?.bindings?.source).toBe(DEVTOOLS_BINDINGS_SOURCE);
    expect(definition.spec.sources?.events?.source).toBe(DEVTOOLS_EVENTS_SOURCE);
  });

  it('serves validation trace rows through the devtools adapter', async () => {
    const session = createSpecDevtoolsSession();
    session.inspectSpec({
      targetLabel: 'playground',
      spec: invalidSeoSpec,
      errors: [
        {
          code: 'SPEC_ACTION_REF_MISSING',
          message: 'action-row references unknown action "missing-action"',
          severity: 'error',
          nodeId: 'actions',
        },
      ],
    });

    const adapter = createSpecDevtoolsDataAdapter(session);
    const rows = (await adapter.query(
      { source: DEVTOOLS_VALIDATION_SOURCE },
      SCOPE,
      new AbortController().signal)) as Array<{ title: string; subtitle: string }>;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toContain('SPEC_ACTION_REF_MISSING');
    expect(rows[0]?.subtitle).toContain('missing-action');
  });
});

describe('panel tool runtime devtools bridge', () => {
  beforeEach(() => {
    resetSpecDevtoolsCounterForTests();
  });

  it('records compose repair failures into the devtools session', async () => {
    const session = createSpecDevtoolsSession();
    const registry = createPanelRegistry([SEO_SPEC_PANEL]);
    const runtime = createPanelToolRuntime(
      {
        panels: {
          open: async () => {},
          has: () => true,
        },
        catalog: hostCatalog,
      },
      registry,
      {
        approvalController: createApprovalController,
        devtoolsSession: session,
      });

    const result = await runtime.composePanel(invalidSeoSpec);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.agentRepairEligible).toBe(true);
    }

    const snapshot = session.getSnapshot;
    expect(snapshot().validationTrace.length).toBeGreaterThan(0);
    expect(snapshot().eventHistory.some((entry) => entry.kind === 'repair')).toBe(true);

    runtime.dispose();
  });
});
