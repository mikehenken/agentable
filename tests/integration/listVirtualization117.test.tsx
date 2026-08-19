/**
 * Automated check: a catalog list bound to the
 * 117-job moss reference fixture keeps its rendered DOM node count
 * bounded. The spec flows through `validateSpec` and `SpecRenderer`
 * against the instrumented mock adapter through the full catalog pipeline;
 * `<agentable-virtual-list>` (Lit `repeat`, stable keys).
 *
 * The counterfactual is proven in-suite: the same 117 rows rendered with
 * the per-instance threshold raised above the fixture size produce one
 * DOM row per item, which violates the bound the virtualized assertion
 * enforces. Without windowing, the bounded-DOM check fails.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { validateSpec, defaultCatalog } from '../../src/panels/spec';
import type { NormalizedPanelSpec } from '../../src/panels/spec';
import { createDataLifecycle, SpecRenderer } from '../../src/panels/renderer';
import type { DataLifecycle } from '../../src/panels/renderer';
import type { PanelScope, PanelSpec } from '../../src/panels/types';
import {
  DEFAULT_OVERSCAN_ROWS,
  DEFAULT_ROW_HEIGHT_PX,
  DEFAULT_VIEWPORT_HEIGHT_PX,
  LIST_VIRTUALIZATION_THRESHOLD,
  maxWindowRowCount,
} from '../../src/panels/catalog/virtualization';
import type { AgentableVirtualListElement } from '../../src/panels/catalog/virtual-list';
import { createMockDataAdapter } from '../helpers/mockDataAdapter';
import fixture from '../fixtures/moss-jobs-117.json';

interface FixtureJob {
  id: number;
  title: string;
  department: string;
  [key: string]: unknown;
}

const JOBS: FixtureJob[] = (fixture as { jobs: FixtureJob[] }).jobs;
const SCOPE: PanelScope = { contextId: 'moss', entityId: 'careers' };

/** Rows the virtualized window may render for the default geometry. */
const WINDOW_ROW_BOUND = maxWindowRowCount(
  DEFAULT_VIEWPORT_HEIGHT_PX,
  DEFAULT_ROW_HEIGHT_PX,
  DEFAULT_OVERSCAN_ROWS);

function jobsListSpec(extraListProps: Record<string, unknown> = {}): NormalizedPanelSpec {
  const spec: PanelSpec = {
    v: 1,
    origin: 'host',
    root: 'body',
    sources: {
      jobs: { source: 'career.jobs' },
    },
    nodes: {
      body: { type: 'panel-body', children: ['positions'] },
      positions: {
        type: 'list',
        props: {
          bind: 'jobs',
          row: { title: 'title', subtitle: 'department' },...extraListProps,
        },
      },
    },
  };
  const result = validateSpec(spec, {
    catalog: defaultCatalog,
    adapterSources: new Set(['career.jobs']),
    hostActions: new Set(),
    panelRegistry: new Set(),
  });
  if (!result.ok) {
    throw new Error(`fixture spec failed validation: ${JSON.stringify(result.errors)}`);
  }
  return result.spec;
}

interface Mounted {
  element: AgentableVirtualListElement;
  lifecycle: DataLifecycle;
  unmount: () => void;
}

async function mountJobsList(extraListProps: Record<string, unknown> = {}): Promise<Mounted> {
  const adapter = createMockDataAdapter({
    latencyMs: 5,
    plan: () => ({ data: JOBS }),
  });
  const lifecycle = createDataLifecycle({ adapter, retryBackoffMs: 5 });
  const view = render(
    <SpecRenderer spec={jobsListSpec(extraListProps)} scope={SCOPE} lifecycle={lifecycle} />);
  await waitFor(() => {
    expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
  });
  const element = screen.getByTestId('virtual-list') as AgentableVirtualListElement;
  await element.updateComplete;
  return {
    element,
    lifecycle,
    unmount: () => {
      view.unmount();
      lifecycle.dispose();
    },
  };
}

function shadowRows(element: AgentableVirtualListElement): HTMLElement[] {
  return Array.from(element.shadowRoot?.querySelectorAll<HTMLElement>('[data-row-key]') ?? []);
}

function shadowElementCount(element: AgentableVirtualListElement): number {
  return element.shadowRoot?.querySelectorAll('*').length ?? 0;
}

function viewport(element: AgentableVirtualListElement): HTMLElement {
  const found = element.shadowRoot?.querySelector<HTMLElement>('[part="viewport"]');
  if (found === null || found === undefined) {
    throw new Error('virtual list rendered no viewport');
  }
  return found;
}

