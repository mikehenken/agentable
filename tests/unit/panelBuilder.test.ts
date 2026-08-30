/**
 * unit suite for the typed builder (02 section 3). Covers the
 * deterministic compile (stable node ids, stable ordering, pure JSON,
 * byte-identical repeat runs), the define-time guarantee set (action
 * refs, source binds, showIf key checks, static mutate rejection), and
 * that builder output flows through `validateSpec` with zero errors and
 * zero warnings against the v1 default catalog.
 */
import { describe, expect, it } from 'vitest';
import {
  defineSchemaPanel,
  defineStaticPanel,
  PanelBuilderError,
  type SchemaPanelConfig,
  type StaticPanelConfig,
} from '../../src/panels/builder';
import { validateSpec, defaultCatalog } from '../../src/panels/spec';
import type { PanelMeta, SpecAction, SpecSourceBinding } from '../../src/panels/types';

// The builder stamps a bodyScroll:'auto' default onto every compiled meta
// (src/panels/builder.ts; consumed by SpecRenderer's body-scroll behavior).
const META: PanelMeta = { title: 'SEO', schemaVersion: 1, bodyScroll: 'auto' };

function seoConfig() {
  return {
    id: 'seo',
    meta: META,
    sources: {
      seo: { source: 'site.seo', params: { pageId: '$scope.entityId' } },
    },
    state: { scopeMode: 'site' },
    actions: {
      save: { kind: 'mutate', source: 'site.seo', op: 'update' },
      aiGenerate: {
        kind: 'mutate',
        source: 'seo.generate',
        op: 'invoke',
        variant: 'ai',
        targetFields: ['metaTitle', 'metaDescription'],
      },
    },
    blocks: [
      {
        block: 'form',
        bind: 'seo',
        fields: [
          { bind: 'metaTitle', type: 'text', label: 'Meta title' },
          { bind: 'metaDescription', type: 'textarea', label: 'Meta description' },
        ],
      },
      { block: 'actions', actions: ['save', 'aiGenerate'] },
    ],
  } as const satisfies SchemaPanelConfig<
    Record<string, SpecSourceBinding>,
    Record<string, string>,
    Record<string, SpecAction>
  >;
}

function expectBuilderError(fn: () => unknown, code: string): void {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(PanelBuilderError);
  expect((caught as PanelBuilderError).code).toBe(code);
}

