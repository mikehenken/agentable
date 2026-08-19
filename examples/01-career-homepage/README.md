# 01 — Career homepage

 gallery example: **Archipelago Resorts** career homepage with a header voice pill, agent-first greeting, and bounded canvas on engage — the sandals career shape on mock static adapters.

## Use case

Marketing sites embed voice outside the canvas. A visitor clicks **Talk with Meridian** in the nav; the shared page session connects the voice button to the canvas chat dock. `greetingMode: agent-first` speaks the concierge welcome after the user gesture.

## Published entry points

| Bundle | Role |
|--------|------|
| `/embed/voice-call-button.js` | Header voice trigger ( shared session) |
| `/embed/agentable-canvas.js` | Bounded career canvas |

Config loads from `/examples/shared/archipelago-career-config.json` (static adapter, no build step).

## Interop matrix notes

| Host | Notes |
|------|-------|
| Plain HTML | This page — script tags only |
| React | Use `AgentablePanel` + voice widget via `agentable-canvas/react/panel` and embed bundles |
| Vue Svelte | Thin wrappers forward `@panel-ready`; mount voice bundle separately |

## Run e2e

```bash
npm run test:e2e -- tests/e2e/gallery.spec.ts -g "01-career-homepage"
```
