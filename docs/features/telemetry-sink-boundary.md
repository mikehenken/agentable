---
lrn: lrn::en:platform:agentable-canvas.feature.telemetry-sink-boundary::doc
related_docs:
  - docs/features/telemetry-event-catalog.md
  - docs/features/compose-eval-harness.md
  - docs/features/panel-devtools-spec-playground.md
changelog:
  - date: 2026-07-21
    summary: Link to published telemetry event catalog and reference sink.
  - date: 2026-07-21
    summary: emit-boundary redaction guarantee for PII and keys.
  - date: 2026-07-21
    summary: embed rate-limit telemetry with frozen RATE_LIMITED code.
  - date: 2026-07-21
    summary: event coverage for tool/voice/cost families with frozen error-code snapshots.
  - date: 2026-07-21
    summary: host.telemetry.emit sink boundary with compose/HITL emissions.
---

# Telemetry sink boundary
Runtime observability boundary for. The framework emits structured, host-routable telemetry events; the host registers a sink the same way it registers a model resolver.

## Host API

| Surface | Purpose |
|---------|---------|
| `host.telemetry.registerSink(sink)` | Register a host-supplied sink; returns unregister |
| `host.telemetry.emit(event)` | Emit a structured event to the active sink (no-op when unset) |
| `createCanvasHost({ telemetrySink })` | Optional initial sink at host construction |

Voice kernel state is bridged automatically via `bindVoiceTelemetry` when a canvas host is created.

## Event families

| Family | Emitted from | Outcomes |
|--------|--------------|----------|
| `compose` | `compose_panel`, `patch_panel` validation | `rejected`, `success`, `repaired_success` |
| `hitl` | `run_panel_action` HITL queue | `queued`, `approved`, `rejected`, `timeout` (typed) |
| `tool` | Scoped agent tool executor | `success`, `error` + `latencyMs` |
| `voice` | Shared voice kernel bridge | `connected`, `dropped`, `reconnected`, `error` |
| `cost` | Budget signal wrapper | `recorded`, `refused` |

Embed-family rate-limit refusals use the frozen `RATE_LIMITED` code. Redaction guarantees run at the emit boundary (`redactTelemetryEvent` in `hostTelemetry.emit`). The full event catalog is published in [telemetry-event-catalog.md](./telemetry-event-catalog.md).

## Frozen error codes

Telemetry `errorCodes` fields use the snapshot-tested vocabulary in `src/telemetry/frozenErrorCodes.ts`:

- repair codes (`SPEC_*`, `VALIDATION`, `PATCH_APPLY_FAILED`, …)
- Tool layer: `SCOPE_DENIED`, `UNKNOWN_TOOL`, `TOOL_HANDLER_ERROR`
- Voice layer: `VOICE_CONNECT_FAILED`, `VOICE_RECONNECT_EXHAUSTED`
- Cost layer: `BUDGET_HARD_CAP`

## Modules

| Module | Role |
|--------|------|
| `src/telemetry/types.ts` | Event type definitions |
| `src/telemetry/frozenErrorCodes.ts` | Frozen error-code catalog |
| `src/telemetry/extractToolErrorCodes.ts` | Tool result → frozen codes |
| `src/telemetry/hostTelemetry.ts` | `createHostTelemetry` facade + redaction middleware |
| `src/telemetry/redactTelemetryEvent.ts` | Deep-redact PII/keys before sink dispatch |
| `src/telemetry/emit.ts` | Event builders |
| `src/telemetry/budgetBridge.ts` | Cost telemetry on budget record/refusal |
| `src/telemetry/voiceBridge.ts` | Voice kernel → telemetry bridge |
| `src/panels/host.ts` | Exposes `host.telemetry`, wires agent + voice bridges |
| `src/agents/toolExecutor.ts` | Tool latency + error telemetry |
| `src/panels/panelToolRuntime.ts` | Compose + HITL emissions |

## Automated checks

| Test | Contract |
|------|----------|
| `tests/unit/telemetryRedaction.test.ts` | PII/key stripping on emit boundary |
| `tests/integration/telemetrySinkBoundary.test.ts` | compose→repair→approve sink delivery |
| `tests/integration/telemetryEventCoverage.test.ts` | all families + frozen codes snapshot |
| `tests/unit/telemetryFrozenCodes.test.ts` | frozen error-code vocabulary snapshot + extractors |
| `tests/unit/telemetryEventCatalog.test.ts` | catalog published + reference sink |

## Test commands

```bash
npm run test -- telemetryEventCatalog telemetryRedaction telemetryFrozenCodes eventCoverageFrozenCodes telemetrySinkBoundary
npm run lint
npm run check-no-stubs
```
