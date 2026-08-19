---
lrn: lrn::en:platform:agentable-canvas.feature.a2ui-ingestion-adapter::doc
related_docs:
  - docs/features/perception-read-screenshot-canvas.md
changelog:
  - date: 2026-07-21
    summary: A2UI v1.0 ingestion adapter with conformance fixtures and render parity tests.
---

# A2UI v1.0 ingestion adapter 

Translates [A2UI v1.0](https://a2ui.org/specification/v1.0-a2ui/) server-to-client payloads into the platform `PanelSpec` IR, then through the standard `validateSpec` pipeline.

## API

| Export | Purpose |
|--------|---------|
| `ingestA2UIEnvelope(input)` | Single envelope → `PanelSpec` |
| `ingestA2UIStream(messages)` | Ordered JSONL/stream → `PanelSpec` |
| `ingestAndValidateA2UI(input, context)` | Ingest + `validateSpec` |
| `parseA2UIEnvelope` `safeParseA2UIEnvelope` | Zod validation for wire JSON |

Package entry: `agentable-canvas/a2ui` → `src/a2ui/index.ts`.

## Component mapping (basic catalog)

| A2UI | Platform IR |
|------|-------------|
| Column, Row, Card, List | `panel-body` |
| Text (default) | `header` |
| Text (caption) | `badge` |
| Text (`# heading`) | `header` |
| TextField | `field-form` + `a2ui.data` source |
| Button + event | `action-row` + `host` action |
| Icon | `badge` |
| Divider | omitted |

Dynamic values resolve literals and `{ path }` bindings against the surface data model. Function-call dynamics are rejected in v1.

## Conformance fixtures

Patterns from the A2UI v1.0 specification live under `tests/fixtures/a2ui/conformance-fixtures.json`:

- `user-profile-card` — createSurface + path-bound Text
- `dual-text-column` — updateComponents dual Text
- `markdown-heading-text` — markdown heading Text
- `submit-button-host-action` — Button host action
- `contact-email-stream` — JSONL create + components + dataModel

Each fixture asserts byte-identical IR after ingestion and DOM parity after `SpecRenderer`.

## Module map

- `src/a2ui/schema.ts` — Zod envelope validation
- `src/a2ui/surfaceState.ts` — surface accumulator (create/update/dataModel/delete)
- `src/a2ui/dynamicValue.ts` — JSON Pointer + Dynamic* resolution
- `src/a2ui/componentMap.ts` — basic-catalog → catalog IR mapping
- `src/a2ui/ingest.ts` — public ingest + validate pipeline

## Tests

- `tests/unit/a2uiIngestionAdapter.test.ts` — schema, fixtures, validation pipeline
- `tests/integration/a2uiIngestionRenderParity.test.tsx` — ingested vs native IR DOM parity
