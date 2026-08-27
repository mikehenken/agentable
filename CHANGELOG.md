# Changelog

All notable changes to `agentable-canvas` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] — 2026-08-27

### Fixed

- **Embedded canvases fill their host again.** `WhiteboardCanvasFrame`'s
  pass-through branch rendered an unstyled wrapper, so the tldraw viewport had
  no flex parent and collapsed to toolbar height. Embeds also take more of the
  available screen space by default.
- **Panel chrome is styled on untyped panels.** Every chrome rule was gated
  behind a `data-theme`, so panels embedded without one rendered raw titles
  and unstyled minimise/close controls. Added a base layer, and the panel
  surface now fills the host height.
- **Examples that never ran.** The deployed gallery never received
  `dist/gallery`, so examples 06 and 09 failed to load their harness. The
  iframe host set a test-only flag that loads config but never renders,
  leaving example 07 blank. The app shell spread a method instead of calling
  it. Panel titles were translated only for three hardcoded key prefixes, so
  packs added later rendered raw message keys.
- **Invalid CSS restored.** Descendant combinators, `:host(...)` glued to
  descendant classes, and missing slashes in `rgb()` alpha and `aspect-ratio`
  values — each of which voided the whole declaration, producing unstyled
  chrome, transparent surfaces and uneven grid tiles.
- **Chat no longer renders provider errors.** The examples ship without
  credentials by design and now opt into mock explicitly via `mock-chat`;
  deployments that simply forgot a key still fail loudly. Light-canvas embeds
  define the chat palette, so the composer is no longer dark on a light board.

### Added

- Standalone `career-canvas.html` route in example 04 — the canvas as a full
  page, without the surrounding marketing chrome.
- Restored the `dev:p8-demo` and `build:gallery-harnesses` scripts referenced
  by the example READMEs.

## [0.3.0] — 2026-08-26

### Changed

**BREAKING** — career-pack tenant ids are now generic fictional brands. Hosts
passing `tenant="sandals"` or `tenant="moss"` must switch to `"archipelago"` and
`"helios"`. The tenant modules, fixtures, prompts, and exported constants were
renamed to match.

### Fixed

- **Panel and whiteboard embed surfaces render again.** `createCanvasHost` had
  lost four of its ten returned members (`agents`, `telemetry`, `approvals`,
  `undo`). `<agentable-panel>` and `<agentable-whiteboard>` mounted an empty
  shadow root with no console error, because `host.approvals.subscribe` threw
  inside an effect and React unmounted the tree.
- Restored the panel builder's `document-view` block, the i18n chrome catalog
  keys, and the v1 catalog component table.
- Test fixtures no longer read from sibling repositories, so the suite runs for
  external contributors.

### Added

- The examples gallery publishes to Cloudflare Pages on pushes to `main` and
  after a successful release. `npm run build:examples-site` assembles
  `dist/site` locally in the same layout.

### Known issues

- Test files covering in-progress features are excluded from the release gate
  and listed in `tests/release-exclusions.txt` (shrink-only). The full suite
  runs in CI.

### Removed

- Internal orchestration material: review and status docs, 67 QA driver
  scripts, the unreferenced orchestration review UI, and scripts that embedded
  absolute local filesystem paths.

## [0.2.0] — 2026-07-13

### Added

Panel docking, auto-arrange, and workspace-mode layout system for the tldraw
whiteboard substrate (`./whiteboard`).

- **Panel docking engine** (`panelDockEngine.ts`, `usePanelDocking.ts`,
  `panelDockUiState.ts`, `PanelDockHighlightOverlay.tsx`) — flush edge docking
  and dock-to-sibling with live drop-target highlight overlay.
- **Auto-arrange** (`siteContextAutoArrange.ts`) — toolbar button plus
  arrange-on-open placement over the 12-column site-context grid, with symmetric
  gutters. Adding a panel preserves the current zoom.
- **Dock presets & workspace mode** (`siteContextDockPresets.ts`,
  `siteWorkspaceMode.ts`) — chat defaults docked left full-height, file manager
  docked right; docked panels track group resize; workspace zoom-to-fit.
- **Global panels isolation** (`canvasGlobalPanels.ts`) — all-sites panel
  isolation so global panels are not scoped to a single site context.

### Changed

- 12-column grid (`gridLayout.ts`) now underpins site-context panel placement.
- Site-context panel layout, layout-repair, and context-group auto-resize updated
  to cooperate with docking and workspace mode.

### Tests

- New unit coverage: `panelDockEngine`, `siteContextAutoArrange`,
  `siteWorkspaceMode`, `canvasGlobalPanels`; expanded `contextGroupApi`,
  `gridLayout`, `siteContextPanelLayout`.

## [0.0.1] — 2026-05-04

### Added

Initial public release.

- **Lit web component** (`<agentable-canvas>`) — drop-in embed for any HTML host.
  Shadow DOM isolation, dual-form (hex + HSL) brand tokens, custom-event API,
  imperative `startVoiceCall` `endVoiceCall` methods.
- **React wrapper** (`agentable-canvas/react`) — typed props + event handlers
  for React 18/19 hosts.
- **Pure React shell** (`agentable-canvas/react-canvas`) — `<CanvasShell>` and
  `useVoiceCall` hook for React-native hosts that don't want Shadow DOM.
- **Voice (Gemini Live)** — `gemini-3.1-flash-live-preview` over WebSocket,
  16 kHz dual-PCM AudioWorklet, ~200–400 ms RTT, barge-in enabled, mock
  fallback when no API key is set.
- **Tool-calling surface** — 12 built-in tools (`open_chat`, `open_positions`,
  `show_job_detail`, `open_growth_paths`, `open_resources`, `open_career_tools`,
  `open_learning`, `open_applications`, `show_application_detail`,
  `close_panels`, `kb_search`, `share_artifact`) registered via Gemini Live's
  native function-declaration protocol.
- **Panel system** — 10 example panels (Chat, Artifacts, Open Positions,
  Applications, Resources, Career Tools, Growth Paths, Voice Widget, Settings,
  Journey) with lazy-loading, draggable layout, localStorage-persisted
  positions, hover/focus-prefetch, ChunkErrorBoundary recovery.
- **Tldraw whiteboard substrate** — alternative to absolute-positioned panels
  via `<WhiteboardShell>`. Tools target the same `panelShapeApi`.
- **Tenant config** — `<CanvasShell config>` accepts deeply-partial
  `{ tenant, persona, labels, panels, navItems }`. Defaults are intentionally
  generic; tenants supply branded content.
- **CSS design tokens** — `--landi-color-*`, `--landi-radius-*`,
  `--landi-shadow-*`, etc. Dual hex + HSL form so Tailwind alpha utilities
  (`bg-canvas-primary/30`) honor tenant overrides.
- **State management** — three Zustand stores (`useLayoutStore`,
  `usePanelIntentStore`, `useCanvasConfig`) plus a `window.__voiceKernel__`
  singleton for cross-React voice subscription.
- **Build outputs** — ESM + UMD bundles (`dist/embed/`), CSS inlined into the
  JS so it adopts into the Shadow Root via Lit's `static styles`.

### Notes

- CopilotKit dependencies are present (`@copilotkit/react-core`, `@copilotkit/react-ui`)
  but are not yet wired. The current tool surface uses Gemini Live's native
  function-calling protocol so it works for both voice and chat paths through
  one registry. CopilotKit AG-UI integration is planned for a future release.
- All 5 mock job listings, 3 mock applications, and 3 example growth paths
  are placeholder data for the OSS demo. Tenants override via panel injection
  or future tenant config.
