/**
 * compose eval harness — reproducibility, metrics, regression gate.
 */
import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../eval/compose/seededRandom';
import { createSeededEvalAdapter } from '../eval/compose/seededAdapter';
import { createFixedClock } from '../eval/compose/fixedClock';
import {
  aggregateModelMetrics,
  deriveCaseOutcome,
  type ComposeEvalAttemptRecord,
} from '../eval/compose/metrics';
import {
  DEFAULT_COMPOSE_EVAL_BASELINE,
  evaluateComposeEvalRegressionGate,
} from '../eval/compose/regressionGate';
import {
  fingerprintResultsTable,
  formatResultsTableMarkdown,
} from '../eval/compose/resultsTable';
import {
  loadDefaultComposeEvalSuite,
  runComposeEvalHarness,
} from '../eval/compose/harness';

const EXPECTED_FINGERPRINT =
  '{"clockIso":"2026-07-21T17:00:00.000Z","modelMetrics":[{"caseCount":2,"composeSuccessRate":0.5,"modelId":"mock-model-alpha","rejectionReasons":{"SPEC_ACTION_REF_MISSING":2},"repairEligibleFailures":1,"repairRate":0,"repairSuccesses":0,"successCount":1},{"caseCount":2,"composeSuccessRate":0,"modelId":"mock-model-beta","rejectionReasons":{"SPEC_ACTION_REF_MISSING":2,"VALIDATION":1},"repairEligibleFailures":1,"repairRate":0,"repairSuccesses":0,"successCount":0},{"caseCount":2,"composeSuccessRate":0.5,"modelId":"mock-model-gamma","rejectionReasons":{"SPEC_ACTION_REF_MISSING":3},"repairEligibleFailures":2,"repairRate":0.5,"repairSuccesses":1,"successCount":1}],"rows":[{"attempts":2,"caseId":"alpha-terminal-invalid","modelId":"mock-model-alpha","outcome":"repair_failed","primaryRejectionCode":"SPEC_ACTION_REF_MISSING","rejectionCodes":["SPEC_ACTION_REF_MISSING","SPEC_ACTION_REF_MISSING"]},{"attempts":1,"caseId":"alpha-valid-first-attempt","modelId":"mock-model-alpha","outcome":"success","primaryRejectionCode":null,"rejectionCodes":[]},{"attempts":1,"caseId":"beta-non-object-spec","modelId":"mock-model-beta","outcome":"rejected","primaryRejectionCode":"VALIDATION","rejectionCodes":["VALIDATION"]},{"attempts":2,"caseId":"beta-terminal-invalid","modelId":"mock-model-beta","outcome":"repair_failed","primaryRejectionCode":"SPEC_ACTION_REF_MISSING","rejectionCodes":["SPEC_ACTION_REF_MISSING","SPEC_ACTION_REF_MISSING"]},{"attempts":2,"caseId":"gamma-repair-failed","modelId":"mock-model-gamma","outcome":"repair_failed","primaryRejectionCode":"SPEC_ACTION_REF_MISSING","rejectionCodes":["SPEC_ACTION_REF_MISSING","SPEC_ACTION_REF_MISSING"]},{"attempts":2,"caseId":"gamma-repair-then-valid","modelId":"mock-model-gamma","outcome":"repaired_success","primaryRejectionCode":"SPEC_ACTION_REF_MISSING","rejectionCodes":["SPEC_ACTION_REF_MISSING"]}],"seed":180018}';

describe('compose eval seeded utilities ', () => {
  it('createSeededRandom produces identical sequences for the same seed', () => {
    const left = createSeededRandom(180018);
    const right = createSeededRandom(180018);
    const samples = Array.from({ length: 8 }, () => [left(), right()]);
    for (const [a, b] of samples) {
      expect(a).toBe(b);
    }
    expect(left.int(1, 100)).toBe(right.int(1, 100));
  });

  it('createSeededEvalAdapter returns deterministic site.seo payloads', async () => {
    const adapterA = createSeededEvalAdapter({ seed: 180018 });
    const adapterB = createSeededEvalAdapter({ seed: 180018 });
    const scope = { contextId: 'eval', entityId: 'page-1' };
    const signal = new AbortController().signal;

    const rowA = await adapterA.query({ source: 'site.seo' }, scope, signal);
    const rowB = await adapterB.query({ source: 'site.seo' }, scope, signal);
    expect(rowA).toEqual(rowB);
  });

  it('createFixedClock advances deterministically', () => {
    const clock = createFixedClock('2026-07-21T17:00:00.000Z');
    expect(clock.nowIso).toBe('2026-07-21T17:00:00.000Z');
    clock.advance(250);
    expect(clock.nowIso).toBe('2026-07-21T17:00:00.250Z');
    expect(clock.elapsedMs).toBe(250);
  });
});

