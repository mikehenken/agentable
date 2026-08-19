---
lrn: lrn::en:platform:agentable-canvas.feature.telemetry-event-catalog::doc
related_docs:
  - docs/features/telemetry-sink-boundary.md
  - docs/features/telemetry-event-coverage.md
  - docs/features/telemetry-redaction-guarantee.md
  - docs/features/anon-key-rate-limiting.md
changelog:
  - date: 2026-07-21
    summary: Published telemetry event catalog with frozen error codes and a reference sink example.
---

# Telemetry event catalog

Authoritative reference for framework runtime observability. The framework emits structured events through `host.telemetry.emit`; the host registers a sink using the same boundary pattern as the model resolver. Events are redacted at the emit boundary before the sink receives them.

## Host API

| Surface | Purpose |
|---------|---------|
| `createCanvasHost({ telemetrySink })` | Optional initial sink at host construction |
| `host.telemetry.registerSink(sink)` | Register or replace the active sink; returns unregister |
| `host.telemetry.emit(event)` | Emit a structured event (no-op when no sink; always redacted) |

Type definitions: `src/telemetry/types.ts`. Event builders: `src/telemetry/emit.ts`.

## Event families

Every emitted event includes `ts` (ISO-8601) and `family`.

| Family | Emitted from | Key fields | Outcomes |
|--------|--------------|------------|----------|
| `compose` | `compose_panel`, `patch_panel` validation (`panelToolRuntime`) | `phase`, `outcome`, `tool`, `panelId?`, `agentRepairEligible?`, `errorCodes?` | `rejected`, `success`, `repaired_success` |
| `hitl` | `run_panel_action` approval queue | `panelId`, `definitionId`, `actionId`, `agentId?` | `queued`, `approved`, `rejected`, `timeout` |
| `tool` | Scoped agent tool executor (`toolExecutor`) | `toolName`, `latencyMs`, `agentId?`, `errorCodes?` | `success`, `error` |
| `voice` | `bindVoiceTelemetry` on shared voice kernel | `sessionId?`, `errorCodes?` | `connected`, `dropped`, `reconnected`, `error` |
| `cost` | `wrapBudgetWithTelemetry` on agent budget | `agentId`, `capability`, `costClass`, `units`, `errorCodes?` | `recorded`, `refused` |
| `embed` | `emitEmbedRateLimitTelemetry` via embed bridge | `operation`, `outcome`, `retryAfterMs?`, `limit?`, `windowMs?`, `anonKeyHint?`, `errorCodes?` | `allowed`, `refused` |

### Compose family

| Field | Type | Notes |
|-------|------|-------|
| `phase` | `'compose' \| 'repair'` | Validation vs agent repair round |
| `outcome` | `'rejected' \| 'success' \| 'repaired_success'` | |
| `tool` | `'compose_panel' \| 'patch_panel'` | Which panel tool emitted |
| `errorCodes` | `TelemetryErrorCode[]` | Structured repair codes on rejection paths |

### HITL family

| Field | Type | Notes |
|-------|------|-------|
| `panelId` | `string` | Target panel |
| `definitionId` | `string` | Panel definition id |
| `actionId` | `string` | Host action awaiting approval |
| `outcome` | `'queued' \| 'approved' \| 'rejected' \| 'timeout'` | `timeout` is typed; emission deferred until controller exists |

### Tool family

| Field | Type | Notes |
|-------|------|-------|
| `toolName` | `string` | Scoped tool id |
| `latencyMs` | `number` | Wall-clock handler duration |
| `errorCodes` | `TelemetryErrorCode[]` | From `extractToolErrorCodes` on error paths |

### Voice family

| Field | Type | Notes |
|-------|------|-------|
| `sessionId` | `string` | Stable id for a connect cycle |
| `errorCodes` | `TelemetryErrorCode[]` | `VOICE_CONNECT_FAILED` or `VOICE_RECONNECT_EXHAUSTED` on failure paths |

### Cost family

