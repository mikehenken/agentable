/**
 * spec devtools session + row mapping unit tests.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { defineSchemaPanel } from '../../src/panels/builder';
import type { PanelSpec } from '../../src/panels/types';
import {
  createSpecDevtoolsSession,
  resetSpecDevtoolsCounterForTests,
} from '../../src/devtools/specDevtoolsSession';
import {
  extractBindingRowsFromSpec,
  mapValidationIssuesToRows,
} from '../../src/devtools/specDevtoolsRows';

const SAMPLE = defineSchemaPanel({
  id: 'devtools-sample',
  meta: {
    title: 'Sample',
    schemaVersion: 1,
    agentDescription: 'Sample panel for devtools tests.',
  },
  sources: {
    seo: { source: 'site.seo' },
  },
  actions: {
    save: { kind: 'mutate', source: 'site.seo', op: 'update', mutates: true },
  },
  blocks: [{ block: 'header', title: 'Sample' }],
} as const satisfies Parameters<typeof defineSchemaPanel>[0]);

describe('spec devtools row mapping', () => {
  it('maps validation issues to trace rows', () => {
    const rows = mapValidationIssuesToRows(
      [
        {
          code: 'SPEC_ACTION_REF_MISSING',
          message: 'missing action',
          severity: 'error',
          nodeId: 'actions',
        },
      ],
      'trace');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.code).toBe('SPEC_ACTION_REF_MISSING');
    expect(rows[0]?.nodeId).toBe('actions');
  });

  it('extracts source, state, and action bindings from a spec', () => {
    const spec = SAMPLE.spec as PanelSpec;
    const rows = extractBindingRowsFromSpec({...spec,
      state: { draft: true },
    });
    expect(rows.some((row) => row.kind === 'source' && row.key === 'seo')).toBe(true);
    expect(rows.some((row) => row.kind === 'state' && row.key === 'draft')).toBe(true);
    expect(rows.some((row) => row.kind === 'action' && row.key === 'save')).toBe(true);
  });
});

describe('spec devtools session', () => {
  beforeEach(() => {
    resetSpecDevtoolsCounterForTests();
  });

  it('records validation inspection and repair history', () => {
    const session = createSpecDevtoolsSession();
    session.inspectSpec({
      targetLabel: 'playground',
      spec: SAMPLE.spec as PanelSpec,
      errors: [
        {
          code: 'SPEC_ACTION_REF_MISSING',
          message: 'missing action ref',
          severity: 'error',
        },
      ],
    });
    session.recordRepairAttempt({
      targetLabel: 'playground',
      spec: SAMPLE.spec as PanelSpec,
      errors: [
        {
          code: 'SPEC_ACTION_REF_MISSING',
          message: 'missing action ref',
          severity: 'error',
        },
      ],
      repairEligible: true,
      operation: 'compose',
    });

    const snapshot = session.getSnapshot;
    expect(snapshot().validationTrace).toHaveLength(1);
    expect(snapshot().bindings.length).toBeGreaterThan(0);
    expect(snapshot().eventHistory.some((entry) => entry.kind === 'validation')).toBe(true);
    expect(snapshot().eventHistory.some((entry) => entry.kind === 'repair')).toBe(true);
  });

  it('notifies subscribers on inspect', () => {
    const session = createSpecDevtoolsSession();
    let notifyCount = 0;
    session.subscribe(() => {
      notifyCount += 1;
    });
    session.inspectSpec({
      targetLabel: 'playground',
      spec: SAMPLE.spec as PanelSpec,
    });
    expect(notifyCount).toBe(1);
  });
});
