/**
 * Tier 2 document panel (D50, P12-T2): portable block model + DocumentView.
 */
import { defineSchemaPanel } from '../../panels/builder';
import type { PanelDefinition } from '../../panels/types';
import { DOCUMENT_PANEL_ID, WORKSPACE_DOCUMENTS_SOURCE } from '../../panels/document/types';

const SCHEMA_VERSION = 1;

const K = {
  title: 'panels.document.title',
  subtitle: 'panels.document.subtitle',
} as const;

/** Compile the document panel definition. */
export function createDocumentPanelDefinition(): PanelDefinition {
  return defineSchemaPanel({
    id: DOCUMENT_PANEL_ID,
    meta: {
      title: K.title,
      schemaVersion: SCHEMA_VERSION,
      icon: 'FileText',
      agentDescription:
        'Multi-block document editor: headings, paragraphs, lists, tables, images, callouts. Edit via structured block ops only.',
      defaultSize: { w: 560, h: 640 },
    },
    sources: {
      document: { source: WORKSPACE_DOCUMENTS_SOURCE, params: { documentId: '$scope.entityId' } },
    },
    actions: {
      save: {
        kind: 'mutate',
        source: WORKSPACE_DOCUMENTS_SOURCE,
        op: 'save',
        mutates: true,
      },
    },
    blocks: [
      { block: 'header', title: K.title, subtitle: K.subtitle },
      { block: 'document-view', bind: 'document' },
      { block: 'actions', actions: ['save'] },
    ],
  });
}

export { K as DOCUMENT_PANEL_CATALOG_KEYS };
