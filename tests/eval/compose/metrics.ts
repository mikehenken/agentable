/**
 * Per-model compose eval metrics.
 */
import type { RepairErrorCode } from '../../../src/panels/spec/repairVocabulary';

export type ComposeEvalOutcome =
  | 'success'
  | 'repaired_success'
  | 'repair_failed'
  | 'rejected';

export interface ComposeEvalAttemptRecord {
  attemptIndex: number;
  phase: 'compose' | 'repair';
  ok: boolean;
  agentRepairEligible: boolean;
  rejectionCodes: readonly RepairErrorCode[];
}

export interface ComposeEvalCaseResult {
  caseId: string;
  modelId: string;
  outcome: ComposeEvalOutcome;
  attempts: readonly ComposeEvalAttemptRecord[];
  primaryRejectionCode: RepairErrorCode | null;
  clockIso: string;
}

export interface ComposeEvalModelMetrics {
  modelId: string;
  caseCount: number;
  successCount: number;
  composeSuccessRate: number;
  repairEligibleFailures: number;
  repairSuccesses: number;
  repairRate: number;
  rejectionReasons: Record<string, number>;
}

export interface ComposeEvalAggregateMetrics {
  caseCount: number;
  composeSuccessRate: number;
  repairRate: number;
  rejectionReasons: Record<string, number>;
}

function countRejection(
  bucket: Record<string, number>,
  code: RepairErrorCode | null): void {
  if (code === null) {
    return;
  }
  bucket[code] = (bucket[code] ?? 0) + 1;
}

export function deriveCaseOutcome(attempts: readonly ComposeEvalAttemptRecord[]): ComposeEvalOutcome {
  if (attempts.length === 0) {
    return 'rejected';
  }

  const last = attempts[attempts.length - 1];
  if (last?.ok === true) {
    return attempts.length === 1 ? 'success': 'repaired_success';
  }

  const hadRepairEligible = attempts.some((entry) => entry.agentRepairEligible);
  if (hadRepairEligible && attempts.length > 1) {
    return 'repair_failed';
  }

  return 'rejected';
}

export function primaryRejectionCode(
  attempts: readonly ComposeEvalAttemptRecord[]): RepairErrorCode | null {
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    const attempt = attempts[index];
    if (attempt === undefined || attempt.ok) {
      continue;
    }
    return attempt.rejectionCodes[0] ?? null;
  }
  return null;
}

export function aggregateModelMetrics(
  caseResults: readonly ComposeEvalCaseResult[]): ComposeEvalModelMetrics[] {
  const byModel = new Map<string, ComposeEvalCaseResult[]>();

  for (const row of caseResults) {
    const existing = byModel.get(row.modelId) ?? [];
    existing.push(row);
    byModel.set(row.modelId, existing);
  }

  return [...byModel.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([modelId, rows]) => {
      const rejectionReasons: Record<string, number> = {};
      let successCount = 0;
      let repairEligibleFailures = 0;
      let repairSuccesses = 0;

      for (const row of rows) {
        if (row.outcome === 'success' || row.outcome === 'repaired_success') {
          successCount += 1;
        }
        if (row.outcome === 'repaired_success') {
          repairSuccesses += 1;
        }

        const firstAttempt = row.attempts[0];
        if (firstAttempt !== undefined && !firstAttempt.ok && firstAttempt.agentRepairEligible) {
          repairEligibleFailures += 1;
        }

        for (const attempt of row.attempts) {
          for (const code of attempt.rejectionCodes) {
            countRejection(rejectionReasons, code);
          }
        }
      }

      const caseCount = rows.length;
      const composeSuccessRate = caseCount === 0 ? 0: successCount / caseCount;
      const repairRate =
        repairEligibleFailures === 0 ? 0: repairSuccesses / repairEligibleFailures;

      return {
        modelId,
        caseCount,
        successCount,
        composeSuccessRate,
        repairEligibleFailures,
        repairSuccesses,
        repairRate,
        rejectionReasons,
      };
    });
}

export function aggregateOverallMetrics(
  modelMetrics: readonly ComposeEvalModelMetrics[]): ComposeEvalAggregateMetrics {
  const rejectionReasons: Record<string, number> = {};
  let caseCount = 0;
  let successCount = 0;
  let repairEligibleFailures = 0;
  let repairSuccesses = 0;

  for (const model of modelMetrics) {
    caseCount += model.caseCount;
    successCount += model.successCount;
    repairEligibleFailures += model.repairEligibleFailures;
    repairSuccesses += model.repairSuccesses;
    for (const [code, count] of Object.entries(model.rejectionReasons)) {
      rejectionReasons[code] = (rejectionReasons[code] ?? 0) + count;
    }
  }

  return {
    caseCount,
    composeSuccessRate: caseCount === 0 ? 0: successCount / caseCount,
    repairRate: repairEligibleFailures === 0 ? 0: repairSuccesses / repairEligibleFailures,
    rejectionReasons,
  };
}
