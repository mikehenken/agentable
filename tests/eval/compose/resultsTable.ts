/**
 * results table structure for compose eval documentation.
 */
import type { ComposeEvalCaseResult, ComposeEvalModelMetrics } from './metrics';

export interface ComposeEvalResultRow {
  modelId: string;
  caseId: string;
  outcome: ComposeEvalCaseResult['outcome'];
  attempts: number;
  primaryRejectionCode: string | null;
  rejectionCodes: readonly string[];
  clockIso: string;
}

export interface ComposeEvalResultsTable {
  seed: number;
  clockIso: string;
  generatedAtIso: string;
  rows: readonly ComposeEvalResultRow[];
  modelMetrics: readonly ComposeEvalModelMetrics[];
}

export function buildResultsTable(input: {
  seed: number;
  clockIso: string;
  generatedAtIso: string;
  caseResults: readonly ComposeEvalCaseResult[];
  modelMetrics: readonly ComposeEvalModelMetrics[];
}): ComposeEvalResultsTable {
  const rows: ComposeEvalResultRow[] = input.caseResults.map((entry) => ({
    modelId: entry.modelId,
    caseId: entry.caseId,
    outcome: entry.outcome,
    attempts: entry.attempts.length,
    primaryRejectionCode: entry.primaryRejectionCode,
    rejectionCodes: entry.attempts.flatMap((attempt) => [...attempt.rejectionCodes]),
    clockIso: entry.clockIso,
  }));

  rows.sort((left, right) => {
    const modelCompare = left.modelId.localeCompare(right.modelId);
    if (modelCompare !== 0) {
      return modelCompare;
    }
    return left.caseId.localeCompare(right.caseId);
  });

  return {
    seed: input.seed,
    clockIso: input.clockIso,
    generatedAtIso: input.generatedAtIso,
    rows,
    modelMetrics: input.modelMetrics,
  };
}

export function formatResultsTableMarkdown(table: ComposeEvalResultsTable): string {
  const header = [
    '| Model | Case | Outcome | Attempts | Primary rejection |',
    '| --- | --- | --- | ---: | --- |',
  ];

  const body = table.rows.map((row) => {
    const rejection = row.primaryRejectionCode ?? '—';
    return `| ${row.modelId} | ${row.caseId} | ${row.outcome} | ${row.attempts} | ${rejection} |`;
  });

  const metricsHeader = [
    '',
    '### Per-model metrics',
    '',
    '| Model | Cases | Compose success | Repair rate | Top rejection |',
    '| --- | ---: | ---: | ---: | --- |',
  ];

  const metricsBody = table.modelMetrics.map((metric) => {
    const topRejection = topRejectionReason(metric.rejectionReasons);
    return `| ${metric.modelId} | ${metric.caseCount} | ${pct(metric.composeSuccessRate)} | ${pct(metric.repairRate)} | ${topRejection} |`;
  });

  return [
    `## Compose eval results (seed=${table.seed})`,
    '',
    `Clock anchor: \`${table.clockIso}\` · Generated: \`${table.generatedAtIso}\``,
    '',...header,...body,...metricsHeader,...metricsBody,
    '',
  ].join('\n');
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function topRejectionReason(reasons: Record<string, number>): string {
  const entries = Object.entries(reasons);
  if (entries.length === 0) {
    return '—';
  }
  entries.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const [code, count] = entries[0] ?? ['—', 0];
  return `${code} (${count})`;
}

/**
 * Stable fingerprint for reproducibility checks — excludes wall-clock timestamps
 * and non-deterministic panel ids.
 */
export function fingerprintResultsTable(table: ComposeEvalResultsTable): string {
  const payload = {
    seed: table.seed,
    clockIso: table.clockIso,
    rows: table.rows.map((row) => ({
      modelId: row.modelId,
      caseId: row.caseId,
      outcome: row.outcome,
      attempts: row.attempts,
      primaryRejectionCode: row.primaryRejectionCode,
      rejectionCodes: [...row.rejectionCodes].sort(),
    })),
    modelMetrics: table.modelMetrics.map((metric) => ({
      modelId: metric.modelId,
      caseCount: metric.caseCount,
      successCount: metric.successCount,
      composeSuccessRate: metric.composeSuccessRate,
      repairEligibleFailures: metric.repairEligibleFailures,
      repairSuccesses: metric.repairSuccesses,
      repairRate: metric.repairRate,
      rejectionReasons: metric.rejectionReasons,
    })),
  };

  return stableStringify(payload);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortKeys(entry));
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortKeys(record[key]);
    }
    return sorted;
  }
  return value;
}
