/**
 * automated check: Agent Activity panel virtualizes above row threshold.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  createActivityLog,
  createAgentActivityPanelDefinition,
  resetActivityLogCounterForTests,
  withActivitySource,
  type ActivityEntry,
} from '../../src/agents';
import { validateSpec, defaultCatalog } from '../../src/panels/spec';
import type { NormalizedPanelSpec } from '../../src/panels/spec';
import { createDataLifecycle, SpecRenderer } from '../../src/panels/renderer';
import type { DataLifecycle } from '../../src/panels/renderer';
import type { PanelScope } from '../../src/panels/types';
import {
  DEFAULT_OVERSCAN_ROWS,
  DEFAULT_ROW_HEIGHT_PX,
  DEFAULT_VIEWPORT_HEIGHT_PX,
  LIST_VIRTUALIZATION_THRESHOLD,
  maxWindowRowCount,
} from '../../src/panels/catalog/virtualization';
import type { AgentableVirtualListElement } from '../../src/panels/catalog/virtual-list';

const SCOPE: PanelScope = { contextId: 'debug', entityId: 'activity' };

const WINDOW_ROW_BOUND = maxWindowRowCount(
  DEFAULT_VIEWPORT_HEIGHT_PX,
  DEFAULT_ROW_HEIGHT_PX,
  DEFAULT_OVERSCAN_ROWS);

function reversalMeta(persisted = false): ActivityEntry['reversal'] {
  return { reversible: !persisted, persisted };
}

function activityPanelSpec(
  extraListProps: Record<string, unknown> = {}): NormalizedPanelSpec {
  const definition = createAgentActivityPanelDefinition();
  if (definition.kind !== 'spec') {
    throw new Error('expected spec panel definition');
  }
  const spec = structuredClone(definition.spec);
  const listNode = spec.nodes.list;
  if (listNode === undefined || listNode.type !== 'list') {
    throw new Error('activity panel spec missing list node');
  }
  listNode.props = {...(listNode.props ?? {}),...extraListProps,
  };
  const result = validateSpec(spec, {
    catalog: defaultCatalog,
    adapterSources: new Set(['agents.activity']),
    hostActions: new Set(),
    panelRegistry: new Set(['agent-activity']),
  });
  if (!result.ok) {
    throw new Error(`activity panel spec failed validation: ${JSON.stringify(result.errors)}`);
  }
  return result.spec;
}

interface Mounted {
  element: AgentableVirtualListElement;
  lifecycle: DataLifecycle;
  unmount: () => void;
}

async function mountActivityPanel(
  entryCount: number,
  extraListProps: Record<string, unknown> = {}): Promise<Mounted> {
  resetActivityLogCounterForTests();
  const activity = createActivityLog();
  for (let index = 0; index < entryCount; index += 1) {
    activity.append({
      actor: index % 3 === 0 ? 'user': `agent-${index % 4}`,
      verb: 'tool_call',
      target: `panel-${index}`,
      reversal: reversalMeta(false),
    });
  }

  const adapter = withActivitySource(activity);
  const lifecycle = createDataLifecycle({ adapter, retryBackoffMs: 5 });
  const view = render(
    <SpecRenderer
      spec={activityPanelSpec(extraListProps)}
      scope={SCOPE}
      lifecycle={lifecycle}
    />);

  await waitFor(() => {
    expect(screen.getByTestId('virtual-list')).toBeInTheDocument;
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

function viewport(element: AgentableVirtualListElement): HTMLElement {
  const found = element.shadowRoot?.querySelector<HTMLElement>('[part="viewport"]');
  if (found === null || found === undefined) {
    throw new Error('virtual list rendered no viewport');
  }
  return found;
}

describe('Agent Activity panel ', () => {
  beforeEach(() => {
    resetActivityLogCounterForTests();
  });

  it('compiles a Tier 2 spec panel bound to agents.activity', () => {
    const definition = createAgentActivityPanelDefinition();
    expect(definition.kind).toBe('spec');
    expect(definition.id).toBe('agent-activity');
    expect(definition.spec.sources?.entries?.source).toBe('agents.activity');
  });

  it('virtualizes above the row threshold', async () => {
    const aboveThreshold = LIST_VIRTUALIZATION_THRESHOLD + 1;
    expect(aboveThreshold).toBeGreaterThan(LIST_VIRTUALIZATION_THRESHOLD);

    const mounted = await mountActivityPanel(aboveThreshold);
    const { element } = mounted;

    expect(viewport(element).dataset.virtualized).toBe('true');

    const rows = shadowRows(element);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(WINDOW_ROW_BOUND);
    expect(rows[0]?.getAttribute('aria-setsize')).toBe(String(aboveThreshold));

    mounted.unmount();
  });

  it('does not virtualize at or below the threshold', async () => {
    const mounted = await mountActivityPanel(LIST_VIRTUALIZATION_THRESHOLD);
    expect(viewport(mounted.element).dataset.virtualized).toBe('false');
    expect(shadowRows(mounted.element)).toHaveLength(LIST_VIRTUALIZATION_THRESHOLD);
    mounted.unmount();
  });

  it('raises threshold above entry count to prove virtualization is required for the bound', async () => {
    const entryCount = LIST_VIRTUALIZATION_THRESHOLD + 10;
    const mounted = await mountActivityPanel(entryCount, { virtualizeThreshold: entryCount + 50 });
    expect(viewport(mounted.element).dataset.virtualized).toBe('false');
    expect(shadowRows(mounted.element)).toHaveLength(entryCount);
    mounted.unmount();
  });
});

describe('activity adapter row mapping', () => {
  it('maps ledger entries to list rows with stable ids', async () => {
    resetActivityLogCounterForTests();
    const activity = createActivityLog();
    const entry = activity.append({
      actor: 'agent-a',
      verb: 'run_panel_action',
      target: 'seo-panel',
      reversal: reversalMeta(true),
    });

    const adapter = withActivitySource(activity);
    const rows = (await adapter.query(
      { source: 'agents.activity' },
      SCOPE,
      new AbortController().signal)) as Array<{ id: string; title: string; subtitle: string }>;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(entry.id);
    expect(rows[0]?.title).toBe('run_panel_action seo-panel');
    expect(rows[0]?.subtitle).toContain('agent-a');
  });

  it('rejects mutate on the read-only activity source', async () => {
    const activity = createActivityLog();
    const adapter = withActivitySource(activity);
    const result = await adapter.mutate(
      { kind: 'mutate', id: 'noop', source: 'agents.activity' },
      {},
      SCOPE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('forbidden');
    }
  });
});
