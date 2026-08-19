---
lrn: lrn::en:platform:agentable-canvas.feature.authoring-toolkit::doc
related_docs:
  - docs/features/drawing-tools-provenance.md
  - docs/development/agentable-panels/01-DECISIONS.md
changelog:
  - date: 2026-07-21
    summary: authoring toolkit with insert_image, connectors, compose, arrange, and wireframe stencils.
---

# Open agent canvas authoring toolkit 

Extends P8 drawing tools with the authoring surface for the tldraw spatial engine.

## Tools

| Tool | Purpose |
|------|---------|
| `insert_image` | Place an uploaded asset id or host-generated image (never markup or model URLs) |
| `connect_shapes` | Typed connectors (`dependency`, `flow`, `annotation`) between shape refs |
| `group_shapes` | Group a selection into a tldraw group |
| `frame_shapes` | Compose a selection into a named frame (walkthrough scene) |
| `arrange` | Re-run auto-layout (`flow`, `timeline`, `radial`) over a selection or frame |
| `draw_shapes` + `stencil` | Wireframe placeholders (`box`, `label`, `input`, `button`, `nav`, `card`) |

## Security (G4)

`insert_image` rejects `url`, `src`, `html`, `markup`, and URL-like `assetId` values. Images resolve only through host-bound asset and generation bridges (`bindAuthoringAssetResolver`, `bindAuthoringImageGenerator`).

## Provenance

Every authoring mark carries `meta.agentableAgent`. Connectors add `meta.agentableConnectorKind`; wireframe stencils add `meta.agentableWireframeStencil`.

## Capability gate

All authoring toolkit tools require `engine.capabilities.draw === true`. Hosts bind capabilities through `bindEngineCapabilities`. Engines without draw return `ENGINE_DRAW_UNAVAILABLE`.

## Module map

- `src/agents/tools/authoringToolkitTools.ts` — tool declarations and handlers
- `src/agents/authoringAssetBridge.ts` — trusted asset generation resolution
- `src/engines/tldraw/agentDrawing/authoringToolkitApi.ts` — tldraw adapter
- `src/engines/tldraw/agentDrawing/wireframeStencils.ts` — stencil expansion for `draw_shapes`
- `src/engine/authoringToolkitTypes.ts` — shared contracts

## Tests

`tests/unit/authoringToolkit.test.ts` covers draw capability gating refusal, markup rejection, provenance stamping, wireframe stencils, and compose/connect adapters.
