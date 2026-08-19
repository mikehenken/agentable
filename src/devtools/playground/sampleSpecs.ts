import { defineSchemaPanel } from '../../panels/builder';
import type { PanelSpec } from '../../panels/types';

const VALID_PANEL = defineSchemaPanel({
  id: 'playground-sample',
  meta: {
    title: 'Playground sample',
    schemaVersion: 1,
    agentDescription: 'Minimal valid spec for the read-only playground.',
  },
  sources: {
    demo: { source: 'playground.demo' },
  },
  blocks: [
    { block: 'header', title: 'Hello playground', subtitle: 'Valid PanelSpec IR' },
    {
      block: 'form',
      bind: 'demo',
      fields: [{ bind: 'note', type: 'text', label: 'Note' }],
    },
  ],
} as const satisfies Parameters<typeof defineSchemaPanel>[0]);

export const SAMPLE_VALID_SPEC_JSON = JSON.stringify(VALID_PANEL.spec, null, 2);

export const SAMPLE_INVALID_SPEC_JSON = JSON.stringify(
  {...(VALID_PANEL.spec as PanelSpec),
    origin: 'agent',
    nodes: {...(VALID_PANEL.spec.nodes ?? {}),
      actions: {
        type: 'action-row',
        props: { actions: ['missing-action-ref'] },
      },
    },
    actions: {},
  },
  null,
  2);
