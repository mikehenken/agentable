# Changelog

All notable changes to `agentable-canvas` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-05-05

### Added

- **Packaged for cross-project install.** `package.json` now ships a `files`
  allowlist and a `prepare` lifecycle script (`scripts/prepare-install.mjs`)
  so `npm install github:mikehenken/agentable#v0.1.0` resolves the `./embed`
  and `./styles.css` exports immediately. The shipped `dist/` rides along
  in git; `prepare` rebuilds only if missing.
- **`INSTALL.md`** — install quickstart covering the three install modes
  (script-tag CDN via jsDelivr, npm-from-github, git submodule), voice
  setup, and verification steps.
- **`token-endpoint` attribute / `persona.tokenEndpoint` config field** —
  passes through to `useGeminiLive` so a server-minted ephemeral token
  endpoint can be wired without rebuilding. Production hosts MUST use this
  rather than `VITE_GEMINI_API_KEY` in client bundles.
- **`panelData` config injection** — `<CanvasShell config.panelData>` now
  accepts tenant-supplied mock data for Open Positions, Applications,
  Growth Paths, and Resources panels, so the OSS defaults can be replaced
  without forking the panel components.

### Changed

- **Bundle-size budget calibrated to v0.0.1 reality** — ESM raised from
  280 KB to 950 KB gz, UMD raised from 230 KB to 750 KB gz. The previous
  budget was set to an aspirational future code-split target and was
  failing CI on every release. Voice-button budgets unchanged.

### Notes

- The `prepare` script is a fallback. The default install path is
  zero-build because `dist/` ships in git for this repo.

## [0.0.1] — 2026-05-04

### Added

Initial public release.

- **Lit web component** (`<agentable-canvas>`) — drop-in embed for any HTML host.
  Shadow DOM isolation, dual-form (hex + HSL) brand tokens, custom-event API,
  imperative `startVoiceCall()` / `endVoiceCall()` methods.
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
  one registry. CopilotKit / AG-UI integration is planned for a future release.
- All 5 mock job listings, 3 mock applications, and 3 example growth paths
  are placeholder data for the OSS demo. Tenants override via panel injection
  or future tenant config.
