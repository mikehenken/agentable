---
lrn: lrn::en:platform:agentable-canvas.feature.digest-drawing-integration::doc
related_docs:
  - docs/features/drawing-tools-provenance.md
  - docs/features/perception-read-screenshot-canvas.md
changelog:
  - date: 2026-07-21
    summary: digest shape slice, delta fields, collector bridge, and drawing activity verbs.
  - date: 2026-07-21
    summary: P11 pre-gate cleanup moved the tldraw-coupled collector bridge into src/engines/tldraw/digest/ and added an engine-agnostic digest-shape-slice accessor in src/agents/engineBridge.ts so src/agents/ stays free of tldraw imports.
---

# Digest drawing integration 

Integrates agent and user canvas drawings into the workspace digest and per-agent delta delivery.

## Digest shape slice

`WorkspaceDigest.shapes` carries compact summaries:

| Field | Purpose |
|-------|---------|
| `id` | tldraw shape id |
| `nativeType` | Native tldraw type (`geo`, `arrow`, `text`, `draw`,...) |
| `kind` | Agent draw kind or `annotation` for panel callouts |
| `label` | Short text label for digest delivery |
| `agentId` | Provenance when agent-authored |
| `userAuthored` | True for user canvas marks without agent provenance |
| `attention` | Viewport tier (`visible` or `background`) |
| `revision` | Fingerprint for delta diffing |

Panel shapes remain in the context/panel slice. The shape slice covers canvas marks only.

## Delta fields

`DigestDelta` adds:

- `newShapes`: ids created since the prior digest
- `changedShapes`: ids whose `revision` changed
- `removedShapes`: ids removed since the prior digest
- `patch.shapes`: compact summaries for new and changed shapes

## Host wiring

`bindDigestShapeCollector(editor)` (`src/engines/tldraw/digest/digestShapeBridge.ts`) runs when the whiteboard editor mounts. It listens to tldraw store changes, bumps a shape change batch id, and exposes summaries through its own `getDigestShapeSlice`.

`WhiteboardShell` also calls `bindEngineDigestShapeSlice` (`src/agents/engineBridge.ts`) at the same mount point, handing the agent-agnostic bridge a getter that reads the tldraw-side slice. `createAgentRuntime` merges the live shape slice (and batch id) into digest compiles by reading `getEngineDigestShapeSlice`, so the agent layer never imports tldraw directly. The DOM workspace engine never calls `bindEngineDigestShapeSlice`, so the bridge stays null and shapes are simply absent from the digest.

Both engine handles also expose the same data as a typed SPI method, `getDigestShapeSlice`: the tldraw engine (`src/engines/tldraw/engine.ts`) delegates to the bound editor's slice, and the DOM engine (`src/engines/dom/engine.ts`) always returns null, matching its declared `capabilities.draw: false`.

## Drawing activity verbs

Successful drawing tool calls append digest recency entries:

| Tool | Verb |
|------|------|
| `draw_shapes` | `draw_shapes` |
| `annotate_panel` | `annotate_panel` |
| `clear_agent_drawings` | `clear_agent_drawings` |

## Budget drops

When token pressure remains after context trimming, the budgeter drops shape summaries in order:

1. `backgroundShapes` (off-viewport marks)
2. `userShapes` (non-agent marks)
3. `shapes` (entire slice at hard cap)

## Module map

- `src/agents/digest.ts` digest types, delta, budget integration
- `src/agents/digestShapes.ts` summary builders and revision fingerprints
- `src/agents/engineBridge.ts` engine-agnostic digest-shape-slice accessor 
- `src/agents/drawingActivity.ts` activity verbs for drawing tools
- `src/engines/tldraw/digest/digestShapeCollector.ts` editor shape summarizer
- `src/engines/tldraw/digest/digestShapeBridge.ts` tldraw editor bind bridge and change batches

## Tests

`tests/unit/digestDrawingIntegration.test.ts` covers delta fields, compiler delivery, collector filtering, bridge batch bumps, and drawing activity verbs.
