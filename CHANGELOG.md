# Changelog

All notable changes to `agentable-canvas` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
