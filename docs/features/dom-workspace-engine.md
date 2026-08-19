---
lrn: lrn::en:platform:agentable-canvas.feature.dom-workspace-engine::doc
related_docs:
  - docs/features/panel-framework-wrappers.md
  - docs/development/agentable-panels/01-DECISIONS.md
changelog:
  - date: 2026-07-21
    summary: Host embed wiring (`<agentable-app-shell>`) and the 11-app-shell gallery example; bundle verified tldraw-free.
  - date: 2026-07-21
    summary: Digest attention mapped from tab/region visibility, capped by live browser tab-focus and document-visibility signals.
  - date: 2026-07-21
    summary: Unified open_panel targeting resolver for slots, regions, and canvas.
  - date: 2026-07-21
    summary: WorkspaceLayoutRecord region/tabGroup/order fields and layout migrations.
  - date: 2026-07-21
    summary: DOM workspace engine with regions, splits, tabs, and drawer collapse.
---

# DOM workspace engine

Second canvas engine alongside tldraw: a fixed-viewport DOM workspace with `camera: none`, region-based panel layout, resizable splits, per-region tabs, and responsive sidebar drawer collapse.

## Engine contract

| Property | Value |
|----------|-------|
| Camera | Fixed `{ x: 0, y: 0, zoom: 1 }` (no pan or zoom) |
| Capabilities | All `EngineCapabilities` flags `false` |
| Layout transport | `WorkspaceLayoutRecord` with `{ region, tabGroup, order }` (v2); legacy v1 used `position.x` = region rail, `position.y` = tab index |
| Migrations | `migrateLayoutRecords` in `src/engine/layoutRecordMigrate.ts` |
| Mount | `createDomEngine` + `<DomWorkspaceShell />` or `createDomCanvasEngine.mount(container)` |

## Layout surfaces

- **Regions**: `main` and `sidebar` in the default horizontal split
- **Splits**: `react-resizable-panels` via `@/components/ui/resizable`
- **Tabs**: multiple panels per region with accessible tab strips
- **Drawer**: sidebar collapses into a toggle drawer at `max-width: 768px`

## Module map

- `src/engines/dom/engine.ts` - SPI handle factory
- `src/engines/dom/domCanvasEngine.ts` - `CanvasEngine.mount`
- `src/engines/dom/DomWorkspaceShell.tsx` - React shell
- `src/engines/dom/components/DomRegionLayout.tsx` - split + drawer layout
- `src/engines/dom/layoutCodec.ts` - layout record codec + activeTab clamp on import
- `src/engines/dom/digestAttention.ts` - digest attention from tab/region visibility, capped by live browser focus/visibility signals
- `src/engines/dom/browserAttentionSignalController.ts` - Lit `ReactiveController` tracking window focus/blur and document visibility
- `src/engine/layoutRecordMigrate.ts` - v1 to v2 layout record migrations
- Package export: `agentable-canvas/engines/dom`
- `src/embed/agentable-app-shell.ts` - `<agentable-app-shell>` Lit custom element; DOM-engine-only embed entry, built by `npm run build:embed:app-shell`
- `src/embed/appShell/AppShellWorkspace.tsx` - React tree behind the embed: engine creation, career-pack panel placement, spec rendering, layout persistence wiring
- `src/embed/appShell/appShellLayout.ts` - pure default-placement + localStorage layout persistence helpers
- `vite.embed-app-shell.config.ts` - isolated single-entry library build (never mixed into the multi-entry gallery-harnesses build, so its dependency graph stays unambiguous for bundle analysis)

## Tests

- `tests/unit/domEngine.test.tsx` - region layout, tab switching, drawer collapse, camera:none
- `tests/unit/layoutRecordMigration.test.ts` - v1 to v2 migration and spatial record passthrough
- `tests/unit/domLayoutPersistence.test.ts` - JSON persistence round-trip and activeTab clamp
- `tests/unit/unifiedPanelTargeting.test.ts` - open_panel region vs canvas routing
- `tests/unit/domDigestAttention.test.ts` - digest attention tiers from tab/visibility and browser signals
- `tests/unit/browserAttentionSignalController.test.ts` - controller lifecycle, signal reads, host update requests
- `tests/unit/appShellLayout.test.ts` - default placement + localStorage layout persistence (pure logic)
- `tests/component/agentable-app-shell.test.ts` - Lit element shadow DOM, brand tokens, `agentable:workspace-ready` event, region/tab layout
- `tests/e2e/gallery.spec.ts` (`11-app-shell` block) - load, tab switch, reload, layout-survives-reload assertion, tldraw-free DOM assertion

## Host embed wiring: `<agentable-app-shell>` 

Gallery example **11** (`examples/11-app-shell/`) mounts the unmodified career-pack
`PanelDefinition`s (`open-positions`, `applications`, `growth-paths`, `resources`) across the
`main` and `sidebar` regions on the DOM engine, in place of the tldraw canvas engine the other
career examples use. The embed entry (`src/embed/agentable-app-shell.ts` ->
`src/embed/appShell/AppShellWorkspace.tsx`) imports only the DOM engine path and the panel
rendering primitives (`panels/registry`, `panels/spec`, `panels/renderer`); it deliberately does
not import `panels/host` (which reaches the tldraw-only digest shape collector through the agent
runtime) or anything under `engines/tldraw/**`. The built bundle
(`dist/embed/agentable-app-shell.js`, `npm run build:embed:app-shell`) contains no tldraw module
and no tldraw watermark string, verified by direct grep against the built output (see
`logs/p11-dom-workspace-enginebundle-analysis.md` in the study log folder).

Fixing this bundle-exclusion check required one upstream fix beyond the example itself:
`src/panels/provenance/ComposedSpecPanel.tsx` (reachable through the shared panel catalog every
spec-kind panel renders through) imported `dispatchChatPrompt` from the `../../choreography`
barrel, which also re-exports tldraw-aware placement helpers from
`engines/tldraw/choreography/chatReserved.ts`; that barrel import pulled the entire `tldraw`
package into any bundle rendering catalog panels, DOM engine or not. Changed the import to the
specific submodule (`../../choreography/dispatchPrompt`), matching the convention
`agentable-starter-chip.ts` and `ask-about-this-button.ts` already used. No behavior change; the
`engineImportBoundary.test.ts` repo-wide check does not (and, as scoped today, cannot) catch this
class of leak, since it only flags literal `tldraw`/`@tldraw/*` specifiers outside
`src/engines/tldraw/`, not first-party barrels that re-export across the engine boundary.

## Out of scope (future work)

- Engine conformance harness registration
- Draw/perception capability refusals
