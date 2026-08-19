---
lrn: lrn::en:platform:agentable-canvas.feature.compose-eval-harness::doc
related_docs:
  - docs/features/panel-devtools-spec-playground.md
  - docs/features/a2ui-ingestion-adapter.md
changelog:
  - date: 2026-07-21
    summary: compose eval harness with seeded adapter, fixed clock, per-model metrics, and CI regression gate.
---

# Compose eval harness 

Deterministic **`compose_panel`** evaluation harness for orchestration. Uses **seeded adapters**, a **fixed clock**, and **mock model stubs** — no live model calls in v1.

## Components

| Module | Purpose |
|--------|---------|
| `tests/eval/compose/fixedClock.ts` | Deterministic clock anchor for run timestamps |
| `tests/eval/compose/seededRandom.ts` | Mulberry32 PRNG for adapter payloads |
| `tests/eval/compose/seededAdapter.ts` | `DataAdapter` with seed-derived `site.seo` data |
| `tests/eval/compose/mockModelProvider.ts` | Scripted model responses per case |
| `tests/eval/compose/metrics.ts` | Compose success, repair rate, rejection aggregation |
| `tests/eval/compose/resultsTable.ts` | results table + markdown formatter |
| `tests/eval/compose/regressionGate.ts` | CI regression thresholds scaffold |
| `tests/eval/compose/harness.ts` | End-to-end runner over `createPanelToolRuntime` |

Default fixture: `tests/eval/compose/fixtures/compose-eval-suite.json` (seed **180018**, three mock models, six cases).

## Metrics

Per model:

- **Compose success rate** — cases ending in `success` or `repaired_success`
- **Repair rate** — repair successes ÷ repair-eligible first failures
- **Rejection reasons** — aggregated structured error codes (`SPEC_ACTION_REF_MISSING`, `VALIDATION`, …)

## results table

`buildResultsTable` emits row-level outcomes plus per-model summaries. `formatResultsTableMarkdown` renders a doc-ready markdown table. `fingerprintResultsTable` produces a stable reproducibility hash (excludes wall-clock `generatedAtIso`).

## CI regression gate

`evaluateComposeEvalRegressionGate` compares a run against `DEFAULT_COMPOSE_EVAL_BASELINE`:

- Overall compose success floor
- Optional repair-rate floor
- Per-model compose success floors
- Rejection-code budgets

CLI entry:

```bash
npm run test:compose-eval
node scripts/run-compose-eval.mjs --write-log
```

## Tests

- `tests/unit/composeEvalHarness.test.ts` — seeded reproducibility, metrics, regression gate (11 tests)

Vitest proves identical fingerprints across repeated runs with seed **180018**.

## Dependencies

- P3 panel tools (`compose_panel`, repair round)
- /T2 helpful context (devtools trace patterns; no runtime coupling required)
