/**
 * PanelSpec fixtures referenced by compose eval cases.
 */
import { defineSchemaPanel } from '../../../src/panels/builder';
import type { PanelSpec } from '../../../src/panels/types';

export const EVAL_SEO_PANEL = defineSchemaPanel({
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

export type EvalSpecRef = 'valid-seo' | 'invalid-seo-missing-action' | 'non-object';

export function resolveEvalSpec(ref: EvalSpecRef): unknown {
  switch (ref) {
    case 'valid-seo':
      return EVAL_SEO_PANEL.spec;
    case 'invalid-seo-missing-action':
      return invalidSeoSpec;
    case 'non-object':
      return 'not-a-panel-spec';
    default: {
      const exhaustive: never = ref;
      throw new Error(`unknown eval spec ref: ${String(exhaustive)}`);
    }
  }
}

export function invalidSeoSpec(): PanelSpec {
  const base = EVAL_SEO_PANEL.spec;
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
