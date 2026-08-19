---
lrn: lrn::en:platform:agentable-canvas.feature.telemetry-event-coverage::doc
related_docs:
  - docs/features/telemetry-event-catalog.md
  - docs/features/telemetry-sink-boundary.md
  - docs/features/compose-eval-harness.md
changelog:
  - date: 2026-07-21
    summary: Link to full telemetry event catalog.
  - date: 2026-07-21
    summary: event coverage for compose/HITL/tool/voice/cost with frozen error-code snapshots.
---

# Telemetry event coverage 

Extends the host sink boundary with full event families and snapshot-tested frozen error codes.

## Event families

| Family | Emitted from | Outcomes |
|--------|--------------|----------|
| `compose` | `compose_panel`, `patch_panel` validation | `rejected`, `success`, `repaired_success` + `errorCodes` |
| `hitl` | `run_panel_action` approval queue | `queued`, `approved`, `rejected`, `timeout` (typed) |
| `tool` | `createAgentToolExecutor` | `success`, `error` + `latencyMs` + frozen `errorCodes` |
| `voice` | `bindVoiceTelemetry` on voice kernel | `connected`, `dropped`, `reconnected`, `error` |
| `cost` | `wrapBudgetWithTelemetry` on tool spend | `recorded`, `refused` + `costClass` |
| `embed` | `emitEmbedRateLimitTelemetry` | `allowed`, `refused` + `RATE_LIMITED` |

Full catalog with field reference and reference sink example: [telemetry-event-catalog.md](./telemetry-event-catalog.md).

## Frozen error codes

All `errorCodes` on telemetry events must be members of `FROZEN_TELEMETRY_ERROR_CODES` ( repair vocabulary plus tool/voice/cost layer codes). Snapshot-tested in `tests/unit/telemetryFrozenCodes.test.ts`.

## Modules

| Module | Role |
|--------|------|
| `src/telemetry/frozenErrorCodes.ts` | Canonical frozen code union |
| `src/telemetry/extractToolErrorCodes.ts` | Map tool results → frozen codes |
| `src/telemetry/voiceBridge.ts` | Voice kernel → telemetry |
| `src/telemetry/budgetBridge.ts` | Budget spend → cost telemetry |
| `src/agents/toolExecutor.ts` | Tool latency/error emissions |
| `src/agents/runtime.ts` | Wires budget + tool executor telemetry |

## Automated checks

```bash
npm run test -- telemetryEventCoverage
npm run test -- telemetryFrozenCodes
npm run lint
```

Integration test `tests/integration/telemetryEventCoverage.test.ts` asserts all five families on a mock sink with frozen-code snapshot on emitted error codes.
