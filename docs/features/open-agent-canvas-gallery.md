---
lrn: lrn::en:platform:agentable-canvas.feature.open-agent-canvas-gallery::doc
related_docs:
  - docs/features/gallery-d47.md
  - docs/features/authoring-toolkit.md
  - docs/features/document-block-model.md
  - docs/features/document-export.md
  - docs/features/canvas-policy-merge.md
  - docs/features/code-execution-boundary.md
changelog:
  - date: 2026-07-23
    summary: Gallery embed auto-demo for document panel, PDF export, HITL save boundary ( iter-3).
  - date: 2026-07-21
    summary: gallery example 12 (Meridian Labs) with open-canvas e2e harness.
---

# Open agent canvas gallery example 

Gallery example **12** (`examples/12-open-agent-canvas/`) demonstrates the P12 open agent canvas on a fictional **Meridian Labs** product-design studio brief.

## What it proves

| AC | Evidence |
|----|----------|
| Wireframe set under `open` | `draw_shapes` flow diagram + wireframe stencils + `connect_shapes` |
| Multi-block document | Structured block ops on `workspace.documents` (no markup) |
| Export | `export_document` host action → PDF, byte-stable repeat export |
| HITL boundary | `run_panel_action` `save` queues approval even when `canvasPolicy.preset === 'open'` |
| Fictional brand | Meridian Labs fixtures; copy-hygiene unit test |

## Host config

`examples/shared/meridian-labs-open-config.json` sets:

```json
{ "canvasPolicy": { "preset": "open" } }
```

Framework default remains `guarded`; this gallery host opts in explicitly ( pattern).

## Automated checks

```bash
npm run build:gallery-harnesses
npm run test -- tests/integration/openAgentCanvasE2e.test.ts tests/unit/openAgentCanvasFixtures.test.ts
npm run test:e2e -- tests/e2e/gallery.spec.ts -g "12-open-agent-canvas"
npm run check:gallery-imports
npm run lint
```

Harness: `tests/e2e/harness/openAgentCanvasScenario.ts` (Vitest + Playwright via `12-open-agent-canvas-harness.js`).

## Module map

- `examples/12-open-agent-canvas/fixtures/meridianLabs.ts` — wireframe + document fixture data
- `tests/e2e/harness/openAgentCanvasScenario.ts` — acceptance scenario
- `examples/12-open-agent-canvas/index.html` — gallery page

Builds on..T6: authoring toolkit, document panel, export, `canvasPolicy` merge, G4 boundary.
