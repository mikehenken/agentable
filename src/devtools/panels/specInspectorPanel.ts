/**
 * Tier 2 debug panel: dockable spec inspector.
 * Read-only sections for validation trace, bindings/data, and HITL/repair history.
 */
import { defineSchemaPanel } from '../../panels/builder';
import type { PanelDefinition } from '../../panels/types';
import {
  DEVTOOLS_BINDINGS_SOURCE,
  DEVTOOLS_EVENTS_SOURCE,
  DEVTOOLS_VALIDATION_SOURCE,
  SPEC_INSPECTOR_PANEL_ID,
} from '../specDevtoolsRows';

const SCHEMA_VERSION = 1;

const K = {
  title: 'devtools.panels.specInspector.title',
  subtitle: 'devtools.panels.specInspector.subtitle',
  sectionValidation: 'devtools.panels.specInspector.tabValidation',
  sectionBindings: 'devtools.panels.specInspector.tabBindings',
  sectionEvents: 'devtools.panels.specInspector.tabEvents',
} as const;

/** Compile the Spec Inspector debug panel definition. */
export function createSpecInspectorPanelDefinition(): PanelDefinition {
  return defineSchemaPanel({
    id: SPEC_INSPECTOR_PANEL_ID,
    meta: {
      title: K.title,
      schemaVersion: SCHEMA_VERSION,
      icon: 'Bug',
      agentDescription:
        'Read-only spec inspector: validation trace, source/state/action bindings, and HITL/repair/action history for the active inspection target.',
      defaultSize: { w: 520, h: 640 },
    },
    sources: {
      validation: { source: DEVTOOLS_VALIDATION_SOURCE },
      bindings: { source: DEVTOOLS_BINDINGS_SOURCE },
      events: { source: DEVTOOLS_EVENTS_SOURCE },
    },
    blocks: [
      { block: 'header', title: K.title, subtitle: K.subtitle },
      { block: 'header', title: K.sectionValidation },
      {
        block: 'list',
        bind: 'validation',
        row: { title: 'title', subtitle: 'subtitle' },
      },
      { block: 'header', title: K.sectionBindings },
      {
        block: 'list',
        bind: 'bindings',
        row: { title: 'title', subtitle: 'subtitle' },
      },
      { block: 'header', title: K.sectionEvents },
      {
        block: 'list',
        bind: 'events',
        row: { title: 'title', subtitle: 'subtitle' },
      },
    ],
  });
}

export { K as SPEC_INSPECTOR_CATALOG_KEYS };
