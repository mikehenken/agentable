---
lrn: lrn::en:platform:agentable-canvas.feature.perception-read-screenshot-canvas::doc
related_docs:
  - docs/features/drawing-tools-provenance.md
changelog:
  - date: 2026-07-21
    summary: read_canvas shape graph and screenshot_canvas raster with gating.
---

# Canvas perception tools 

Structured read and raster screenshot tools for agent canvas perception.

## Tools

| Tool | Purpose |
|------|---------|
| `read_canvas` | Deterministic shape graph: types, geometry, text, arrow links, z-order, panel metadata |
| `screenshot_canvas` | PNG data URL of viewport or region for vision models |

## Capability gating 

- `screenshot_canvas` requires model `vision: true`.
- When vision is unavailable, the runtime degrades to `read_canvas` with a `TOOL_DEGRADED` note.
- `read_canvas` requires model `tools: true` (standard tool-calling session).

Perception tools do not require `engine.capabilities.draw`; they operate on any bound tldraw editor.

## Golden wireframe fixture

`tests/fixtures/wireframe-golden-shape-graph.json` is the expected graph for the seeded landing-page wireframe (header, nav, main, hero label). `tests/unit/perceptionReadScreenshot.test.ts` asserts exact reproduction.

## Module map

- `src/agents/tools/perceptionTools.ts` tool declarations and handlers
- `src/engines/tldraw/perception/canvasPerceptionApi.ts` editor-bound read and screenshot
- `src/engines/tldraw/perception/shapeGraphSerializer.ts` deterministic graph builder
- `src/engine/canvasPerceptionTypes.ts` shared contracts

## Tests

`tests/unit/perceptionReadScreenshot.test.ts` covers golden shape graph, tool registration, screenshot capture, and degradation.
