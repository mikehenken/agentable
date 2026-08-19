/**
 * P1-T3 integration: the block renderer plus data lifecycle against the
 * instrumented mock adapter with real async latency and real AbortSignal
 * behavior. Specs go through `validateSpec` with the v1 default catalog
 * (plus one test viewer entry), so the whole P1 pipeline is exercised:
 * validate, render, fetch, cache, dedupe, abort, stale-banner,
 * invalidate, save lifecycle.
 */
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validateSpec, defaultCatalog } from '../../src/panels/spec';
import type { NormalizedPanelSpec } from '../../src/panels/spec';
import { createDataLifecycle, SpecRenderer } from '../../src/panels/renderer';
import type { DataLifecycle } from '../../src/panels/renderer';
import type {
  CatalogEntry,
  PanelScope,
  PanelSpec,
  SpecNodeContextValue,
} from '../../src/panels/types';
import { createMockDataAdapter, type MockAdapterOptions } from '../helpers/mockDataAdapter';

const SCOPE: PanelScope = { contextId: 'site-1', entityId: 'page-1' };

interface ViewerProps {
  bind: string;
  context: SpecNodeContextValue;
}

/**
 * Test-only catalog entry that surfaces the node context: state, bound
 * data, and buttons that drive dirty tracking and action dispatch.
 */
const SourceViewer = ({ bind, context }: ViewerProps): React.ReactElement => (
  <div data-testid={`viewer-${bind}`}>
    <span data-testid={`viewer-${bind}-state`}>{context.state}</span>
    <span data-testid={`viewer-${bind}-data`}>{JSON.stringify(context.data[bind] ?? null)}</span>
    <button type="button" data-testid={`viewer-${bind}-edit`} onClick={() => context.setDirty(true)}>
      edit
    </button>
    <button type="button" data-testid={`viewer-${bind}-save`} onClick={() => context.dispatch('save')}>
      save
    </button>
  </div>
);

const sourceViewerEntry: CatalogEntry<{ bind: string }> = {
  name: 'source-viewer',
  props: z.object({ bind: z.string() }),
  component: SourceViewer as CatalogEntry<{ bind: string }>['component'],
};

function testCatalog(): Map<string, CatalogEntry> {
  const map = new Map<string, CatalogEntry>(defaultCatalog);
  map.set('source-viewer', sourceViewerEntry);
  return map;
}

function validate(spec: PanelSpec, catalog: Map<string, CatalogEntry>): NormalizedPanelSpec {
  const result = validateSpec(spec, {
    catalog,
    adapterSources: new Set(['career.jobs', 'career.paths']),
    hostActions: new Set(),
    panelRegistry: new Set(),
  });
  if (!result.ok) {
    throw new Error(`test spec failed validation: ${JSON.stringify(result.errors)}`);
  }
  return result.spec;
}

function jobsSpec(overrides: Partial<PanelSpec> = {}): PanelSpec {
  return {
    v: 1,
    origin: 'host',
    root: 'body',
    sources: {
      jobs: { source: 'career.jobs', params: { track: '$scope.entityId' } },
    },
    nodes: {
      body: { type: 'panel-body', children: ['viewer'] },
      viewer: { type: 'source-viewer', props: { bind: 'jobs' } },
    },
    actions: {
      save: { kind: 'mutate', source: 'career.jobs', op: 'update' },
    },...overrides,
  };
}

interface Harness {
  lifecycle: DataLifecycle;
  adapter: ReturnType<typeof createMockDataAdapter>;
  spec: NormalizedPanelSpec;
  catalog: Map<string, CatalogEntry>;
}

function harness(
  adapterOptions: MockAdapterOptions = {},
  spec: PanelSpec = jobsSpec()): Harness {
  const adapter = createMockDataAdapter(adapterOptions);
  const lifecycle = createDataLifecycle({ adapter, retryBackoffMs: 5 });
  const catalog = testCatalog();
  return { lifecycle, adapter, spec: validate(spec, catalog), catalog };
}

function renderSpec(h: Harness): ReturnType<typeof render> {
  return render(
    <SpecRenderer spec={h.spec} scope={SCOPE} lifecycle={h.lifecycle} catalog={h.catalog} />);
}

