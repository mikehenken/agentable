---
lrn: lrn::en:platform:agentable-canvas.feature.gallery-d47::doc
related_docs:
  - docs/features/agent-presents-demo-scenarios.md
  - docs/features/auto-mount-scan.md
  - docs/features/panel-framework-wrappers.md
  - docs/features/open-agent-canvas-gallery.md
  - docs/development/INTEROP_MATRIX.md
changelog:
  - date: 2026-07-21
    summary: adds gallery example 12 (Meridian Labs open agent canvas).
  - date: 2026-07-21
    summary: completes gallery 01–10 with Playwright e2e, import guard, and CI interop matrix rows.
---

# embed example gallery

Ten self-contained pages under `examples/` prove the public embed API on mock static adapters. Each example ships a use-case README and a Playwright spec in `tests/e2e/gallery.spec.ts`.

## Examples

| Id | Folder | Shape |
|----|--------|-------|
| 01 | `01-career-homepage` | Header voice + bounded canvas (P4/P5 seed) |
| 02 | `02-job-board-inline` | Single `<agentable-panel>` mid-page (moss) |
| 03 | `03-multi-surface-dashboard` | Multi-surface + slot + status widget |
| 04 | `04-zero-js-marketing` | Auto-mount, one script tag |
| 05 | `05-bounded-demo-kiosk` | config-url bounded kiosk (P4/P5 seed) |
| 06 | `06-react-host-deep` | React `AgentablePanel` host (studio) |
| 07 | `07-iframe-cms` | iframe host fallback |
| 08 | `08-agent-presents` | Archipelago walkthrough fixtures |
| 09 | `09-multi-agent-page` | Two-agent attribution (P6 seed) |
| 10 | `10-locale-rtl` | Arabic RTL locale |
| 12 | `12-open-agent-canvas` | Meridian Labs open canvas + document export |

Shared fixtures: `examples/shared/archipelago-*.json` and `meridian-labs-open-*.json` (fictional content only).

## Guards

```bash
npm run check:gallery-imports
npm run test -- tests/unit/galleryImportBoundary.test.ts
npm run test:e2e -- tests/e2e/gallery.spec.ts
```

## Interop matrix (Vue Svelte React)

| Framework | Entry | Gallery example |
|-----------|-------|-----------------|
| React | `agentable-canvas/react/panel` | `06-react-host-deep` |
| Vue 3 | `agentable-canvas/vue/panel` | Same props/events; mount test deferred to wrapper vitest |
| Svelte | `agentable-canvas/svelte/panel` | Same props/events; mount test deferred to wrapper vitest |

Plain HTML examples use `/embed/*.js` bundles directly. Framework wrappers forward the typed event map via `agentablePanelWrapperCore`.

## Related

- `scripts/check-interop-matrix.mjs --run` includes gallery e2e + import guard
- P8 agent-presents scenario acceptance: `tests/integration/agentPresentsE2e.test.ts`
