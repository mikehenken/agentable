# Spec IR reference

Single flat-node-map JSON format. One renderer, one validator, one migration path for Tiers 1–3.

## Envelope

```json
{
  "v": 1,
  "origin": "host",
  "root": "main",
  "nodes": {
    "main": { "type": "stack", "props": { "gap": "md" }, "children": ["title", "form"] },
    "title": { "type": "text", "props": { "text": "Hello" } },
    "form": { "type": "form", "props": { "source": "$data.profile" }, "children": ["submit"] },
    "submit": { "type": "button", "props": { "label": "Save", "action": "save" } }
  },
  "actions": {
    "save": { "kind": "mutate", "source": "site.profile", "destructive": false }
  }
}
```

## Bindings 

Allowed roots only:

- `$scope.*` — panel scope (contextId, entityId)
- `$data.*` — adapter query results
- `$state.*` — panel-local state

Conditional: `showIf: { "$eq": ["$state.tab", "details"] }` — no other expression forms in v1.

## Tiers

| Tier | Authoring | Body |
|------|-----------|------|
| 1 Static | `defineStaticPanel` | Fixed markup |
| 2 Schema | `defineSchemaPanel` | IR compiled from builder |
| 3 Composed | Agent `compose_panel` | Runtime IR instance (never registry entry) |
| 4 Custom React | `{ kind: 'react', loader }` | Host React panel |

## Validation pipeline 

Seven steps, identical for host and agent:

1. Envelope + version
2. Catalog membership
3. Per-node Zod prop validation
4. Action refs resolve only against declared actions map
5. Budgets (max 200 nodes, depth 12)
6. URL and string sanitization
7. Agent-only: one repair round → fallback card

## A2UI ingestion 

A2UI v1.0 wire payloads translate to native IR via `agentable-canvas/a2ui`. Conformance fixtures: `tests/fixtures/a2ui/conformance-fixtures.json`.

## Migrations 

Unknown node types → data-preserving placeholders, not hard rejection. Spec `v` + `PanelMeta.schemaVersion` + ordered migrations ship in v1.

## v1 catalog exclusions 

No `markdown` or `image` primitives until URL sanitizer gate passes.
