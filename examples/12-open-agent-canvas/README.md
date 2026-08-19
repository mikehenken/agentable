# 12 — Open agent canvas (Meridian Labs)

 gallery example **12**: fictional **Meridian Labs** product studio demonstrating the P12 open agent canvas — connected wireframe set, multi-block document, PDF export under `canvasPolicy: open`, with host-data mutations still gated by HITL.

## Scenarios

| Scenario | Tools APIs | What the agent does |
|----------|--------------|---------------------|
| Connected wireframe | `draw_shapes` (flow diagram + stencils) | Authors a linked onboarding funnel without coordinates in tool calls |
| Product brief | Block ops on `workspace.documents` | Builds a multi-block brief (headings, list, callout) — never markup |
| Export | `export_document` host action | Exports PDF from the block model (byte-stable, no HTML round-trip) |
| HITL boundary | `run_panel_action` → `save` | Host-data persist still queues approval even under `open` |

## Fixtures

Scenario data lives in `fixtures/meridianLabs.ts`. Automated acceptance runs in `tests/integration/openAgentCanvasE2e.test.ts` via `tests/e2e/harness/openAgentCanvasScenario.ts`.

Shared host config (open policy): `examples/shared/meridian-labs-open-config.json`.

## Published entry points only

Gallery pages must import from package exports — never from `src/` internals.

## Run tests

```bash
npm run build:gallery-harnesses
npm run test:e2e -- tests/e2e/gallery.spec.ts -g "12-open-agent-canvas"
npm run test -- tests/integration/openAgentCanvasE2e.test.ts tests/unit/openAgentCanvasFixtures.test.ts
```

Gallery page: `examples/12-open-agent-canvas/index.html`
