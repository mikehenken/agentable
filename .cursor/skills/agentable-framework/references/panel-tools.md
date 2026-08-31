# Panel agent tools reference

Six generic tools plus `describe_panel` introspection. Declarations live in `src/panels/tools.ts`; runtime in `src/panels/panelToolRuntime.ts`.

## Tool inventory

| Tool | Class | Approval | costClass |
|------|-------|----------|-----------|
| `list_panels` | read | none | cheap |
| `describe_panel` | read | none | cheap |
| `open_panel` | ui | none | cheap |
| `fill_panel` | ui | none | cheap |
| `compose_panel` | ui | none | **expensive** |
| `patch_panel` | ui | none | cheap |
| `run_panel_action` | mutate | hitl (agent) | cheap |

Host-triggered `run_panel_action` skips agent approval; destructive actions always confirm.

## compose_panel gate 

Hosts may close the compose gate until a port-order milestone passes:

```ts
composeGate: { id: 'post-seo-compose', enabled: false }
```

`ComposeGateConfig` is `{ id, enabled, criteria? }`. The runtime `open` flag lives on `ComposeGateEvaluation` only (produced by `evaluateComposeGate`).

When closed, agents receive a structured refusal with gate id, not a silent no-op.

## fill_panel vs patch_panel 

- **`fill_panel`** — plain object field merge; respects dirty-field protection 
- **`patch_panel`** — RFC 6902 JSON Patch on composed spec instances only

Prefer `fill_panel` for forms; use `patch_panel` for streaming spec refinement.

## describe_panel 

Returns props schema, adapter sources, actions map, and curated example specs per catalog entry. Examples are validated in CI — they do not rot.

## Repair vocabulary 

Validation rejections include frozen error codes from `FROZEN_REPAIR_ERROR_CODES` in `src/panels/spec/repairVocabulary.ts`, failing node id, and nearest-valid-alternative hints. Common codes:

| Code | Meaning |
|------|---------|
| `SPEC_ACTION_REF_MISSING` | Action id not in declared actions map |
| `VALIDATION` | Zod prop validation failed |
| `SPEC_BUDGET_NODES` | Node count exceeds max (200) |
| `SPEC_BUDGET_DEPTH` | Tree depth exceeds max (12) |
| `SPEC_BUDGET_STRING` | String field exceeds per-field limit |
| `SPEC_BUDGET_SIZE` | Total spec byte size exceeds limit |
| `SPEC_SANITIZE_URL_SCHEME` | URL scheme not on allowlist |
| `SPEC_SANITIZE_JAVASCRIPT_URL` | `javascript:` URL blocked |
| `SPEC_SANITIZE_CONTROL_CHAR` | Disallowed control character in string |
| `COMPOSE_GATE_CLOSED` | Host closed the compose gate |

Agent-origin specs get one structured-error repair round, then a fallback card ( step 7).

## Canvas-over-MCP 

External MCP clients can drive the same tools against a live dev workspace. OAuth scopes: `workspace:read`, `workspace:act`, `workspace:digest`. See `docs/features/canvas-over-mcp.md` — not the full landi MCP surface.

## Drawing and perception 

Additional tools on spatial engines (`EngineCapabilities`):

- Drawing: `draw_shapes`, `insert_image`, `connect_shapes`, …
- Perception: `read_canvas`, `screenshot_canvas`
- Presentation: `present_walkthrough`

Charts prefer composed spec panels over canvas drawing (selection rule in agent guidance).
