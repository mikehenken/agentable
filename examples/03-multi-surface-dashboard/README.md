# 03 — Multi-surface dashboard

 gallery example: chat-ready dashboard with **two auto-mounted panels**, a named **slot**, and an **agent-status-pill** widget — all on one shared page session.

## Use case

Internal ops consoles mount multiple agent surfaces without authoring mount JS. Auto-scan wires placeholders; `open_panel` can target `data-agentable-slot="sidebar"`.

## Published entry points

| Bundle | Role |
|--------|------|
| `/embed/agentable-panel.js` | Auto-mount scan |
| `/embed/agent-status-pill.js` | Status widget |

## Interop matrix notes

React/Vue/Svelte hosts should call the same embed bundles once; wrappers only forward panel events — session joining is embed-owned.

## Run e2e

```bash
npm run test:e2e -- tests/e2e/gallery.spec.ts -g "03-multi-surface-dashboard"
```