| Field | Type | Notes |
|-------|------|-------|
| `costClass` | `ToolCostClass` | `cheap`, `moderate`, `expensive` |
| `units` | `number` | Spend units recorded or refused |
| `errorCodes` | `TelemetryErrorCode[]` | `BUDGET_HARD_CAP` on `refused` |

### Embed family

| Field | Type | Notes |
|-------|------|-------|
| `operation` | `'tenant_lookup' \| 'embed_bootstrap'` | Rate-limit scope |
| `outcome` | `'allowed' \| 'refused'` | |
| `anonKeyHint` | `string` | Truncated prefix only (≤8 chars + `…`); redacted at emit boundary |
| `errorCodes` | `TelemetryErrorCode[]` | `RATE_LIMITED` on `refused` |

## Frozen error codes

All `errorCodes` arrays on telemetry events must use members of `FROZEN_TELEMETRY_ERROR_CODES` (`src/telemetry/frozenErrorCodes.ts`). Snapshot-tested in `tests/unit/telemetryFrozenCodes.test.ts` (36 frozen codes).

### Spec validation (`SPEC_*`)

| Code | Typical source |
|------|----------------|
| `SPEC_ENVELOPE_INVALID` | Malformed panel spec envelope |
| `SPEC_VERSION_UNKNOWN` | Unknown `schemaVersion` |
| `SPEC_ROOT_MISSING` | Missing root node |
| `SPEC_ROOT_UNKNOWN` | Root references unknown node |
| `SPEC_NODES_INVALID` | Nodes map invalid |
| `SPEC_NODE_UNKNOWN` | Unknown node id in tree |
| `SPEC_NODE_PROPS_INVALID` | Props fail catalog schema |
| `SPEC_ACTION_REF_MISSING` | Action references missing handler |
| `SPEC_ACTION_REF_SMUGGLED` | Smuggled action reference |
| `SPEC_ACTION_URL_FORBIDDEN` | Forbidden action URL |
| `SPEC_ACTION_SOURCE_UNKNOWN` | Unknown action source |
| `SPEC_HOST_ACTION_UNKNOWN` | Unknown host action id |
| `SPEC_PANEL_UNKNOWN` | Unknown panel id |
| `SPEC_BUDGET_NODES` | Node count budget exceeded |
| `SPEC_BUDGET_DEPTH` | Tree depth budget exceeded |
| `SPEC_BUDGET_STRING` | String length budget exceeded |
| `SPEC_BUDGET_SIZE` | Payload size budget exceeded |
| `SPEC_CYCLE` | Cyclic node graph |
| `SPEC_DUPLICATE_CHILD` | Duplicate child id |
| `SPEC_ORPHAN_NODE` | Orphan node in graph |
| `SPEC_SANITIZE_JAVASCRIPT_URL` | `javascript:` URL blocked |
| `SPEC_SANITIZE_CONTROL_CHAR` | Control character in string |
| `SPEC_SANITIZE_URL_SCHEME` | Disallowed URL scheme |

### Compose/patch repair

| Code | Typical source |
|------|----------------|
| `VALIDATION` | Generic tool-layer validation failure |
| `PATCH_APPLY_FAILED` | Patch could not be applied |
| `RUNTIME_DISPOSED` | Panel runtime disposed mid-operation |
| `STACK_EMPTY` | Undo stack empty |
| `ENTRY_NOT_FOUND` | Activity ledger entry missing |
| `COMPOSE_GATE_CLOSED` | Compose gate off |

### Tool executor layer

| Code | Typical source |
|------|----------------|
| `SCOPE_DENIED` | Agent lacks tool scope |
| `UNKNOWN_TOOL` | Tool not registered |
| `TOOL_HANDLER_ERROR` | Handler threw or returned unstructured error |

### Voice transport

| Code | Typical source |
|------|----------------|
| `VOICE_CONNECT_FAILED` | Voice kernel `error` state |
| `VOICE_RECONNECT_EXHAUSTED` | Reconnect attempts exhausted |

### Cost budget

| Code | Typical source |
|------|----------------|
| `BUDGET_HARD_CAP` | Budget hard cap refusal |

### Embed rate limit

| Code | Typical source |
|------|----------------|
| `RATE_LIMITED` | Anon-key rate limit refusal |