describe('D56 list virtualization: 117-job moss fixture keeps DOM bounded', () => {
  it('loads the real reference fixture (117 jobs, unique ids)', () => {
    expect(JOBS).toHaveLength(117);
    expect(new Set(JOBS.map((job) => job.id)).size).toBe(117);
    expect(JOBS.length).toBeGreaterThan(LIST_VIRTUALIZATION_THRESHOLD);
  });

  it('renders 117 bound rows with a bounded DOM node count, not one row per item', async () => {
    const mounted = await mountJobsList();
    const { element } = mounted;

    expect(viewport(element).dataset.virtualized).toBe('true');

    const rows = shadowRows(element);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(WINDOW_ROW_BOUND);

    // The whole shadow tree stays smaller than one element per item;
    // an O(n) full render could not satisfy this.
    expect(shadowElementCount(element)).toBeLessThan(JOBS.length);

    // Real fixture content reaches the window rows.
    expect(rows[0]?.dataset.rowKey).toBe(String(JOBS[0]?.id));
    expect(rows[0]?.textContent).toContain(JOBS[0]?.title ?? '');

    // Scroll geometry still accounts for every item.
    expect(rows[0]?.getAttribute('aria-setsize')).toBe('117');
    mounted.unmount();
  });

  it('fails the bound without virtualization: threshold above 117 renders all rows', async () => {
    const mounted = await mountJobsList({ virtualizeThreshold: 200 });
    const { element } = mounted;

    expect(viewport(element).dataset.virtualized).toBe('false');
    const rows = shadowRows(element);
    expect(rows).toHaveLength(117);
    // This is the counterfactual: the un-windowed render violates the
    // exact bound the virtualized assertion above enforces.
    expect(rows.length).toBeGreaterThan(WINDOW_ROW_BOUND);
    expect(shadowElementCount(element)).toBeGreaterThan(JOBS.length);
    mounted.unmount();
  });

  it('windows follow scroll while the DOM stays bounded and total height is preserved', async () => {
    const mounted = await mountJobsList();
    const { element } = mounted;
    const scroller = viewport(element);

    const before = shadowRows(element);
    const firstKeyBefore = before[0]?.dataset.rowKey;

    scroller.scrollTop = 60 * DEFAULT_ROW_HEIGHT_PX;
    scroller.dispatchEvent(new Event('scroll'));
    await element.updateComplete;

    const after = shadowRows(element);
    expect(after.length).toBeLessThanOrEqual(WINDOW_ROW_BOUND);
    expect(after[0]?.dataset.rowKey).not.toBe(firstKeyBefore);
    expect(Number(scroller.dataset.windowStart)).toBeGreaterThan(0);

    // Spacers plus rendered rows keep the scrollable height at 117 rows.
    const spacer = element.shadowRoot?.querySelector<HTMLElement>('[part="spacer"]');
    const padTop = Number.parseFloat(spacer?.style.paddingTop ?? '0');
    const padBottom = Number.parseFloat(spacer?.style.paddingBottom ?? '0');
    expect(padTop + padBottom + after.length * DEFAULT_ROW_HEIGHT_PX).toBe(
      117 * DEFAULT_ROW_HEIGHT_PX);
    mounted.unmount();
  });

  it('reuses row DOM across window moves via stable repeat keys', async () => {
    const mounted = await mountJobsList();
    const { element } = mounted;
    const scroller = viewport(element);

    const target = shadowRows(element).find((row) => row.dataset.rowKey === String(JOBS[10]?.id));
    expect(target).toBeDefined();

    // A small scroll keeps row 10 inside the window; repeat's stable key
    // must reuse the same element rather than rebuilding it.
    scroller.scrollTop = 2 * DEFAULT_ROW_HEIGHT_PX;
    scroller.dispatchEvent(new Event('scroll'));
    await element.updateComplete;

    const reused = shadowRows(element).find(
      (row) => row.dataset.rowKey === String(JOBS[10]?.id));
    expect(reused).toBe(target);
    mounted.unmount();
  });

  it('keeps non-array bound data on the legacy presentational path', async () => {
    const adapter = createMockDataAdapter({ latencyMs: 5 });
    const lifecycle = createDataLifecycle({ adapter, retryBackoffMs: 5 });
    const view = render(
      <SpecRenderer spec={jobsListSpec()} scope={SCOPE} lifecycle={lifecycle} />);
    await waitFor(() => {
      expect(screen.getByTestId('list').textContent).toContain('jobs');
    });
    expect(screen.queryByTestId('virtual-list')).not.toBeInTheDocument();
    view.unmount();
    lifecycle.dispose();
  });
});
