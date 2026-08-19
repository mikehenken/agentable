# Spec playground 

Read-only **PanelSpec** preview harness for panel devtools.

## Purpose

Paste or edit PanelSpec JSON and inspect:

- Live render preview (when valid)
- Validation trace
- Source/state/action bindings
- HITL repair action history (via devtools session)

This is **not** a visual builder.

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000/examples/spec-playground/index.html](http://localhost:3000/examples/spec-playground/index.html).

## API

- `createSpecInspectorPanelDefinition` — Tier 2 dockable debug panel
- `createSpecDevtoolsSession` — in-memory inspection store
- `SpecPlayground` — docs harness React component (`agentable-canvas/devtools`)