## Redaction guarantee

Before any event reaches the host sink, `redactTelemetryEvent` strips forbidden keys, credential-shaped values, and email PII. See [telemetry-redaction-guarantee.md](./telemetry-redaction-guarantee.md).

## Reference sink example

Copy-paste host wiring that routes events by family and validates frozen codes. Full source: `examples/telemetry-reference-sink/referenceSink.ts`.

```typescript
import {
  createCanvasHost,
  type TelemetryEvent,
  type TelemetrySink,
  assertFrozenTelemetryErrorCodes,
} from 'agentable-canvas/telemetry'; adjust import to your host bundle path

function createReferenceTelemetrySink(
  onRecord: (record: Record<string, unknown>) => void): TelemetrySink {
  return (event: TelemetryEvent) => {
    if (event.errorCodes?.length) {
      assertFrozenTelemetryErrorCodes(event.errorCodes);
    }

    switch (event.family) {
      case 'compose':
        onRecord({
          kind: 'compose',
          phase: event.phase,
          outcome: event.outcome,
          tool: event.tool,
          panelId: event.panelId,
          errorCodes: event.errorCodes,
        });
        break;
      case 'hitl':
        onRecord({
          kind: 'hitl',
          outcome: event.outcome,
          panelId: event.panelId,
          actionId: event.actionId,
        });
        break;
      case 'tool':
        onRecord({
          kind: 'tool',
          toolName: event.toolName,
          outcome: event.outcome,
          latencyMs: event.latencyMs,
          errorCodes: event.errorCodes,
        });
        break;
      case 'voice':
        onRecord({
          kind: 'voice',
          outcome: event.outcome,
          sessionId: event.sessionId,
          errorCodes: event.errorCodes,
        });
        break;
      case 'cost':
        onRecord({
          kind: 'cost',
          outcome: event.outcome,
          costClass: event.costClass,
          units: event.units,
          errorCodes: event.errorCodes,
        });
        break;
      case 'embed':
        onRecord({
          kind: 'embed',
          operation: event.operation,
          outcome: event.outcome,
          retryAfterMs: event.retryAfterMs,
          errorCodes: event.errorCodes,
        });
        break;
      default: {
        const _exhaustive: never = event;
        return _exhaustive;
      }
    }
  };
}

 Register at host construction:
 const host = createCanvasHost({ telemetrySink: createReferenceTelemetrySink(console.log) });
 or later: host.telemetry.registerSink(createReferenceTelemetrySink(sendToObservabilityStack));
```

The example uses `assertFrozenTelemetryErrorCodes` so host-side routing fails fast if the framework ever emits a non-frozen code during development.

The shipped `referenceSink.ts` follows the same family switch but hands the recorder a structured `{ kind, ts, payload }` record instead of a flat object. Use whichever shape fits your observability stack; the frozen-code guard and family switch are the parts worth keeping.

## Module index

| Module | Role |
|--------|------|
| `src/telemetry/types.ts` | Event type definitions |
| `src/telemetry/frozenErrorCodes.ts` | Frozen error-code catalog |
| `src/telemetry/hostTelemetry.ts` | Host facade + redaction middleware |
| `src/telemetry/emit.ts` | Event builders |
| `src/telemetry/extractToolErrorCodes.ts` | Tool result → frozen codes |
| `src/telemetry/voiceBridge.ts` | Voice kernel bridge |
| `src/telemetry/budgetBridge.ts` | Budget/cost bridge |
| `src/telemetry/embedBridge.ts` | Embed rate-limit bridge |
| `src/telemetry/redactTelemetryEvent.ts` | Deep-redaction helpers |
| `examples/telemetry-reference-sink/referenceSink.ts` | Reference sink (this doc) |

## Automated checks

```bash
npm run test -- telemetryEventCatalog
npm run test -- telemetryFrozenCodes telemetryEventCoverage telemetryRedaction
npm run lint
```

Unit test `tests/unit/telemetryEventCatalog.test.ts` verifies this catalog is published: doc exists, documents all six families and every frozen code, entity registered, and reference sink example present.
