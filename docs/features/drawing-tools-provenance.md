---
lrn: lrn::en:platform:agentable-canvas.feature.drawing-tools-provenance::doc
related_docs:
  - docs/development/ARCHITECTURE.md
changelog:
  - date: 2026-07-21
    summary: drawing tools with provenance stamping and engine draw gating.
---

# Agent drawing tools 

Capability-gated agent drawing tools for the tldraw whiteboard substrate.

## Tools

| Tool | Purpose |
|------|---------|
| `draw_shapes` | Batch create marks or auto-layout diagrams (`flow`, `timeline`, `radial`) from logical structure |
| `annotate_panel` | Panel callout that parents to the panel shape and moves with it |
| `clear_agent_drawings` | Remove all marks stamped for an agent |

## Provenance

Every agent-created shape carries `meta.agentableAgent = <agentId>`. Panel callouts also set `meta.agentablePanelAnchor` and `meta.agentableAnnotation`.

## Capability gate

Tools require `engine.capabilities.draw === true`. Hosts and `WhiteboardShell` bind capabilities through `bindEngineCapabilities`. Engines without draw return `ENGINE_DRAW_UNAVAILABLE`.

## Module map

- `src/agents/tools/drawingTools.ts` tool declarations and handlers
- `src/engines/tldraw/agentDrawing/agentDrawingApi.ts` tldraw shape adapter
- `src/engine/agentDrawingTypes.ts` shared contracts
- `src/agents/engineBridge.ts` runtime capability binding

## Tests

`tests/unit/drawingToolsProvenance.test.ts` covers engine gating refusal and provenance meta on draw, annotate, and clear operations.