describe('compose eval metrics ', () => {
  it('deriveCaseOutcome classifies success, repair, and rejection paths', () => {
    const successAttempts: ComposeEvalAttemptRecord[] = [
      { attemptIndex: 0, phase: 'compose', ok: true, agentRepairEligible: false, rejectionCodes: [] },
    ];
    expect(deriveCaseOutcome(successAttempts)).toBe('success');

    const repairedAttempts: ComposeEvalAttemptRecord[] = [
      {
        attemptIndex: 0,
        phase: 'compose',
        ok: false,
        agentRepairEligible: true,
        rejectionCodes: ['SPEC_ACTION_REF_MISSING'],
      },
      { attemptIndex: 1, phase: 'repair', ok: true, agentRepairEligible: false, rejectionCodes: [] },
    ];
    expect(deriveCaseOutcome(repairedAttempts)).toBe('repaired_success');

    const repairFailedAttempts: ComposeEvalAttemptRecord[] = [
      {
        attemptIndex: 0,
        phase: 'compose',
        ok: false,
        agentRepairEligible: true,
        rejectionCodes: ['SPEC_ACTION_REF_MISSING'],
      },
      {
        attemptIndex: 1,
        phase: 'repair',
        ok: false,
        agentRepairEligible: false,
        rejectionCodes: ['SPEC_ACTION_REF_MISSING'],
      },
    ];
    expect(deriveCaseOutcome(repairFailedAttempts)).toBe('repair_failed');
  });
});

describe('compose eval harness ', () => {
  it('loads the default fixture suite with three mock models and six cases', () => {
    const suite = loadDefaultComposeEvalSuite;
    expect(suite().seed).toBe(180018);
    expect(suite().models).toHaveLength(3);
    expect(suite().cases).toHaveLength(6);
  });

  it('produces identical fingerprints across repeated runs with the same seed', async () => {
    const first = await runComposeEvalHarness();
    const second = await runComposeEvalHarness();

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.table.rows).toHaveLength(6);
    expect(first.table.modelMetrics).toHaveLength(3);
  });

  it('matches the frozen baseline fingerprint for seed 180018', async () => {
    const run = await runComposeEvalHarness();
    expect(run.fingerprint).toBe(EXPECTED_FINGERPRINT);
  });

  it('aggregates per-model compose success, repair rate, and rejection reasons', async () => {
    const run = await runComposeEvalHarness();
    const alpha = run.table.modelMetrics.find((metric) => metric.modelId === 'mock-model-alpha');
    const gamma = run.table.modelMetrics.find((metric) => metric.modelId === 'mock-model-gamma');

    expect(alpha?.composeSuccessRate).toBe(0.5);
    expect(alpha?.rejectionReasons.SPEC_ACTION_REF_MISSING).toBeGreaterThan(0);
    expect(gamma?.repairRate).toBe(0.5);
    expect(gamma?.successCount).toBe(1);

    const markdown = formatResultsTableMarkdown(run.table);
    expect(markdown).toContain('mock-model-gamma');
    expect(markdown).toContain('repaired_success');
  });

  it('passes the default CI regression gate scaffold', async () => {
    const run = await runComposeEvalHarness();
    const gate = evaluateComposeEvalRegressionGate(run.table, DEFAULT_COMPOSE_EVAL_BASELINE);
    expect(gate.ok).toBe(true);
    expect(gate.violations).toEqual([]);
    expect(run.regression.ok).toBe(true);
  });

  it('fails regression gate when compose success floor is unreachable', async () => {
    const run = await runComposeEvalHarness();
    const gate = evaluateComposeEvalRegressionGate(run.table, {
      minComposeSuccessRate: 0.99,
    });
    expect(gate.ok).toBe(false);
    expect(gate.violations.some((entry) => entry.code === 'COMPOSE_SUCCESS_RATE')).toBe(true);
  });
});

describe('compose eval results table fingerprint stability', () => {
  it('builds stable fingerprints from aggregated metrics only', async () => {
    const run = await runComposeEvalHarness();
    const metricsOnly = aggregateModelMetrics(run.caseResults);
    const table = {...run.table,
      generatedAtIso: 'ignored-for-fingerprint',
      modelMetrics: metricsOnly,
    };
    expect(fingerprintResultsTable(table)).toBe(run.fingerprint);
  });
});
