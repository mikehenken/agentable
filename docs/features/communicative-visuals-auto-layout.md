---
lrn: lrn::en:platform:agentable-canvas.feature.communicative-visuals-auto-layout::doc
related_docs:
  - docs/features/drawing-tools-provenance.md
  - docs/features/digest-drawing-integration.md
changelog:
  - date: 2026-07-24
    summary: P13 nested layout for VPC/architecture diagrams; post-draw repair no longer downgrades nested/radial to flow.
  - date: 2026-07-21
    summary: auto-layout modes, diagram compilation, progressive drawing, and placement targets.
---

# Communicative visuals auto-layout 

Agents pass logical diagram structure to `draw_shapes`; the tldraw engine adapter computes geometry ( section 9).

## Auto-layout modes

| Mode | Layout behavior |
|------|-----------------|
| `flow` | Nodes in a horizontal row following diagram order |
| `timeline` | Nodes stacked vertically for career-style trajectories |
| `radial` | First node at center, remaining nodes on a fixed-radius ring |
| `nested` | Top-level regions in horizontal columns; `parentId` children stacked inside container nodes (VPC/cloud architecture) |

## Post-draw repair

Post-draw layout repair (`runSharedPostDrawRepairPipeline`, live chat) uses `resolvePostDrawArrangeLayout` so nested architecture diagrams are never re-arranged with `flow`. Nested layout skips arrange (flat canvas shapes cannot preserve `parentId` hierarchy).

## Tool contract

`draw_shapes` accepts:

- `layout`: `flow`, `timeline`, `radial`, or `nested` (omit or `none` for explicit `shapes`)
- `diagram`: `{ nodes: [{ id, label, kind?, parentId? }], edges?, order? }` — use `kind: container` and `parentId` for layered architecture
- `placement`: `viewport` (default), `rect`, or `nearPanel`
- `progressive`: `{ step, totalSteps? }` for speech-synced partial reveals

Agents must not supply absolute coordinates when using auto-layout.

## Module map

- `src/engines/tldraw/agentDrawing/communicativeVisualLayout.ts` deterministic layout engine
- `src/engines/tldraw/agentDrawing/diagramToDrawShapes.ts` structure to shape batch compiler
- `src/engines/tldraw/agentDrawing/agentDrawingApi.ts` `drawAgentDiagram` entry point
- `src/agents/tools/drawingTools.ts` tool parsing and routing

## Tests

`tests/unit/communicativeVisualAutoLayout.test.ts` covers layout determinism per mode, diagram compilation without coordinates, progressive steps, nearPanel placement, and tool handler routing.
