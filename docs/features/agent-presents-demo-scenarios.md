---
lrn: lrn::en:platform:agentable-canvas.feature.agent-presents-demo-scenarios::doc
related_docs:
  - docs/features/drawing-tools-provenance.md
  - docs/features/communicative-visuals-auto-layout.md
  - docs/features/story-mode-walkthrough.md
  - docs/features/catalog-charts-addon.md
  - examples/08-agent-presents/README.md
changelog:
  - date: 2026-07-21
    summary: Archipelago Resorts fictional demo scenarios — fixtures, e2e harness, graduates 08-agent-presents.
---

# Agent presents demo scenarios 

Career demo scenarios ship as **fixtures + e2e** (not framework career tools). The gallery example `08-agent-presents` demonstrates three agent presentation flows for the fictional **Archipelago Resorts** brand.

## Scenarios

| Scenario | Mechanism | Acceptance |
|----------|-----------|------------|
| Career trajectory | `draw_shapes` timeline auto-layout | Renders from logical nodes only — no coordinates in the tool call |
| Job economy chart | `compose_panel` + `@agentable/catalog-charts` | Agent-origin spec; provenance-badged; pinnable via `pin: true` |
| Island walkthrough | `draw_shapes` radial + `present_walkthrough` | Scene-by-scene narration; camera cedes on user input |

## Fixtures

| Path | Purpose |
|------|---------|
| `examples/08-agent-presents/fixtures/archipelagoResorts.ts` | Scenario data, narration script, career dataset |
| `tests/fixtures/archipelago-resorts/scenario-manifest.json` | Stable scenario manifest for CI |

Demo content uses fictional island names and **Archipelago Resorts** only ( rule 4 copy-hygiene gate).

## E2E harness

`tests/e2e/harness/agentPresentsScenario.ts` runs a node-side acceptance flow (mocked editor, real tool handlers):

1. Compile and draw career trajectory from structure
2. Validate and compose job-economy chart with charts catalog merge
3. Draw radial island map and run walkthrough narration + user-cancel probe
4. Assert drawing does not mutate composed panel spec data

Integration test: `tests/integration/agentPresentsE2e.test.ts` 
Fixture tests: `tests/unit/agentPresentsFixtures.test.ts`

## Run

```bash
npm run test -- tests/integration/agentPresentsE2e.test.ts tests/unit/agentPresentsFixtures.test.ts
```

## Module map

- `examples/08-agent-presents/` — gallery example root + README
- `tests/e2e/harness/agentPresentsScenario.ts` — shared scenario runner
- Reuses draw tools, auto-layout, walkthrough, catalog-charts
