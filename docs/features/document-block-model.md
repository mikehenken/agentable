---

lrn: lrn::en:platform:agentable-canvas.feature.document-block-model::doc

related_docs:

  - docs/features/authoring-toolkit.md

  - docs/development/agentable-panels/01-DECISIONS.md

changelog:

  - date: 2026-07-21

    summary: document panel block model, DocumentView, pre-save undo, virtualization.

  - date: 2026-07-21

    summary: host persistence documented in document-persistence.md.

  - date: 2026-07-21

    summary: export documented in document-export.md.

---



# Document panel block model 



Portable document primitive for the open agent canvas. Agents edit through structured block ops — never markup.



## Block types



| Type | Fields |

|------|--------|

| `heading` | `level` 1–3, `text` |

| `paragraph` | `runs: TextRun[]` |

| `list` | `ordered`, nested `items` |

| `table` | `rows: TextRun[][][]` |

| `image` | `assetId`, optional `alt` |

| `callout` | `tone` info/warn/success, `runs` |

| `pageBreak` | — |



## Panel



- **Id:** `document`

- **Source:** `workspace.documents` (in-memory via `createInMemoryDocumentStore`; persisted via `createPersistedDocumentStore` — see [document-persistence.md](./document-persistence.md))

- **Catalog:** `document-view` composite



## pre-save undo



Block ops (`insert`, `replace`, `move`, `remove`) push onto a panel-local undo stack before save. Persisted `save` mutations reverse only through HITL compensating actions.



## virtualization



The block list virtualizes above threshold 50 (same declared threshold as catalog lists). DOM node count stays bounded for long documents.



## Security (G4)



Text runs render as React elements with sanitized plain text. Image blocks resolve asset ids only — no inline HTML/JS.



## Module map



- `src/panels/document/` — block model, ops, undo stack, DocumentView, adapter

- `src/agents/panels/documentPanel.ts` — Tier 2 panel definition

- `src/panels/catalog/v1-entries.ts` — `document-view` catalog entry



## Tests



`tests/unit/documentPanel.test.tsx` — document states, block ops undo/redo, block list virtualization.

