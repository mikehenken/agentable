/**
 * Curated example specs for describe_panel introspection.
 * Every entry is validated in CI via curatedExamplesValidate.test.ts.
 */
import type { SpecValidationContext } from '../spec/types';
import type { PanelSpec, SpecNode } from '../types';
import type { CuratedExampleEntry, CuratedExampleValidationHints } from './types';

function wrapCatalogNode(
  target: SpecNode,
  extraNodes?: Record<string, SpecNode>,
  extras?: Partial<PanelSpec>,
): PanelSpec {
  return {
    v: 1,
    origin: 'agent',
    root: 'body',
    nodes: {
      body: { type: 'panel-body', children: ['target'] },
      target,
      ...extraNodes,
    },
    ...extras,
  };
}

const DEFAULT_SOURCES = ['site.seo', 'seo.generate'] as const;

function catalogValidation(sources: readonly string[] = DEFAULT_SOURCES): CuratedExampleValidationHints {
  return {
    adapterSources: sources,
    hostActions: ['switchPage'],
    panelRegistry: ['site-seo'],
  };
}

export const CURATED_EXAMPLE_ENTRIES: readonly CuratedExampleEntry[] = [
  {
    id: 'catalog-panel-body-minimal',
    targetKind: 'catalog',
    targetId: 'panel-body',
    title: 'Minimal panel body',
    description: 'Empty scroll region root with no children.',
    spec: wrapCatalogNode({ type: 'panel-body' }),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-panel-body-with-header',
    targetKind: 'catalog',
    targetId: 'panel-body',
    title: 'Panel body with header child',
    description: 'Vertical layout root containing a header row.',
    spec: wrapCatalogNode(
      { type: 'panel-body', children: ['hdr'] },
      { hdr: { type: 'header', props: { title: 'Overview' } } },
    ),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-header-title-only',
    targetKind: 'catalog',
    targetId: 'header',
    title: 'Title-only header',
    description: 'Single-line panel chrome header.',
    spec: wrapCatalogNode({ type: 'header', props: { title: 'Site SEO' } }),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-header-with-subtitle',
    targetKind: 'catalog',
    targetId: 'header',
    title: 'Header with subtitle and icon',
    description: 'Full header row with optional icon and subtitle.',
    spec: wrapCatalogNode({
      type: 'header',
      props: { title: 'Analytics', subtitle: 'Last 30 days', icon: 'bar-chart' },
    }),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-field-form-single',
    targetKind: 'catalog',
    targetId: 'field-form',
    title: 'Single bound field',
    description: 'One text field bound to a source key.',
    spec: wrapCatalogNode({
      type: 'field-form',
      props: { bind: 'seo', fields: [{ bind: 'title', type: 'text', label: 'Title' }] },
    }),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-field-form-multi',
    targetKind: 'catalog',
    targetId: 'field-form',
    title: 'Multi-field form',
    description: 'Several typed fields on one source binding.',
    spec: wrapCatalogNode({
      type: 'field-form',
      props: {
        bind: 'seo',
        fields: [
          { bind: 'title', type: 'text', label: 'Meta title' },
          { bind: 'description', type: 'textarea', label: 'Meta description' },
        ],
      },
    }),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-field-form-with-source',
    targetKind: 'catalog',
    targetId: 'field-form',
    title: 'Form with envelope sources',
    description: 'Field form inside a spec that declares source bindings.',
    spec: wrapCatalogNode(
      { type: 'field-form', props: { bind: 'seo', fields: [{ bind: 'keywords', type: 'text' }] } },
      undefined,
      { sources: { seo: { source: 'site.seo', params: { pageId: '$scope.entityId' } } } },
    ),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-action-row-single',
    targetKind: 'catalog',
    targetId: 'action-row',
    title: 'Single save action',
    description: 'One primary action button.',
    spec: wrapCatalogNode(
      { type: 'action-row', props: { actions: ['save'] } },
      undefined,
      { actions: { save: { kind: 'mutate', source: 'site.seo', op: 'update' } } },
    ),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-action-row-dual',
    targetKind: 'catalog',
    targetId: 'action-row',
    title: 'Save and AI generate',
    description: 'Primary save plus AI-assisted generate action.',
    spec: wrapCatalogNode(
      { type: 'action-row', props: { actions: ['save', 'aiGenerate'] } },
      undefined,
      {
        actions: {
          save: { kind: 'mutate', source: 'site.seo', op: 'update' },
          aiGenerate: {
            kind: 'mutate',
            source: 'seo.generate',
            op: 'invoke',
            variant: 'ai',
            targetFields: ['title'],
          },
        },
      },
    ),
    validation: catalogValidation(['site.seo', 'seo.generate']),
  },
  {
    id: 'catalog-list-basic',
    targetKind: 'catalog',
    targetId: 'list',
    title: 'Basic searchable list',
    description: 'List with title row template and search enabled.',
    spec: wrapCatalogNode({
      type: 'list',
      props: { bind: 'seo', row: { title: 'name' }, search: true },
    }),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-list-with-filters',
    targetKind: 'catalog',
    targetId: 'list',
    title: 'List with filter chips',
    description: 'List row template plus inline filter definitions.',
    spec: wrapCatalogNode({
      type: 'list',
      props: {
        bind: 'seo',
        row: { title: 'label', subtitle: 'detail' },
        filters: [{ bind: 'status', type: 'select', label: 'Status' }],
      },
    }),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-table-columns',
    targetKind: 'catalog',
    targetId: 'table',
    title: 'Column definitions',
    description: 'Tabular data with labeled columns.',
    spec: wrapCatalogNode({
      type: 'table',
      props: {
        bind: 'seo',
        columns: [
          { id: 'name', label: 'Name' },
          { id: 'status', label: 'Status' },
        ],
      },
    }),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-table-row-actions',
    targetKind: 'catalog',
    targetId: 'table',
    title: 'Table with row actions',
    description: 'Columns plus per-row action ids.',
    spec: wrapCatalogNode(
      {
        type: 'table',
        props: { bind: 'seo', columns: [{ id: 'title', label: 'Title' }], rowActions: ['edit'] },
      },
      undefined,
      { actions: { edit: { kind: 'host', action: 'switchPage' } } },
    ),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-badge-static',
    targetKind: 'catalog',
    targetId: 'badge',
    title: 'Static status badge',
    description: 'Fixed text chip with tone.',
    spec: wrapCatalogNode({ type: 'badge', props: { text: 'Published', tone: 'success' } }),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-badge-bound',
    targetKind: 'catalog',
    targetId: 'badge',
    title: 'Bound badge',
    description: 'Badge text resolved from a source field.',
    spec: wrapCatalogNode({ type: 'badge', props: { bind: 'seo.status', tone: 'neutral' } }),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-tabs-single',
    targetKind: 'catalog',
    targetId: 'tabs',
    title: 'Single tab region',
    description: 'One tab pointing at a child node.',
    spec: wrapCatalogNode(
      { type: 'tabs', props: { tabs: [{ id: 'main', label: 'Main', child: 'tab-body' }] } },
      { 'tab-body': { type: 'panel-body' } },
    ),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-tabs-dual',
    targetKind: 'catalog',
    targetId: 'tabs',
    title: 'Dual tab layout',
    description: 'Two tabs with distinct child panels.',
    spec: wrapCatalogNode(
      {
        type: 'tabs',
        props: {
          tabs: [
            { id: 'settings', label: 'Settings', child: 'settings-body' },
            { id: 'preview', label: 'Preview', child: 'preview-body' },
          ],
        },
      },
      {
        'settings-body': { type: 'field-form', props: { bind: 'seo', fields: [{ bind: 'title' }] } },
        'preview-body': { type: 'empty-state', props: { message: 'No preview yet' } },
      },
    ),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-confirm-standalone',
    targetKind: 'catalog',
    targetId: 'confirm',
    title: 'Confirm chrome',
    description: 'Internal approval confirm surface.',
    spec: wrapCatalogNode({ type: 'confirm' }),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-confirm-in-body',
    targetKind: 'catalog',
    targetId: 'confirm',
    title: 'Confirm inside panel body',
    description: 'Confirm node nested under panel-body.',
    spec: wrapCatalogNode(
      { type: 'panel-body', children: ['confirm-node'] },
      { 'confirm-node': { type: 'confirm' } },
    ),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-stale-banner-standalone',
    targetKind: 'catalog',
    targetId: 'stale-banner',
    title: 'Stale data banner',
    description: 'Internal stale-data indicator.',
    spec: wrapCatalogNode({ type: 'stale-banner' }),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-stale-banner-with-form',
    targetKind: 'catalog',
    targetId: 'stale-banner',
    title: 'Stale banner above form',
    description: 'Stale banner stacked above an editable form.',
    spec: wrapCatalogNode(
      { type: 'panel-body', children: ['stale', 'form'] },
      {
        stale: { type: 'stale-banner' },
        form: { type: 'field-form', props: { bind: 'seo', fields: [{ bind: 'title' }] } },
      },
    ),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-empty-state-message',
    targetKind: 'catalog',
    targetId: 'empty-state',
    title: 'Message-only empty state',
    description: 'Icon and message when no data is available.',
    spec: wrapCatalogNode({ type: 'empty-state', props: { message: 'No items yet' } }),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-empty-state-with-action',
    targetKind: 'catalog',
    targetId: 'empty-state',
    title: 'Empty state with action',
    description: 'Empty state referencing a declared action id.',
    spec: wrapCatalogNode(
      { type: 'empty-state', props: { message: 'Create your first page', action: 'create' } },
      undefined,
      { actions: { create: { kind: 'host', action: 'switchPage' } } },
    ),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-filter-chips-basic',
    targetKind: 'catalog',
    targetId: 'filter-chips',
    title: 'Active filter chips',
    description: 'Chip row bound to a filter source.',
    spec: wrapCatalogNode({ type: 'filter-chips', props: { bind: 'seo.filters' } }),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-filter-chips-above-list',
    targetKind: 'catalog',
    targetId: 'filter-chips',
    title: 'Filters above list',
    description: 'Filter chips stacked above a searchable list.',
    spec: wrapCatalogNode(
      { type: 'panel-body', children: ['chips', 'items'] },
      {
        chips: { type: 'filter-chips', props: { bind: 'seo.filters' } },
        items: { type: 'list', props: { bind: 'seo', row: { title: 'name' } } },
      },
    ),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-custom-slot-basic',
    targetKind: 'catalog',
    targetId: 'custom-slot',
    title: 'Host component slot',
    description: 'Mounts a host-registered catalog component by name.',
    spec: wrapCatalogNode({ type: 'custom-slot', props: { name: 'site-seo' } }),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-custom-slot-with-props',
    targetKind: 'catalog',
    targetId: 'custom-slot',
    title: 'Custom slot with props',
    description: 'Custom slot passing opaque props to the host component.',
    spec: wrapCatalogNode({
      type: 'custom-slot',
      props: { name: 'job-detail', props: { compact: true } },
    }),
    validation: { ...catalogValidation(), panelRegistry: ['job-detail', 'site-seo'] },
  },
  {
    id: 'catalog-document-view-basic',
    targetKind: 'catalog',
    targetId: 'document-view',
    title: 'Block-model document',
    description: 'Document renderer bound to a source with pre-save undo.',
    spec: wrapCatalogNode({
      type: 'document-view',
      props: { bind: 'doc' },
    }),
    validation: catalogValidation(),
  },
  {
    id: 'catalog-document-view-virtualized',
    targetKind: 'catalog',
    targetId: 'document-view',
    title: 'Virtualized long document',
    description: 'Document renderer with a lowered virtualization threshold for long block lists.',
    spec: wrapCatalogNode({
      type: 'document-view',
      props: { bind: 'doc', virtualizeThreshold: 50 },
    }),
    validation: catalogValidation(),
  },
  {
    id: 'panel-site-seo-minimal',
    targetKind: 'panel',
    targetId: 'site-seo',
    title: 'Minimal SEO compose',
    description: 'Header plus title field and save action.',
    spec: {
      v: 1,
      origin: 'agent',
      root: 'body',
      sources: { seo: { source: 'site.seo', params: { pageId: '$scope.entityId' } } },
      actions: { save: { kind: 'mutate', source: 'site.seo', op: 'update', mutates: true } },
      nodes: {
        body: { type: 'panel-body', children: ['hdr', 'form', 'actions'] },
        hdr: { type: 'header', props: { title: 'SEO' } },
        form: {
          type: 'field-form',
          props: { bind: 'seo', fields: [{ bind: 'title', type: 'text', label: 'Meta title' }] },
        },
        actions: { type: 'action-row', props: { actions: ['save'] } },
      },
    },
    validation: catalogValidation(),
  },
  {
    id: 'panel-site-seo-full',
    targetKind: 'panel',
    targetId: 'site-seo',
    title: 'Full SEO panel shape',
    description: 'Matches P2 site-seo fields and dual mutate actions.',
    spec: {
      v: 1,
      origin: 'agent',
      root: 'body',
      sources: { seo: { source: 'site.seo', params: { pageId: '$scope.entityId' } } },
      actions: {
        save: { kind: 'mutate', source: 'site.seo', op: 'update', mutates: true },
        aiGenerate: {
          kind: 'mutate',
          source: 'seo.generate',
          op: 'invoke',
          mutates: true,
          variant: 'ai',
          targetFields: ['title', 'description'],
        },
      },
      nodes: {
        body: { type: 'panel-body', children: ['hdr', 'form', 'actions'] },
        hdr: { type: 'header', props: { title: 'SEO', subtitle: 'Search engine settings' } },
        form: {
          type: 'field-form',
          props: {
            bind: 'seo',
            fields: [
              { bind: 'title', type: 'text', label: 'Meta title' },
              { bind: 'description', type: 'textarea', label: 'Meta description' },
              { bind: 'keywords', type: 'text', label: 'Keywords' },
            ],
          },
        },
        actions: { type: 'action-row', props: { actions: ['save', 'aiGenerate'] } },
      },
    },
    validation: catalogValidation(['site.seo', 'seo.generate']),
  },
  {
    id: 'panel-site-seo-keywords-only',
    targetKind: 'panel',
    targetId: 'site-seo',
    title: 'Keywords-focused variant',
    description: 'Partial SEO panel emphasizing keywords field.',
    spec: {
      v: 1,
      origin: 'agent',
      root: 'body',
      sources: { seo: { source: 'site.seo' } },
      actions: { save: { kind: 'mutate', source: 'site.seo', op: 'update' } },
      nodes: {
        body: { type: 'panel-body', children: ['form', 'actions'] },
        form: {
          type: 'field-form',
          props: { bind: 'seo', fields: [{ bind: 'keywords', type: 'text', label: 'Keywords' }] },
        },
        actions: { type: 'action-row', props: { actions: ['save'] } },
      },
    },
    validation: catalogValidation(),
  },
];

