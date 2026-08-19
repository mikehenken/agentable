# 06 — React host deep

 gallery example: **React host** using published `agentable-canvas/react/panel` with host-owned chrome and event wiring — the studio integration shape.

## Use case

Product apps embed panels inside React layouts, listen for `@panel-ready` `onPanelReady`, and compose host actions beside the panel surface.

## Published entry points only

```tsx
import { AgentablePanel } from 'agentable-canvas/react/panel';
```

Built harness: `examples/06-react-host-deep/App.tsx` → `/gallery/06-react-host-deep.js`.

## Interop matrix notes

| Framework | Entry | Event forwarding |
|-----------|-------|------------------|
| **React** | `agentable-canvas/react/panel` | `onPanelReady`, `onApprovalPending`, … |
| **Vue 3** | `agentable-canvas/vue/panel` | `@panel-ready`, `@approval-pending`, … |
| **Svelte 4/5** | `agentable-canvas/svelte/panel` | `onPanelReady`, `onApprovalPending`, … |

Vue/Svelte wrappers delegate to `agentablePanelWrapperCore`. Gallery e2e locks React; Vue/Svelte mount tests are recommended follow-ups in wrapper hosts.

## Run e2e

```bash
npm run test:e2e -- tests/e2e/gallery.spec.ts -g "06-react-host-deep"
```
