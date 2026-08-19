---
lrn: lrn::en:platform:agentable-canvas.feature.document-persistence::doc
related_docs:
  - docs/features/document-block-model.md
  - docs/features/authoring-toolkit.md
changelog:
  - date: 2026-07-21
    summary: workspace.documents localStorage persistence and DocumentView save FormBus wiring.
---

# Document panel persistence 

Host persistence for the portable document block model under `workspace.documents`. Documents survive reload when hosts mount `createPersistedDocumentStore` and users save through the Tier 2 document panel.

## Storage seam

| API | Role |
|-----|------|
| `createPersistedDocumentStore` | localStorage-backed `DocumentStore`; persists on every `set` |
| `withDocumentSource` | Routes `workspace.documents` query/mutate/subscribe through the store |
| `clearPersistedDocumentsForTests` | Test helper to reset a persistence namespace |

Storage key: `agentable-workspace-documents:<persistenceKey>` (default namespace `default`).

Seed documents merge with persisted state; persisted entries win on id collision.

## Save path

1. `DocumentView` registers on the catalog `FormBus` for its bound source.
2. Local block edits push the pre-save undo stack and mark the panel dirty.
3. Action-row **Save** submits the current stack blocks as a `DocumentPayload` through `workspace.documents` mutate.
4. `createPersistedDocumentStore` writes JSON to localStorage; reload + query restores the saved document.

Persisted save mutations reverse only through HITL compensating actions (-R3).

## Panel

- **Id:** `document`
- **Source:** `workspace.documents`
- **Save action:** `{ kind: 'mutate', source: 'workspace.documents', op: 'save' }`

## Module map

- `src/panels/document/documentPersistence.ts` — persisted store
- `src/panels/document/documentAdapter.ts` — in-memory + adapter routing
- `src/panels/document/DocumentView.tsx` — FormBus submit wiring
- `src/agents/panels/documentPanel.ts` — Tier 2 panel definition

## Tests

`tests/unit/documentPersistence.test.ts` — localStorage round-trip, mutate persistence, SpecRenderer save + remount reload.