describe('renderer data lifecycle: fetch and cache', () => {
  it('shows the loading skeleton, then populated data, with $scope params resolved', async () => {
    const h = harness();
    renderSpec(h);

    expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('loading');
    await waitFor(() => {
      expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('populated');
    });
    expect(screen.getByTestId('viewer-jobs-data').textContent).toBe('"career.jobs-v0"');
    expect(h.adapter.queryCount('career.jobs')).toBe(1);
    expect(h.adapter.queries[0]?.ref.params).toEqual({ track: 'page-1' });
    expect(h.adapter.queries[0]?.scope).toEqual(SCOPE);
    h.lifecycle.dispose();
  });

  it('dedupes concurrent consumers: two nodes bound to one source produce one query', async () => {
    const spec = jobsSpec({
      nodes: {
        body: { type: 'panel-body', children: ['viewer', 'second'] },
        viewer: { type: 'source-viewer', props: { bind: 'jobs' } },
        second: { type: 'list', props: { bind: 'jobs', row: { title: 't' } } },
      },
    });
    const h = harness({}, spec);
    renderSpec(h);

    await waitFor(() => {
      expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('populated');
    });
    expect(screen.getByTestId('list')).toBeInTheDocument();
    expect(h.adapter.queryCount('career.jobs')).toBe(1);
    h.lifecycle.dispose();
  });

  it('serves a remount from cache without refetching', async () => {
    const h = harness();
    const first = renderSpec(h);
    await waitFor(() => {
      expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('populated');
    });
    first.unmount();

    renderSpec(h);
    // Populated immediately from cache; no loading pass, no second query.
    expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('populated');
    expect(screen.getByTestId('viewer-jobs-data').textContent).toBe('"career.jobs-v0"');
    expect(h.adapter.queryCount('career.jobs')).toBe(1);
    h.lifecycle.dispose();
  });

  it('renders the empty state for empty payloads', async () => {
    const h = harness({ plan: () => ({ data: [] }) });
    renderSpec(h);
    await waitFor(() => {
      expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('empty');
    });
    h.lifecycle.dispose();
  });
});

describe('renderer data lifecycle: abort', () => {
  it('aborts the in-flight query on unmount, for real, via the AbortSignal', async () => {
    const h = harness({ latencyMs: 60 });
    const view = renderSpec(h);
    expect(h.adapter.queries[0]?.outcome).toBe('pending');

    view.unmount();
    expect(h.adapter.queries[0]?.signal.aborted).toBe(true);
    expect(h.adapter.abortedCount('career.jobs')).toBe(1);
    // Let the rejected promise settle; nothing may write after unmount.
    await h.adapter.whenIdle();
    expect(h.lifecycle.peek({ source: 'career.jobs', params: { track: 'page-1' } }, SCOPE).status).toBe(
      'idle');
    h.lifecycle.dispose();
  });

  it('invalidate aborts the in-flight query and refetches mounted bindings', async () => {
    const h = harness({ latencyMs: 60 });
    renderSpec(h);
    expect(h.adapter.queries[0]?.outcome).toBe('pending');

    act(() => {
      h.lifecycle.invalidate('career.jobs');
    });
    expect(h.adapter.queries[0]?.signal.aborted).toBe(true);
    expect(h.adapter.queryCount('career.jobs')).toBe(2);
    await waitFor(() => {
      expect(screen.getByTestId('viewer-jobs-data').textContent).toBe('"career.jobs-v1"');
    });
    h.lifecycle.dispose();
  });
});

describe('renderer data lifecycle: invalidate', () => {
  it('clears to loading and repopulates with fresh data', async () => {
    const h = harness();
    renderSpec(h);
    await waitFor(() => {
      expect(screen.getByTestId('viewer-jobs-data').textContent).toBe('"career.jobs-v0"');
    });

    act(() => {
      h.lifecycle.invalidate('career.jobs');
    });
    await waitFor(() => {
      expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('loading');
    });
    await waitFor(() => {
      expect(screen.getByTestId('viewer-jobs-data').textContent).toBe('"career.jobs-v1"');
    });
    expect(h.adapter.queryCount('career.jobs')).toBe(2);
    h.lifecycle.dispose();
  });

  it('scope-filtered invalidate leaves other scopes alone', async () => {
    const h = harness();
    const otherScope: PanelScope = { contextId: 'site-2', entityId: 'page-1' };
    render(
      <>
        <SpecRenderer spec={h.spec} scope={SCOPE} lifecycle={h.lifecycle} catalog={h.catalog} />
        <SpecRenderer spec={h.spec} scope={otherScope} lifecycle={h.lifecycle} catalog={h.catalog} />
      </>);
    await act(async () => {
      await h.adapter.whenIdle();
    });
    expect(h.adapter.queryCount('career.jobs')).toBe(2);

    act(() => {
      h.lifecycle.invalidate('career.jobs', { contextId: 'site-2' });
    });
    await act(async () => {
      await h.adapter.whenIdle();
    });
    expect(h.adapter.queryCount('career.jobs')).toBe(3);
    h.lifecycle.dispose();
  });
});

