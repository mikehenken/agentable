# 11 · App shell (DOM engine) · Archipelago Resorts

Gallery example **11**: fictional **Archipelago Resorts** career workspace demonstrating the
DOM workspace engine (`engine="dom"`,..T6): regions, resizable splits, per-region tabs,
`camera: none`, as an alternative to the tldraw canvas engine used by the other career examples
in this gallery.

The panels themselves are the same unmodified career-pack `PanelDefinition`s (`open-positions`,
`applications`, `growth-paths`, `resources`) rendered elsewhere in this gallery on the tldraw
engine; here they are placed into the DOM engine's `main` and `sidebar` regions instead of on a
canvas.

## Layout

| Region | Tabs |
|--------|------|
| `main` | Open Positions, Growth Paths |
| `sidebar` | My Applications, Resources |

Drag the split handle to resize. Click a tab to switch the active panel in that region. Reload
the page: the region/tab/split layout is restored from `localStorage`, not reset to the default
placement above.

## Bundle contract

`<agentable-app-shell>` (`src/embed/agentable-app-shell.ts`, built by
`npm run build:embed:app-shell` into `dist/embed/agentable-app-shell.js`) imports only the DOM
engine path (`agentable-canvas/engines/dom`) and the panel-rendering primitives
(`panels/registry`, `panels/spec`, `panels/renderer`). It never imports `engines/tldraw/**`, the
`tldraw` package, or `panels/host` (which reaches the tldraw-only digest shape collector through
the agent runtime). The built bundle contains no tldraw module and no tldraw watermark string.
See `logs/p11-dom-workspace-enginebundle-analysis.md` in the study log
folder for the exact grep evidence.

## Published entry points only

Gallery pages must import from package exports and built embed bundles, never from `src/`
internals.

## Run

```bash
npm run build:embed:app-shell
npm run test:e2e -- tests/e2e/gallery.spec.ts -g "11-app-shell"
npm run test -- tests/unit/appShellLayout.test.ts
npm run test:component
```

Gallery page: `examples/11-app-shell/index.html`
