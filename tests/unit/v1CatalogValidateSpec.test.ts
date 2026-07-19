import { describe, expect, it } from 'vitest';
import { validateSpec, defaultCatalog } from '../../src/panels/spec';
import type { PanelSpec } from '../../src/panels/types';

describe('validateSpec with defaultCatalog', () => {
  const baseContext = {
    catalog: defaultCatalog,
    adapterSources: new Set(['site.seo']),
    hostActions: new Set(['switchPage']),
    panelRegistry: new Set(['job-detail']),
  };

  const createSpec = (nodes: PanelSpec['nodes']): PanelSpec => ({
    v: 1,
    origin: 'host',
    root: 'body',
    nodes: {
      body: { type: 'panel-body', children: ['target'] },
      ...nodes,
    },
  });

  it('validates panel-body correctly', () => {
    const spec = createSpec({
      target: { type: 'panel-body' },
    });
    expect(validateSpec(spec, baseContext).ok).toBe(true);
  });

  it('validates header correctly', () => {
    const spec = createSpec({
      target: { type: 'header', props: { title: 'Hello', subtitle: 'World' } },
    });
    expect(validateSpec(spec, baseContext).ok).toBe(true);
  });

  it('validates field-form correctly', () => {
    const spec = createSpec({
      target: { type: 'field-form', props: { bind: 'site.seo', fields: [{ bind: 'title' }] } },
    });
    expect(validateSpec(spec, baseContext).ok).toBe(true);
  });

  it('validates action-row correctly', () => {
    const spec = createSpec({
      target: { type: 'action-row', props: { actions: ['save'] } },
    });
    const specWithAction: PanelSpec = {
      ...spec,
      actions: { save: { kind: 'mutate', source: 'site.seo', op: 'update' } },
    };
    expect(validateSpec(specWithAction, baseContext).ok).toBe(true);
  });

  it('validates list correctly', () => {
    const spec = createSpec({
      target: { type: 'list', props: { bind: 'site.seo', row: { title: 'test' } } },
    });
    expect(validateSpec(spec, baseContext).ok).toBe(true);
  });

  it('validates table correctly', () => {
    const spec = createSpec({
      target: { type: 'table', props: { bind: 'site.seo', columns: [{ id: 'col1', label: 'Col 1' }] } },
    });
    expect(validateSpec(spec, baseContext).ok).toBe(true);
  });

  it('validates badge correctly', () => {
    const spec = createSpec({
      target: { type: 'badge', props: { text: 'Active', tone: 'success' } },
    });
    expect(validateSpec(spec, baseContext).ok).toBe(true);
  });

  it('validates tabs correctly', () => {
    const spec = createSpec({
      target: { type: 'tabs', props: { tabs: [{ id: 't1', label: 'Tab 1', child: 'tab-content' }] } },
      'tab-content': { type: 'panel-body' },
    });
    expect(validateSpec(spec, baseContext).ok).toBe(true);
  });

  it('validates confirm correctly', () => {
    const spec = createSpec({
      target: { type: 'confirm' },
    });
    expect(validateSpec(spec, baseContext).ok).toBe(true);
  });

  it('validates stale-banner correctly', () => {
    const spec = createSpec({
      target: { type: 'stale-banner' },
    });
    expect(validateSpec(spec, baseContext).ok).toBe(true);
  });

  it('validates empty-state correctly', () => {
    const spec = createSpec({
      target: { type: 'empty-state', props: { message: 'Nothing here' } },
    });
    expect(validateSpec(spec, baseContext).ok).toBe(true);
  });

  it('validates filter-chips correctly', () => {
    const spec = createSpec({
      target: { type: 'filter-chips', props: { bind: 'site.seo' } },
    });
    expect(validateSpec(spec, baseContext).ok).toBe(true);
  });

  it('validates custom-slot correctly', () => {
    const spec = createSpec({
      target: { type: 'custom-slot', props: { name: 'job-detail' } },
    });
    expect(validateSpec(spec, baseContext).ok).toBe(true);
  });
});