describe('renderer data lifecycle: stale banner', () => {
  it('remote change while dirty raises the banner instead of clobbering, refresh resolves it', async () => {
    const user = userEvent.setup();
    const h = harness();
    renderSpec(h);
    await waitFor(() => {
      expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('populated');
    });

    await user.click(screen.getByTestId('viewer-jobs-edit'));
    expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('dirty');

    act(() => {
      h.adapter.emitRemoteChange('career.jobs');
    });
    await waitFor(() => {
      expect(screen.getByTestId('renderer-stale-banner')).toBeInTheDocument();
    });
    expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('stale');
    // The draft was not clobbered: no refetch happened.
    expect(h.adapter.queryCount('career.jobs')).toBe(1);
    expect(screen.getByTestId('viewer-jobs-data').textContent).toBe('"career.jobs-v0"');

    await user.click(screen.getByTestId('renderer-stale-refresh'));
    await waitFor(() => {
      expect(screen.queryByTestId('renderer-stale-banner')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('viewer-jobs-data').textContent).toBe('"career.jobs-v1"');
    // Draft state survives the refresh; the node stays dirty.
    expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('dirty');
    h.lifecycle.dispose();
  });

  it('remote change without dirty consumers refetches silently, no banner', async () => {
    const h = harness();
    renderSpec(h);
    await waitFor(() => {
      expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('populated');
    });

    act(() => {
      h.adapter.emitRemoteChange('career.jobs');
    });
    await waitFor(() => {
      expect(screen.getByTestId('viewer-jobs-data').textContent).toBe('"career.jobs-v1"');
    });
    expect(screen.queryByTestId('renderer-stale-banner')).not.toBeInTheDocument();
    expect(h.adapter.queryCount('career.jobs')).toBe(2);
    h.lifecycle.dispose();
  });
});

describe('renderer data lifecycle: errors and retry', () => {
  it('shows the error card with retry; retry refetches and recovers', async () => {
    const user = userEvent.setup();
    const h = harness({
      plan: (ref, _scope, callIndex) =>
        callIndex === 0
          ? { error: { code: 'not_found', message: 'missing dataset' } }: { data: `${ref.source}-recovered` },
    });
    renderSpec(h);

    await waitFor(() => {
      expect(screen.getByTestId('renderer-error-card')).toBeInTheDocument();
    });
    expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('error');
    expect(screen.getByTestId('renderer-error-message').textContent).toBe('missing dataset');

    await user.click(screen.getByTestId('renderer-retry'));
    await waitFor(() => {
      expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('populated');
    });
    expect(screen.getByTestId('viewer-jobs-data').textContent).toBe('"career.jobs-recovered"');
    expect(h.adapter.queryCount('career.jobs')).toBe(2);
    h.lifecycle.dispose();
  });

  it('retries unavailable once automatically before surfacing anything', async () => {
    const h = harness({
      plan: (ref, _scope, callIndex) =>
        callIndex === 0
          ? { error: { code: 'unavailable', message: 'warming up' } }: { data: `${ref.source}-warm` },
    });
    renderSpec(h);

    await waitFor(() => {
      expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('populated');
    });
    expect(screen.getByTestId('viewer-jobs-data').textContent).toBe('"career.jobs-warm"');
    expect(h.adapter.queryCount('career.jobs')).toBe(2);
    expect(screen.queryByTestId('renderer-error-card')).not.toBeInTheDocument();
    h.lifecycle.dispose();
  });
});

describe('renderer data lifecycle: save lifecycle', () => {
  it('dispatching a mutate action runs saving state, clears dirty, and refetches', async () => {
    const user = userEvent.setup();
    // Slow the adapter down so the transient saving state is observable.
    const h = harness({ latencyMs: 120 });
    renderSpec(h);
    await waitFor(() => {
      expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('populated');
    });

    await user.click(screen.getByTestId('viewer-jobs-edit'));
    expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('dirty');

    await user.click(screen.getByTestId('viewer-jobs-save'));
    await waitFor(() => {
      expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('saving');
    });
    expect(h.adapter.mutations).toHaveLength(1);
    expect(h.adapter.mutations[0]?.action).toMatchObject({
      kind: 'mutate',
      source: 'career.jobs',
      op: 'update',
    });

    // Fresh server state pulled after the save; the refetch is silent, so
    // wait on the data itself rather than the state label.
    await waitFor(
      () => {
        expect(screen.getByTestId('viewer-jobs-data').textContent).toBe('"career.jobs-v1"');
      },
      { timeout: 3000 });
    expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('populated');
    expect(h.adapter.queryCount('career.jobs')).toBe(2);
    h.lifecycle.dispose();
  });

  it('a failed mutation surfaces the error and keeps the draft dirty', async () => {
    const user = userEvent.setup();
    const h = harness({
      mutatePlan: () => ({
        ok: false,
        error: { code: 'validation', message: 'title too short' },
      }),
    });
    renderSpec(h);
    await waitFor(() => {
      expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('populated');
    });

    await user.click(screen.getByTestId('viewer-jobs-edit'));
    await user.click(screen.getByTestId('viewer-jobs-save'));
    await waitFor(() => {
      expect(screen.getByTestId('renderer-mutation-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('renderer-mutation-error').textContent).toBe('title too short');
    expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('dirty');
    // No refetch on failure.
    expect(h.adapter.queryCount('career.jobs')).toBe(1);
    h.lifecycle.dispose();
  });
});

describe('renderer structure', () => {
  it('renders the unknown-node placeholder card without data loss', async () => {
    const spec = jobsSpec({
      nodes: {
        body: { type: 'panel-body', children: ['viewer', 'mystery'] },
        viewer: { type: 'source-viewer', props: { bind: 'jobs' } },
        mystery: { type: 'holo-deck', props: { power: 11 } },
      },
    });
    const h = harness({}, spec);
    renderSpec(h);

    expect(screen.getByTestId('unsupported-block').textContent).toContain('holo-deck');
    await waitFor(() => {
      expect(screen.getByTestId('viewer-jobs-state').textContent).toBe('populated');
    });
    h.lifecycle.dispose();
  });

  it('showIf against $state hides and shows nodes', () => {
    const spec = jobsSpec({
      state: { mode: 'basic' },
      nodes: {
        body: { type: 'panel-body', children: ['viewer', 'advanced'] },
        viewer: { type: 'source-viewer', props: { bind: 'jobs' } },
        advanced: {
          type: 'badge',
          props: { text: 'Advanced' },
          showIf: { $eq: ['$state.mode', 'advanced'] },
        },
      },
    });
    const h = harness({}, spec);
    renderSpec(h);
    expect(screen.queryByTestId('badge')).not.toBeInTheDocument();
    h.lifecycle.dispose();

    const shown = harness({}, { ...spec, state: { mode: 'advanced' } });
    renderSpec(shown);
    expect(screen.getByTestId('badge')).toBeInTheDocument();
    shown.lifecycle.dispose();
  });

  it('showIf against $data reacts once the referenced source resolves', async () => {
    const spec = jobsSpec({
      nodes: {
        body: { type: 'panel-body', children: ['viewer', 'remoteBadge'] },
        viewer: { type: 'source-viewer', props: { bind: 'jobs' } },
        remoteBadge: {
          type: 'badge',
          props: { text: 'Remote friendly' },
          showIf: { $eq: ['$data.jobs.kind', 'remote'] },
        },
      },
    });
    const h = harness({ plan: () => ({ data: { kind: 'remote' } }) }, spec);
    renderSpec(h);

    expect(screen.queryByTestId('badge')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('badge')).toBeInTheDocument();
    });
    h.lifecycle.dispose();
  });
});
