---
"agentable-canvas": minor
---

P0 foundations wave: panel contracts, host lifecycle, registry, chrome, tools, and engine SPI.

### Added

- Panel contract types (`PanelDefinition`, chrome options, registry entries) under `src/panels`.
- `createCanvasHost` with lifecycle promises (`whenReady`, `whenRestoreSettled`), persistence adapter hooks, and host-scoped panel registration.
- Engine SPI types (`EngineHandle`, `WorkspaceLayoutRecord`) in `src/engine` with a tldraw-backed adapter in `src/whiteboard/engine.ts`.
- CI-enforced import boundary: `src/engine` stays free of tldraw; only `src/whiteboard` may import tldraw.

### Changed

- Unified panel registry; `WhiteboardShell` and related shells accept an optional `host` prop.
- Replaced reserved panel data keys with typed chrome options.
- Merged tenant-specific tool branches into host-scoped `hostActions`; tools module restructured accordingly.

### Fixed

- Panel save races during concurrent persistence writes.
- Latent null editor dereference in `loadWhiteboardSnapshot` deferred repair pass.
