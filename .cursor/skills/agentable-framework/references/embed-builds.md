# Embed builds reference

Wave 4 through 8 introduced chunked ESM embeds, enforced gzip bundle budgets, CI typecheck, and import-boundary guards. This doc is the operational map for anyone touching `dist/embed/` or `vite.embed-*.config.ts`.

## Config inventory (disk)

Thirteen Vite embed configs exist at the package root:

| Config | Output base | Build style |
|--------|-------------|-------------|
| `vite.embed.config.ts` | `agentable-canvas` | Chunked ESM + UMD (`embedDualOutput`) |
| `vite.embed-whiteboard.config.ts` | `agentable-whiteboard` | Chunked ESM + UMD |
| `vite.embed-career-whiteboard.config.ts` | `career-whiteboard` | Chunked ESM + UMD |
| `vite.embed-operator-surface-placement.config.ts` | `agentable-operator-surface-placement` | Chunked ESM + UMD (`chunked: true`) |
| `vite.embed-panel.config.ts` | `agentable-panel` | Single-file ESM + UMD |
| `vite.embed-app-shell.config.ts` | `agentable-app-shell` | Single-file ESM + UMD |
| `vite.embed-iframe-host.config.ts` | `iframe-host-*` | HTML + chunked JS entry |
| `vite.embed-operator-surface.config.ts` | `agentable-operator-surface` | Single-file widget |
| `vite.embed-button.config.ts` | `voice-call-button` | Single-file widget |
| `vite.embed-starter-chip.config.ts` | `agentable-starter-chip` | Single-file widget |
| `vite.embed-ask-about.config.ts` | `ask-about-this-button` | Single-file widget |
| `vite.embed-agent-status.config.ts` | `agent-status-pill` | Single-file widget |
| `vite.embed-gallery-13-chrome.config.ts` | `agentable-gallery-13-chrome` | Single-file widget |

### Chunked vs single-file

**Chunked tldraw-bearing surfaces** (shared lazy vendor chunks under `dist/embed/chunks/`):

- `agentable-canvas` (full Lit shell)
- `agentable-whiteboard`
- `career-whiteboard`
- `agentable-operator-surface-placement`

**Single-file widgets and mid-size embeds** stay inlined (chunking is pure overhead for small bundles):

- Voice button, starter chip, ask-about button, agent-status pill, gallery-13 chrome, operator-surface (non-placement)
- Panel, app-shell, iframe-host

### Shared chunking policy

`vite.embed-chunking.ts` centralizes the split:

- `splitVendorChunks(id)` names vendor chunks (`vendor-syntax`, `vendor-diagrams`, `vendor-tldraw-schema`, `vendor-tldraw`)
- `embedDualOutput({ esFile, umdFile, umdName, cssName })` emits dual ESM-chunked + UMD-single-file rollup outputs
- `defineEmbedWidgetConfig({ chunked: true })` in `vite.embed-widget-shared.ts` opts a widget factory into the same policy

Anyone changing chunk boundaries edits **one** module, not N configs.

## Bundle budgets

`npm run check:bundle` runs `scripts/check-bundle-size.mjs`. Chunked ESM entries are measured by **eager closure** (static imports before first render) and **reachable payload** (static + dynamic import graph), not the tiny facade file alone.

Regressions require an intentional budget update in `check-bundle-size.mjs`, not a silent artifact bump.

### Baseline gzip figures (this session)

Captured from `npm run check:bundle` on the current tree (partial build: `prepare` path builds canvas + button only; other artifacts show as skipped):

| Artifact | Measure | Gzipped size | Budget | Status |
|----------|---------|--------------|--------|--------|
| `embed/agentable-canvas.js` | eager closure | 3883.65 KB | 3160.00 KB | over (122.9%) |
| `embed/agentable-canvas.js` | reachable payload | 3883.65 KB | 4260.00 KB | ok (91.2%) |
| `embed/agentable-canvas.umd.js` | file | 3438.53 KB | 3790.00 KB | ok (90.7%) |
| `styles.css` | file | 16.99 KB | 30.00 KB | ok (56.6%) |

All other budget rows were **not built** on this checkout (skipped with warning). Run `npm run build:embed:site` before `check:bundle` to measure the full embed family. Set `CHECK_BUNDLE_REQUIRE_ALL=1` in CI so missing artifacts fail the gate.

## Boundary guards

Five repo tests an agent will trip when crossing import or shipping boundaries:

| Guard | File | What it enforces |
|-------|------|------------------|
| `operatorModelG3Boundary` | `tests/unit/operatorModelG3Boundary.test.ts` | Operator bridge modules and built embed bundles carry no provider keys or SDK imports |
| `embedKeyStripGuard` | `tests/unit/embedKeyStripGuard.test.ts` | Every `vite.embed*.config.ts` defines `VITE_GEMINI_API_KEY` as empty at build time |
| `engineImportBoundary` | `tests/unit/engineImportBoundary.test.ts` | tldraw imports allowed only under `src/engines/tldraw/` |
| `panelsImportBoundary` | `tests/unit/panelsImportBoundary.test.ts` | `src/panels/` never imports tldraw or reaches into the engine implementation |
| `orchestrationIdBoundary` | `tests/unit/orchestrationIdBoundary.test.ts` | Orchestration program IDs never appear in `src/` product code |

## Canvas chrome

Whiteboard host chrome supports two fullscreen modes (`src/engines/tldraw/hostChrome/whiteboardHostChrome.ts`):

```ts
type WhiteboardFullscreenMode = 'canvas-expand' | 'document';
```

- `canvas-expand`: fixed overlay below `hostHeaderHeight` (career/marketing whiteboards)
- `document`: legacy `documentElement.requestFullscreen` (operator/gallery routes)

## Build commands

| Command | Scope |
|---------|-------|
| `npm run build:embed` | Canvas + voice-call-button (npm `prepare` path) |
| `npm run build:embed:site` | Twelve gallery embed configs (see below); omits `vite.embed-operator-surface.config.ts` |
| `npm run build:styles` | `dist/styles.css` via `scripts/build-styles.mjs` |
| `npm run build:embed:all` | embed + styles + `check:bundle` |

### `build:embed:site` scope

`npm run build:embed:site` chains twelve Vite configs (not all thirteen in the inventory table):

1. `vite.embed.config.ts` (`agentable-canvas`)
2. `vite.embed-button.config.ts` (`voice-call-button`)
3. `vite.embed-panel.config.ts` (`agentable-panel`)
4. `vite.embed-whiteboard.config.ts` (`agentable-whiteboard`)
5. `vite.embed-app-shell.config.ts` (`agentable-app-shell`)
6. `vite.embed-starter-chip.config.ts` (`agentable-starter-chip`)
7. `vite.embed-agent-status.config.ts` (`agent-status-pill`)
8. `vite.embed-ask-about.config.ts` (`ask-about-this-button`)
9. `vite.embed-career-whiteboard.config.ts` (`career-whiteboard`)
10. `vite.embed-gallery-13-chrome.config.ts` (`agentable-gallery-13-chrome`)
11. `vite.embed-operator-surface-placement.config.ts` (`agentable-operator-surface-placement`)
12. `vite.embed-iframe-host.config.ts` (`iframe-host-*`)

**Omitted:** `vite.embed-operator-surface.config.ts` (`agentable-operator-surface`) is not part of this script. Build it separately when you need that widget.