describe('defineSchemaPanel: deterministic compile', () => {
  it('compiles the PRD SEO shape to the spec envelope with stable node ids', () => {
    const definition = defineSchemaPanel(seoConfig());

    expect(definition.kind).toBe('spec');
    expect(definition.id).toBe('seo');
    expect(definition.meta).toEqual(META);
    expect(definition.spec).toEqual({
      v: 1,
      origin: 'host',
      root: 'body',
      sources: { seo: { source: 'site.seo', params: { pageId: '$scope.entityId' } } },
      state: { scopeMode: 'site' },
      nodes: {
        body: { type: 'panel-body', children: ['form', 'actions'] },
        form: {
          type: 'field-form',
          props: {
            bind: 'seo',
            fields: [
              { bind: 'metaTitle', type: 'text', label: 'Meta title' },
              { bind: 'metaDescription', type: 'textarea', label: 'Meta description' },
            ],
          },
        },
        actions: { type: 'action-row', props: { actions: ['save', 'aiGenerate'] } },
      },
      actions: {
        save: { kind: 'mutate', source: 'site.seo', op: 'update' },
        aiGenerate: {
          kind: 'mutate',
          source: 'seo.generate',
          op: 'invoke',
          variant: 'ai',
          targetFields: ['metaTitle', 'metaDescription'],
        },
      },
    });
  });

  it('produces byte-identical serialized specs across repeat compiles', () => {
    const first = defineSchemaPanel(seoConfig());
    const second = defineSchemaPanel(seoConfig());
    expect(JSON.stringify(first.spec)).toBe(JSON.stringify(second.spec));
  });

  it('emits pure JSON that survives a JSON round trip unchanged', () => {
    const definition = defineSchemaPanel(seoConfig());
    expect(JSON.parse(JSON.stringify(definition.spec))).toEqual(definition.spec);
  });

  it('does not share references with the input config', () => {
    const config = seoConfig();
    const definition = defineSchemaPanel(config);
    expect(definition.spec.sources).not.toBe(config.sources);
    expect(definition.spec.sources?.seo).not.toBe(config.sources.seo);
    expect(definition.spec.state).not.toBe(config.state);
    expect(definition.spec.actions).not.toBe(config.actions);
    expect(definition.spec.actions?.save).not.toBe(config.actions.save);
    expect(definition.spec.nodes.form?.props?.fields).not.toBe(config.blocks[0].fields);
  });

  it('suffixes repeated block kinds deterministically in declaration order', () => {
    const definition = defineSchemaPanel({
      id: 'badges',
      meta: META,
      sources: {},
      blocks: [
        { block: 'badge', text: 'One' },
        { block: 'badge', text: 'Two' },
        { block: 'badge', text: 'Three' },
      ],
    });
    expect(definition.spec.nodes.body?.children).toEqual(['badge', 'badge-2', 'badge-3']);
    expect(definition.spec.nodes['badge-2']?.props?.text).toBe('Two');
  });

  it('honors explicit block ids and keeps auto ids clear of them', () => {
    const definition = defineSchemaPanel({
      id: 'named',
      meta: META,
      sources: {},
      blocks: [
        { block: 'badge', id: 'badge-2', text: 'Named' },
        { block: 'badge', text: 'AutoFirst' },
        { block: 'badge', text: 'AutoSecond' },
      ],
    });
    expect(definition.spec.nodes.body?.children).toEqual(['badge-2', 'badge', 'badge-3']);
  });

  it('compiles tabs into container nodes reachable through children', () => {
    const definition = defineSchemaPanel({
      id: 'tabbed',
      meta: META,
      sources: { jobs: { source: 'career.jobs' } },
      blocks: [
        {
          block: 'tabs',
          tabs: [
            {
              id: 'overview',
              label: 'Overview',
              blocks: [{ block: 'header', title: 'Overview' }],
            },
            {
              id: 'detail',
              label: 'Detail',
              blocks: [
                { block: 'list', bind: 'jobs', row: { title: 'title' } },
                { block: 'badge', text: 'Beta' },
              ],
            },
          ],
        },
      ],
    });

    expect(definition.spec.nodes.tabs).toEqual({
      type: 'tabs',
      props: {
        tabs: [
          { id: 'overview', label: 'Overview', child: 'tabs-overview' },
          { id: 'detail', label: 'Detail', child: 'tabs-detail' },
        ],
      },
      children: ['tabs-overview', 'tabs-detail'],
    });
    expect(definition.spec.nodes['tabs-overview']).toEqual({
      type: 'panel-body',
      children: ['tabs-overview-header'],
    });
    expect(definition.spec.nodes['tabs-detail']).toEqual({
      type: 'panel-body',
      children: ['tabs-detail-list', 'tabs-detail-badge'],
    });
    expect(definition.spec.nodes['tabs-detail-list']?.type).toBe('list');
  });

  it('emits nodes in stable order: body, then blocks depth-first in declaration order', () => {
    const definition = defineSchemaPanel({
      id: 'ordered',
      meta: META,
      sources: { jobs: { source: 'career.jobs' } },
      blocks: [
        { block: 'header', title: 'Jobs' },
        {
          block: 'tabs',
          tabs: [{ id: 'a', label: 'A', blocks: [{ block: 'badge', text: 'A' }] }],
        },
        { block: 'list', bind: 'jobs', row: { title: 'title' } },
      ],
    });
    expect(Object.keys(definition.spec.nodes)).toEqual([
      'body',
      'header',
      'tabs',
      'tabs-a',
      'tabs-a-badge',
      'list',
    ]);
  });

  it('passes validateSpec against the v1 catalog with zero errors and zero warnings', () => {
    const definition = defineSchemaPanel(seoConfig());
    const result = validateSpec(definition.spec, {
      catalog: defaultCatalog,
      adapterSources: new Set(['site.seo', 'seo.generate']),
      hostActions: new Set(),
      panelRegistry: new Set(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toEqual([]);
    }
  });

  it('accepts showIf operands over valid scope, state, and source keys', () => {
    const definition = defineSchemaPanel({
      id: 'conditional',
      meta: META,
      sources: { jobs: { source: 'career.jobs' } },
      state: { mode: 'basic' },
      blocks: [
        { block: 'badge', text: 'Advanced', showIf: { $eq: ['$state.mode', 'advanced'] } },
        { block: 'badge', text: 'Scoped', showIf: { $eq: ['$scope.entityId', 'page-1'] } },
        { block: 'badge', text: 'Remote', showIf: { $eq: ['$data.jobs.kind', 'remote'] } },
      ],
    });
    expect(definition.spec.nodes.badge?.showIf).toEqual({ $eq: ['$state.mode', 'advanced'] });
    expect(definition.spec.nodes['badge-2']?.showIf).toEqual({
      $eq: ['$scope.entityId', 'page-1'],
    });
    expect(definition.spec.nodes['badge-3']?.showIf).toEqual({
      $eq: ['$data.jobs.kind', 'remote'],
    });
  });
});

describe('defineSchemaPanel: define-time guarantees', () => {
  it('rejects an invalid panel id', () => {
    expectBuilderError(
      () => defineSchemaPanel({ id: '9bad', meta: META, sources: {}, blocks: [] }),
      'BUILDER_ID_INVALID',
    );
  });

  it('rejects an invalid explicit block id', () => {
    expectBuilderError(
      () =>
        defineSchemaPanel({
          id: 'p',
          meta: META,
          sources: {},
          blocks: [{ block: 'badge', id: 'bad id', text: 'x' }],
        }),
      'BUILDER_ID_INVALID',
    );
  });

  it('rejects duplicate explicit block ids', () => {
    expectBuilderError(
      () =>
        defineSchemaPanel({
          id: 'p',
          meta: META,
          sources: {},
          blocks: [
            { block: 'badge', id: 'dup', text: 'a' },
            { block: 'header', id: 'dup', title: 'b' },
          ],
        }),
      'BUILDER_ID_DUPLICATE',
    );
  });

  it('rejects a form bound to an undeclared source', () => {
    expectBuilderError(
      () =>
        defineSchemaPanel({
          id: 'p',
          meta: META,
          sources: { seo: { source: 'site.seo' } },
          blocks: [{ block: 'form', bind: 'missing' as 'seo', fields: [] }],
        }),
      'BUILDER_BIND_UNKNOWN',
    );
  });

  it('rejects list, table, filter-chips, and badge binds to undeclared sources', () => {
    const sources = { seo: { source: 'site.seo' } } as const;
    const bad = 'missing' as 'seo';
    expectBuilderError(
      () =>
        defineSchemaPanel({
          id: 'p',
          meta: META,
          sources,
          blocks: [{ block: 'list', bind: bad, row: { title: 't' } }],
        }),
      'BUILDER_BIND_UNKNOWN',
    );
    expectBuilderError(
      () =>
        defineSchemaPanel({
          id: 'p',
          meta: META,
          sources,
          blocks: [{ block: 'table', bind: bad, columns: [] }],
        }),
      'BUILDER_BIND_UNKNOWN',
    );
    expectBuilderError(
      () =>
        defineSchemaPanel({
          id: 'p',
          meta: META,
          sources,
          blocks: [{ block: 'filter-chips', bind: bad }],
        }),
      'BUILDER_BIND_UNKNOWN',
    );
    expectBuilderError(
      () =>
        defineSchemaPanel({
          id: 'p',
          meta: META,
          sources,
          blocks: [{ block: 'badge', bind: bad }],
        }),
      'BUILDER_BIND_UNKNOWN',
    );
  });

  it('rejects action-row refs that are not declared actions', () => {
    expectBuilderError(
      () =>
        defineSchemaPanel({
          id: 'p',
          meta: META,
          sources: {},
          actions: { save: { kind: 'mutate', source: 'site.seo', op: 'update' } },
          blocks: [{ block: 'actions', actions: ['save', 'missing' as 'save'] }],
        }),
      'BUILDER_ACTION_UNKNOWN',
    );
  });

  it('rejects undeclared row actions, table row actions, and empty-state actions', () => {
    const sources = { jobs: { source: 'career.jobs' } } as const;
    expectBuilderError(
      () =>
        defineSchemaPanel({
          id: 'p',
          meta: META,
          sources,
          blocks: [
            { block: 'list', bind: 'jobs', row: { title: 't', rowActions: ['missing'] } },
          ],
        }),
      'BUILDER_ACTION_UNKNOWN',
    );
    expectBuilderError(
      () =>
        defineSchemaPanel({
          id: 'p',
          meta: META,
          sources,
          blocks: [{ block: 'table', bind: 'jobs', columns: [], rowActions: ['missing'] }],
        }),
      'BUILDER_ACTION_UNKNOWN',
    );
    expectBuilderError(
      () =>
        defineSchemaPanel({
          id: 'p',
          meta: META,
          sources: {},
          blocks: [{ block: 'empty-state', message: 'Nothing here', action: 'missing' }],
        }),
      'BUILDER_ACTION_UNKNOWN',
    );
  });

  it('rejects showIf operands referencing invalid scope keys', () => {
    expectBuilderError(
      () =>
        defineSchemaPanel({
          id: 'p',
          meta: META,
          sources: {},
          blocks: [{ block: 'badge', text: 'x', showIf: { $eq: ['$scope.siteId', 's'] } }],
        }),
      'BUILDER_SHOWIF_SCOPE_KEY',
    );
  });

  it('rejects showIf operands referencing undeclared state keys', () => {
    expectBuilderError(
      () =>
        defineSchemaPanel({
          id: 'p',
          meta: META,
          sources: {},
          state: { mode: 'basic' },
          blocks: [{ block: 'badge', text: 'x', showIf: { $eq: ['$state.missing', 'y'] } }],
        }),
      'BUILDER_SHOWIF_STATE_KEY',
    );
  });

  it('rejects showIf operands referencing undeclared sources', () => {
    expectBuilderError(
      () =>
        defineSchemaPanel({
          id: 'p',
          meta: META,
          sources: { jobs: { source: 'career.jobs' } },
          blocks: [{ block: 'badge', text: 'x', showIf: { $eq: ['$data.other.kind', 'y'] } }],
        }),
      'BUILDER_SHOWIF_SOURCE_UNKNOWN',
    );
  });

  it('rejects duplicate tab ids within one tabs block', () => {
    expectBuilderError(
      () =>
        defineSchemaPanel({
          id: 'p',
          meta: META,
          sources: {},
          blocks: [
            {
              block: 'tabs',
              tabs: [
                { id: 'a', label: 'A', blocks: [] },
                { id: 'a', label: 'Again', blocks: [] },
              ],
            },
          ],
        }),
      'BUILDER_TAB_ID_DUPLICATE',
    );
  });
});

describe('defineStaticPanel', () => {
  function aboutConfig() {
    return {
      id: 'about',
      meta: { title: 'About', schemaVersion: 1 },
      actions: {
        askSandy: { kind: 'prompt', prompt: 'Tell me more about this workspace' },
      },
      blocks: [
        { block: 'header', title: 'About', subtitle: 'Workspace guide' },
        { block: 'badge', text: 'v1' },
        { block: 'actions', actions: ['askSandy'] },
      ],
    } as const satisfies StaticPanelConfig<
      Record<string, never>,
      Record<string, Exclude<SpecAction, { kind: 'mutate' }>>
    >;
  }

  it('compiles a sourceless envelope with stable ids', () => {
    const definition = defineStaticPanel(aboutConfig());
    expect(definition.spec).toEqual({
      v: 1,
      origin: 'host',
      root: 'body',
      nodes: {
        body: { type: 'panel-body', children: ['header', 'badge', 'actions'] },
        header: { type: 'header', props: { title: 'About', subtitle: 'Workspace guide' } },
        badge: { type: 'badge', props: { text: 'v1' } },
        actions: { type: 'action-row', props: { actions: ['askSandy'] } },
      },
      actions: {
        askSandy: { kind: 'prompt', prompt: 'Tell me more about this workspace' },
      },
    });
    expect(definition.spec.sources).toBeUndefined();
  });

  it('produces byte-identical serialized specs across repeat compiles', () => {
    expect(JSON.stringify(defineStaticPanel(aboutConfig()).spec)).toBe(
      JSON.stringify(defineStaticPanel(aboutConfig()).spec),
    );
  });

  it('passes validateSpec with zero errors and zero warnings', () => {
    const definition = defineStaticPanel(aboutConfig());
    const result = validateSpec(definition.spec, {
      catalog: defaultCatalog,
      adapterSources: new Set(),
      hostActions: new Set(),
      panelRegistry: new Set(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toEqual([]);
    }
  });

  it('rejects mutate actions smuggled past the type layer', () => {
    const config = {
      id: 'about',
      meta: { title: 'About', schemaVersion: 1 },
      actions: { save: { kind: 'mutate', source: 'site.seo', op: 'update' } },
      blocks: [],
    };
    expectBuilderError(
      () => defineStaticPanel(config as unknown as Parameters<typeof defineStaticPanel>[0]),
      'BUILDER_STATIC_MUTATE_FORBIDDEN',
    );
  });
});
