---

lrn: lrn::en:platform:agentable-canvas.feature.document-export::doc

related_docs:

  - docs/features/document-block-model.md

  - docs/features/document-persistence.md

  - docs/development/agentable-panels/03-AGENT_LAYER_SPEC.md

changelog:

  - date: 2026-07-21

    summary: export_document host action; PDF/DOCX from block model; golden byte-stable seed.

---

# Document panel export 

Export portable document blocks to **PDF** and **DOCX** without HTML round-trip (03 section 12).

## Host action

| Tool | Parameters | Capability |
|------|------------|------------|
| `export_document` | `panelId`, `format: 'pdf' \| 'docx'` | `job` (approval `none`) |

Register via `createExportDocumentHostAction({ resolveDocument })` and pass to `createCanvasHost({ hostActions: [...] })`.

Response includes `filename`, `mimeType`, `sha256`, and `bytesBase64`.

## Export module

- `exportDocument(payload, format)` — core API
- `exportDocumentBoth(payload)` — PDF + DOCX in parallel
- Fixed export epoch (`DOCUMENT_EXPORT_EPOCH`) for deterministic golden output

Block types map directly to layout primitives (headings, runs, lists, tables, image placeholders, callouts, page breaks).

## Golden seed

`DOCUMENT_EXPORT_GOLDEN_SEED` covers every block type. Expected SHA256 digests live in `tests/fixtures/document-export-golden.json`.

## Tests

`tests/unit/documentExport.test.ts` — golden SHA256 match, repeat-export byte stability, host action wiring, capability class.

## Module map

- `src/panels/document/documentExport.ts` — orchestration
- `src/panels/document/exportPdf.ts` — pdf-lib writer
- `src/panels/document/exportDocx.ts` — OOXML + deterministic ZIP writer
- `src/panels/document/deterministicZip.ts` — byte-stable STORE zip
- `src/panels/document/exportDocumentHostAction.ts` — host tool factory
