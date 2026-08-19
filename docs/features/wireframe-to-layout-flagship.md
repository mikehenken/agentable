---
lrn: lrn::en:platform:agentable-canvas.feature.wireframe-to-layout-flagship::doc
related_docs:
  - docs/features/drawing-tools-provenance.md
  - docs/features/perception-read-screenshot-canvas.md
changelog:
  - date: 2026-07-21
    summary: wireframe sketch to layout proposal with HITL apply e2e fixture.
---

# Wireframe-to-layout flagship 

Flagship workflow: user sketch, agent `read_canvas`, deterministic layout proposal, HITL apply via `compose_panel` and `run_panel_action`.

## Pipeline

1. **Sketch** user or agent calls `draw_shapes` with the golden wireframe batch.
2. **Read** agent calls `read_canvas` to obtain a structured shape graph.
3. **Propose** `proposeWireframeLayout(graph)` maps header, nav, and main regions to composed panel specs and placements.
4. **Apply** agent composes slot specs, opens the layout review panel, and runs `apply` through normal HITL approval.

Drawing remains additive and never mutates panel data. Only the approved mutate action changes persisted layout state.

## Golden fixtures

| Fixture | Purpose |
|---------|---------|
| `tests/fixtures/wireframe-golden-sketch.json` | `draw_shapes` batch for the landing-page wireframe |
| `tests/fixtures/wireframe-golden-shape-graph.json` | Expected `read_canvas` graph |
| `tests/fixtures/wireframe-golden-layout-proposal.json` | Expected `proposeWireframeLayout` output |

## Module map

- `src/agents/workflows/wireframeToLayout.ts` proposal logic and helpers
- `src/engine/wireframeLayoutTypes.ts` shared contracts
- `tests/e2e/harness/wireframeToLayoutScenario.ts` node-side e2e runner

## Tests

- `tests/unit/wireframeToLayout.test.ts` golden proposal determinism
- `tests/integration/wireframeToLayoutE2e.test.ts` full sketch to HITL apply scenario
