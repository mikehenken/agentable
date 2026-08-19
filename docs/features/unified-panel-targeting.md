---
lrn: lrn::en:platform:agentable-canvas.feature.unified-panel-targeting::doc
related_docs:
  - docs/features/dom-workspace-engine.md
  - docs/features/auto-mount-scan.md
  - docs/features/canvas-over-mcp.md
changelog:
  - date: 2026-07-21
    summary: unified open_panel resolver for slots, regions, and canvas placement.
---

# Unified panel targeting 

One engine-agnostic resolver maps agent `open_panel` calls to `EnginePanelPlacement` for page-session slots, DOM app-shell regions, or spatial canvas coordinates (tldraw).

## Target kinds

| Kind | Tool shape | Engine behavior |
|------|------------|-----------------|
| `slot` | `{ target: { kind: "slot", slot: "sidebar" } }` or top-level `slot` | `PanelOnlyEngine` mounts into `data-agentable-slot` |
| `region` | `{ target: { kind: "region", region: "sidebar", order: 1 } }` or top-level `region` | DOM engine places panel in region tab strip |
| `canvas` | `{ target: { kind: "canvas", position: { x, y }, size? } }` or top-level `position`/`size` | tldraw engine opens panel shape at coordinates |

Agents do not need to know which engine is mounted. The host resolves targeting once; each engine interprets the fields it understands.

## Module map

- `src/engine/openPanelResolver.ts` — parse, validate, resolve
- `src/panels/tools.ts` — `open_panel` tool handler + declaration
- `src/panels/panelToolRuntime.ts` — runtime bridge to `host.panels.open`
- `src/mcp/toolSchemas.ts` — MCP Zod schema parity
- `src/engines/dom/layoutCodec.ts` — `domRegionFromEnginePlacement` for explicit `region`

## Tests

- `tests/unit/openPanelResolver.test.ts` — resolver unit coverage
- `tests/unit/unifiedPanelTargeting.test.ts` — same `open_panel` call routes to DOM region vs tldraw position

## Legacy compatibility

Flat fields (`slot`, `region`, `position`, `size`, `tabGroup`, `order`) remain supported when `target` is omitted. Combining `target` with legacy flat fields returns `TARGET_CONFLICT`.
