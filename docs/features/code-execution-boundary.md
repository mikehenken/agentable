---
lrn: lrn::en:platform:agentable-canvas.feature.code-execution-boundary::doc
related_docs:
  - docs/features/document-block-model.md
  - docs/features/authoring-toolkit.md
  - docs/features/canvas-policy-merge.md
changelog:
  - date: 2026-07-21
    summary: centralized G4 boundary module, renderer + asset path hardening, red-team tests.
---

# Code-execution boundary hardening 

G4 defense: model-, adapter-, and host-supplied strings must render as **inert plain text** everywhere they surface in panel chrome, the spec renderer, document blocks, and HITL approval UI. No inline HTML, no `javascript:` URLs, no executable markup.

## Shared module

`src/security/codeExecutionBoundary.ts`

| API | Role |
|-----|------|
| `sanitizeInertText` | Strip tags, neutralize JS/data-HTML schemes and event-handler patterns before React text render |
| `validateAssetId` | Reject URL-like, markup, or path-shaped asset references |
| `sanitizeAssetIdForDisplay` | Safe document image asset label |
| `isCodePreviewAllowed` | Reads `canvasPolicy.allowCodePreview` ( P14 gate; off by default under both presets) |

## Wired surfaces

- **Document panel** — text runs, headings, alt text, export paths; `assetId` validated at parse time
- **Spec renderer** — unsupported node types, adapter/mutation error messages
- **Approval layer** — action labels, agent attribution, confirm copy, payload diff values
- **Catalog** — tenant literal strings via `resolveCatalogString`, field labels, badge text
- **Authoring asset bridge** — `insert_image` uses `validateAssetId` before host resolution

Hard boundaries under **`open`** preset: still no untrusted code execution; `allowCodePreview` remains `false` until P14 explicitly enables it.

## Red-team verification

```bash
npm run test -- --run tests/unit/codeExecutionBoundary.test.ts
npm run lint
```

Probe set: `RED_TEAM_INERT_STRINGS` in the boundary module (script tags, `onerror`, `javascript:`, SVG onload, data-HTML).

## Tests

`tests/unit/codeExecutionBoundary.test.ts` — unit sanitization, asset validation, canvasPolicy gate, and DOM inert assertions across DocumentView, BlockRenderer, ApprovalCard, catalog Header, and SpecRenderer error paths.
