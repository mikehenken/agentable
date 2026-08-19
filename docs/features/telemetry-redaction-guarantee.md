---
lrn: lrn::en:platform:agentable-canvas.feature.telemetry-redaction-guarantee::doc
related_docs:
  - docs/features/telemetry-event-catalog.md
  - docs/features/telemetry-sink-boundary.md
  - docs/features/telemetry-event-coverage.md
  - docs/features/anon-key-rate-limiting.md
changelog:
  - date: 2026-07-21
    summary: emit-boundary redaction guarantee for PII and credential-shaped telemetry values.
---

# Telemetry redaction guarantee 

Defense-in-depth on the host sink boundary: every event passed to a host-supplied sink is deep-redacted in `createHostTelemetry.emit` before dispatch.

## Guarantee

| Class | Handling |
|-------|----------|
| Credential-shaped strings | Replaced with `[redacted]` (`sk_`, `pk_live_`, JWT, `AIzaSy`, `sbp_`, `Bearer …`) |
| Email addresses | Replaced inline with `[redacted:email]` |
| Forbidden field names | Dropped (`apiKey`, `password`, `secret`, `token`, …) |
| `anonKeyHint` | Truncated to ≤8-char prefix + `…` (never full anon key) |
| Structured telemetry ids | Preserved when not matching sensitive patterns |

Redaction runs at the single emit boundary so compose, HITL, tool, voice, cost, and embed bridges inherit the guarantee without per-callsite duplication.

## Modules

| Module | Role |
|--------|------|
| `src/telemetry/redactTelemetryEvent.ts` | Deep redaction helpers + `redactTelemetryEvent` |
| `src/telemetry/hostTelemetry.ts` | Applies redaction before sink dispatch |

## Automated checks

```bash
npm run test -- telemetryRedaction
npm run test -- telemetrySinkBoundary
npm run lint
```

Unit test `tests/unit/telemetryRedaction.test.ts` asserts PII/key stripping on polluted payloads and verifies the host sink receives redacted events only.
