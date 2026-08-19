/**
 * Tier 2 dogfood panel: session Agent Activity ledger (03 section 3.3).
 * Binds `agents.activity` through the catalog list with virtualization.
 */
import { defineSchemaPanel } from '../../panels/builder';
import type { PanelDefinition } from '../../panels/types';
import { AGENT_ACTIVITY_PANEL_ID, AGENTS_ACTIVITY_SOURCE } from '../activityRows';

const SCHEMA_VERSION = 1;

const K = {
  title: 'agents.panels.activity.title',
  subtitle: 'agents.panels.activity.subtitle',
} as const;

/** Compile the Agent Activity debug panel definition. */
export function createAgentActivityPanelDefinition(): PanelDefinition {
  return defineSchemaPanel({
    id: AGENT_ACTIVITY_PANEL_ID,
    meta: {
      title: K.title,
      schemaVersion: SCHEMA_VERSION,
      icon: 'Activity',
      agentDescription:
        'Read-only session activity ledger: tool calls, mutations, approvals, and lease events. Use for debugging agent turns.',
      defaultSize: { w: 480, h: 520 },
    },
    sources: {
      entries: { source: AGENTS_ACTIVITY_SOURCE },
    },
    blocks: [
      { block: 'header', title: K.title, subtitle: K.subtitle },
      {
        block: 'list',
        bind: 'entries',
        row: { title: 'title', subtitle: 'subtitle' },
      },
    ],
  });
}

export { K as AGENT_ACTIVITY_CATALOG_KEYS };
