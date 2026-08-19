/**
 * CI regression gate scaffold for compose eval.
 */
import type { ComposeEvalModelMetrics } from './metrics';
import type { ComposeEvalResultsTable } from './resultsTable';

export interface ComposeEvalRegressionThresholds {
  /** Minimum overall compose success rate (0–1). */
  minComposeSuccessRate: number;
  /** Minimum repair success rate among repair-eligible first failures (0–1). */
  minRepairRate?: number;
  /** Per-model compose success floor; missing models use minComposeSuccessRate. */
  perModelMinComposeSuccessRate?: Record<string, number>;
  /** Maximum allowed count per rejection code across the run. */
  maxRejectionByCode?: Record<string, number>;
}

export interface ComposeEvalRegressionViolation {
  code: string;
  message: string;
}

export interface ComposeEvalRegressionGateResult {
  ok: boolean;
  violations: readonly ComposeEvalRegressionViolation[];
}

export const DEFAULT_COMPOSE_EVAL_BASELINE: ComposeEvalRegressionThresholds = {
  minComposeSuccessRate: 0.33,
  minRepairRate: 0.25,
  perModelMinComposeSuccessRate: {
    'mock-model-alpha': 0.5,
    'mock-model-beta': 0,
    'mock-model-gamma': 0.5,
  },
  maxRejectionByCode: {
    SPEC_ACTION_REF_MISSING: 8,
    VALIDATION: 2,
  },
};

export function evaluateComposeEvalRegressionGate(
  table: ComposeEvalResultsTable,
  thresholds: ComposeEvalRegressionThresholds = DEFAULT_COMPOSE_EVAL_BASELINE): ComposeEvalRegressionGateResult {
  const violations: ComposeEvalRegressionViolation[] = [];

  const overallSuccess =
    table.modelMetrics.reduce((sum, metric) => sum + metric.successCount, 0) /
    Math.max(
      1,
      table.modelMetrics.reduce((sum, metric) => sum + metric.caseCount, 0));

  if (overallSuccess < thresholds.minComposeSuccessRate) {
    violations.push({
      code: 'COMPOSE_SUCCESS_RATE',
      message: `overall compose success ${pct(overallSuccess)} below minimum ${pct(thresholds.minComposeSuccessRate)}`,
    });
  }

  if (thresholds.minRepairRate !== undefined) {
    const repairEligible = table.modelMetrics.reduce(
      (sum, metric) => sum + metric.repairEligibleFailures,
      0);
    const repairSuccesses = table.modelMetrics.reduce(
      (sum, metric) => sum + metric.repairSuccesses,
      0);
    const repairRate = repairEligible === 0 ? 0 : repairSuccesses / repairEligible;
    if (repairRate < thresholds.minRepairRate) {
      violations.push({
        code: 'REPAIR_RATE',
        message: `repair rate ${pct(repairRate)} below minimum ${pct(thresholds.minRepairRate)}`,
      });
    }
  }

  for (const metric of table.modelMetrics) {
    const floor =
      thresholds.perModelMinComposeSuccessRate?.[metric.modelId] ??
      thresholds.minComposeSuccessRate;
    if (metric.composeSuccessRate < floor) {
      violations.push({
        code: 'MODEL_COMPOSE_SUCCESS_RATE',
        message: `${metric.modelId} compose success ${pct(metric.composeSuccessRate)} below minimum ${pct(floor)}`,
      });
    }
  }

  if (thresholds.maxRejectionByCode !== undefined) {
    const totals = aggregateRejectionTotals(table.modelMetrics);
    for (const [code, maxCount] of Object.entries(thresholds.maxRejectionByCode)) {
      const observed = totals[code] ?? 0;
      if (observed > maxCount) {
        violations.push({
          code: 'REJECTION_BUDGET',
          message: `rejection code ${code} count ${observed} exceeds budget ${maxCount}`,
        });
      }
    }
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

function aggregateRejectionTotals(
  modelMetrics: readonly ComposeEvalModelMetrics[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const metric of modelMetrics) {
    for (const [code, count] of Object.entries(metric.rejectionReasons)) {
      totals[code] = (totals[code] ?? 0) + count;
    }
  }
  return totals;
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
