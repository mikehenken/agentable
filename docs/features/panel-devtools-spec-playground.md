---
lrn: lrn::en:platform:agentable-canvas.feature.panel-devtools-spec-playground::doc
related_docs:
  - docs/features/a2ui-ingestion-adapter.md
changelog:
  - date: 2026-07-21
    summary: panel devtools spec inspector and read-only spec playground (/).
---

# Panel devtools + spec playground 

Dockable **Spec Inspector** debug panel and a read-only **spec playground** docs harness ( — not a visual builder).

## Spec Inspector (Tier 2 debug panel)

| Tab | Source | Content |
|-----|--------|---------|
| Validation | `devtools.validationTrace` | `validateSpec` issues (code, node, hint) |
| Bindings | `devtools.bindings` | `sources`, `state`, and `actions` from the inspected spec |
| History | `devtools.eventHistory` | Validation, repair rounds, HITL queue/resolution, action runs |

Panel id: `spec-inspector`. Compile with `createSpecInspectorPanelDefinition`.

## Session + adapter

| Export | Purpose |
|--------|---------|
| `createSpecDevtoolsSession` | In-memory inspection store with subscribe |
| `withSpecDevtoolsSources(session, base?)` | Read-only DataAdapter sources for the inspector |
| `recordSpecRepairFailure` `recordSpecInspection` | Bridge helpers for runtime wiring |

Optional `devtoolsSession` on `createPanelToolRuntime` records compose/patch validation and HITL events automatically.

## Spec playground

Read-only harness: paste PanelSpec JSON, preview render, live inspector.

- Component: `SpecPlayground` from `agentable-canvas/devtools`
- Docs page: `examples/spec-playground/index.html` (dev server)

## Tests

- `tests/unit/specDevtoolsSession.test.ts` — session + row mapping
- `tests/unit/specInspectorPanel.test.tsx` — panel definition + runtime bridge
- `tests/unit/specPlayground.test.tsx` — playground end-to-end diagnosis

Package entry: `agentable-canvas/devtools` → `src/devtools/index.ts`.