export function curatedExamplesForTarget(
  targetKind: 'catalog' | 'panel',
  targetId: string,
): readonly CuratedExampleEntry[] {
  return CURATED_EXAMPLE_ENTRIES.filter(
    (entry) => entry.targetKind === targetKind && entry.targetId === targetId,
  );
}

export function curatedExampleSummariesForTarget(
  targetKind: 'catalog' | 'panel',
  targetId: string,
): Array<{ id: string; title: string; description: string; spec: PanelSpec }> {
  return curatedExamplesForTarget(targetKind, targetId).map(({ id, title, description, spec }) => ({
    id,
    title,
    description,
    spec,
  }));
}

export function buildValidationContextFromHints(
  hints: CuratedExampleValidationHints,
  catalog: ReadonlyMap<string, import('../spec/types').SpecCatalogEntry>,
): SpecValidationContext {
  return {
    catalog,
    adapterSources: new Set(hints.adapterSources ?? DEFAULT_SOURCES),
    hostActions: new Set(hints.hostActions ?? ['switchPage']),
    panelRegistry: new Set(hints.panelRegistry ?? ['site-seo']),
  };
}

export function allCuratedExampleEntries(): readonly CuratedExampleEntry[] {
  return CURATED_EXAMPLE_ENTRIES;
}
