/**
 * automated check: a builder-authored panel and the equivalent
 * hand-written raw-IR panel render byte-identical DOM (: one spec IR,
 * two authoring surfaces, one renderer). Both specs flow through the
 * same `validateSpec` pipeline with the v1 default catalog, then render
 * through `SpecRenderer` against separate but identically-scripted mock
 * adapters. The proof is a strict string equality over the serialized
 * `container.innerHTML` of both renders, plus byte equality of the
 * normalized spec envelopes.
 */
import React from 'react';
import { render, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { defineSchemaPanel, defineStaticPanel } from '../../src/panels/builder';
import { validateSpec, defaultCatalog } from '../../src/panels/spec';
import type { NormalizedPanelSpec } from '../../src/panels/spec';
import { createDataLifecycle, SpecRenderer } from '../../src/panels/renderer';
import type { PanelScope, PanelSpec } from '../../src/panels/types';
import { createMockDataAdapter } from '../helpers/mockDataAdapter';

const SCOPE: PanelScope = { contextId: 'site-1', entityId: 'page-1' };

function validated(spec: PanelSpec, adapterSources: string[]): NormalizedPanelSpec {
  const result = validateSpec(spec, {
    catalog: defaultCatalog,
    adapterSources: new Set(adapterSources),
    hostActions: new Set(),
    panelRegistry: new Set(),
  });
  if (!result.ok) {
    throw new Error(`spec failed validation: ${JSON.stringify(result.errors)}`);
  }
  expect(result.warnings).toEqual([]);
  return result.spec;
}

interface RenderedPanel {
  html: () => string;
  container: HTMLElement;
  dispose: () => void;
}

function renderPanel(spec: NormalizedPanelSpec): RenderedPanel {
  const adapter = createMockDataAdapter({ latencyMs: 5 });
  const lifecycle = createDataLifecycle({ adapter, retryBackoffMs: 5 });
  const view = render(<SpecRenderer spec={spec} scope={SCOPE} lifecycle={lifecycle} />);
  return {
    html: () => view.container.innerHTML,
    container: view.container,
    dispose: () => {
      view.unmount();
      lifecycle.dispose();
    },
  };
}

async function waitUntilSettled(container: HTMLElement): Promise<void> {
  await waitFor(() => {
    expect(container.querySelectorAll('[data-testid="loading-skeleton"]')).toHaveLength(0);
  });
}

describe('builder vs raw IR: schema panel renders byte-identical DOM', () => {
  const builderDefinition = defineSchemaPanel({
    id: 'jobs',
    meta: { title: 'Jobs', schemaVersion: 1 },
    sources: {
      jobs: { source: 'career.jobs', params: { track: '$scope.entityId' } },
    },
    state: { mode: 'advanced' },
    actions: {
      save: { kind: 'mutate', source: 'career.jobs', op: 'update' },
      askSandy: { kind: 'prompt', prompt: 'Map this for me' },
    },
    blocks: [
      { block: 'header', title: 'Jobs', subtitle: 'Open roles' },
      {
        block: 'form',
        bind: 'jobs',
        fields: [
          { bind: 'title', type: 'text', label: 'Title' },
          { bind: 'summary', type: 'textarea', label: 'Summary' },
        ],
      },
      { block: 'actions', actions: ['save', 'askSandy'] },
      { block: 'list', bind: 'jobs', row: { title: 'title', subtitle: 'team' }, search: true },
      { block: 'badge', text: 'Advanced', showIf: { $eq: ['$state.mode', 'advanced'] } },
      { block: 'badge', text: 'Hidden', showIf: { $eq: ['$state.mode', 'basic'] } },
    ],
  });

  /**
   * The same panel, authored directly as raw IR the way an agent emits
   * it. Node ids, ordering, and props deliberately mirror the builder's
   * documented deterministic output.
   */
  const rawSpec: PanelSpec = {
    v: 1,
    origin: 'host',
    root: 'body',
    sources: {
      jobs: { source: 'career.jobs', params: { track: '$scope.entityId' } },
    },
    state: { mode: 'advanced' },
    nodes: {
      body: {
        type: 'panel-body',
        children: ['header', 'form', 'actions', 'list', 'badge', 'badge-2'],
      },
      header: { type: 'header', props: { title: 'Jobs', subtitle: 'Open roles' } },
      form: {
        type: 'field-form',
        props: {
          bind: 'jobs',
          fields: [
            { bind: 'title', type: 'text', label: 'Title' },
            { bind: 'summary', type: 'textarea', label: 'Summary' },
          ],
        },
      },
      actions: { type: 'action-row', props: { actions: ['save', 'askSandy'] } },
      list: {
        type: 'list',
        props: { bind: 'jobs', row: { title: 'title', subtitle: 'team' }, search: true },
      },
      badge: {
        type: 'badge',
        props: { text: 'Advanced' },
        showIf: { $eq: ['$state.mode', 'advanced'] },
      },
      'badge-2': {
        type: 'badge',
        props: { text: 'Hidden' },
        showIf: { $eq: ['$state.mode', 'basic'] },
      },
    },
    actions: {
      save: { kind: 'mutate', source: 'career.jobs', op: 'update' },
      askSandy: { kind: 'prompt', prompt: 'Map this for me' },
    },
  };

  const adapterSources = ['career.jobs'];

  it('normalizes to byte-identical spec envelopes through validateSpec', () => {
    const fromBuilder = validated(builderDefinition.spec, adapterSources);
    const fromRaw = validated(rawSpec, adapterSources);
    expect(JSON.stringify(fromBuilder)).toBe(JSON.stringify(fromRaw));
  });

  it('renders byte-identical DOM once data has settled', async () => {
    const fromBuilder = renderPanel(validated(builderDefinition.spec, adapterSources));
    const fromRaw = renderPanel(validated(rawSpec, adapterSources));

    await waitUntilSettled(fromBuilder.container);
    await waitUntilSettled(fromRaw.container);

    const builderHtml = fromBuilder.html();
    const rawHtml = fromRaw.html();

    // Guard against a trivially-empty equality before asserting identity.
    expect(builderHtml.length).toBeGreaterThan(0);
    expect(within(fromBuilder.container).getByTestId('field-form')).toBeInTheDocument();
    expect(within(fromBuilder.container).getByTestId('action-row')).toBeInTheDocument();
    expect(within(fromBuilder.container).getByTestId('list')).toBeInTheDocument();
    expect(within(fromBuilder.container).getByTestId('badge')).toBeInTheDocument();
    // The state-hidden badge proves showIf survived the compile.
    expect(builderHtml).not.toContain('Hidden');

    expect(builderHtml).toBe(rawHtml);

    fromBuilder.dispose();
    fromRaw.dispose();
  });

  it('renders byte-identical loading DOM before data settles', () => {
    const fromBuilder = renderPanel(validated(builderDefinition.spec, adapterSources));
    const fromRaw = renderPanel(validated(rawSpec, adapterSources));

    const builderHtml = fromBuilder.html();
    expect(builderHtml).toContain('loading-skeleton');
    expect(builderHtml).toBe(fromRaw.html());

    fromBuilder.dispose();
    fromRaw.dispose();
  });
});

describe('builder vs raw IR: static panel renders byte-identical DOM', () => {
  const builderDefinition = defineStaticPanel({
    id: 'about',
    meta: { title: 'About', schemaVersion: 1 },
    actions: {
      askSandy: { kind: 'prompt', prompt: 'Tell me about this workspace' },
    },
    blocks: [
      { block: 'header', title: 'About', subtitle: 'Workspace guide' },
      {
        block: 'tabs',
        tabs: [
          { id: 'intro', label: 'Intro', blocks: [{ block: 'badge', text: 'v1' }] },
          {
            id: 'help',
            label: 'Help',
            blocks: [{ block: 'empty-state', message: 'Ask Sandy anything', action: 'askSandy' }],
          },
        ],
      },
      { block: 'actions', actions: ['askSandy'] },
    ],
  });

  const rawSpec: PanelSpec = {
    v: 1,
    origin: 'host',
    root: 'body',
    nodes: {
      body: { type: 'panel-body', children: ['header', 'tabs', 'actions'] },
      header: { type: 'header', props: { title: 'About', subtitle: 'Workspace guide' } },
      tabs: {
        type: 'tabs',
        props: {
          tabs: [
            { id: 'intro', label: 'Intro', child: 'tabs-intro' },
            { id: 'help', label: 'Help', child: 'tabs-help' },
          ],
        },
        children: ['tabs-intro', 'tabs-help'],
      },
      'tabs-intro': { type: 'panel-body', children: ['tabs-intro-badge'] },
      'tabs-intro-badge': { type: 'badge', props: { text: 'v1' } },
      'tabs-help': { type: 'panel-body', children: ['tabs-help-empty'] },
      'tabs-help-empty': {
        type: 'empty-state',
        props: { message: 'Ask Sandy anything', action: 'askSandy' },
      },
      actions: { type: 'action-row', props: { actions: ['askSandy'] } },
    },
    actions: {
      askSandy: { kind: 'prompt', prompt: 'Tell me about this workspace' },
    },
  };

  it('normalizes to byte-identical spec envelopes through validateSpec', () => {
    const fromBuilder = validated(builderDefinition.spec, []);
    const fromRaw = validated(rawSpec, []);
    expect(JSON.stringify(fromBuilder)).toBe(JSON.stringify(fromRaw));
  });

  it('renders byte-identical DOM with no data lifecycle involved', () => {
    const fromBuilder = renderPanel(validated(builderDefinition.spec, []));
    const fromRaw = renderPanel(validated(rawSpec, []));

    const builderHtml = fromBuilder.html();
    expect(builderHtml.length).toBeGreaterThan(0);
    expect(within(fromBuilder.container).getByTestId('header')).toBeInTheDocument();
    expect(within(fromBuilder.container).getByTestId('tabs')).toBeInTheDocument();
    expect(within(fromBuilder.container).getByTestId('action-row')).toBeInTheDocument();
    expect(builderHtml).toBe(fromRaw.html());

    fromBuilder.dispose();
    fromRaw.dispose();
  });
});
