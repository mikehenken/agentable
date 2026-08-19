# 02 — Job board inline

 gallery example: one `<agentable-panel>` for **open-positions** embedded mid-page — the moss job-board shape on mock fixtures.

## Use case

Editorial career pages surface a filterable job list without mounting a full canvas. The panel loads career-pack Tier-2 definitions through a static adapter JSON file.

## Published entry points

- `agentable-canvas/embed/panel` → `/embed/agentable-panel.js` (auto-mount optional; here explicit tag)

## Interop matrix notes

| Host | Pattern |
|------|---------|
| Plain HTML | `<agentable-panel panel="open-positions" config-url="…">` |
| React | `<AgentablePanel panel="open-positions" configUrl="…" />` from `agentable-canvas/react/panel` |
| Vue | `<AgentablePanel panel="open-positions":config-url="…" @panel-ready="…" />` |
| Svelte | `<AgentablePanel panel="open-positions" configUrl={…} onPanelReady={…} />` |

## Run e2e

```bash
npm run test:e2e -- tests/e2e/gallery.spec.ts -g "02-job-board-inline"
```
