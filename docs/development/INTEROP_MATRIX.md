---
doc_type: reference
title: Interop matrix
description: CI smoke commands for embed, React, and landi-canvas-studio integration surfaces.
created_at: "2026-07-21"
version: "1.0.0"
updated_at: "2026-07-21"
lrn: "lrn::en:platform:component:agentable-canvas:interop-matrix::doc"
entity_id: platform.component.agentable-canvas.interop-matrix
entity_type: reference
related_docs:
  - "development/ARCHITECTURE.md"
  - "setup/whiteboard-embed.md"
  - "setup/ADOPTER_QUICKSTART.md"
changelog:
  - version: "1.0.0"
    date: "2026-07-21"
    type: "minor"
    author: "documentation-engineer"
    description: " interop smoke matrix with verified package.json commands"
---

# Interop matrix

Smoke checks that verify the same whiteboard substrate works across Lit embed, React imports, and the landi-canvas-studio reference host. Every command below exists in the relevant repo `package.json` at the time of writing.

Run the matrix from `agentable-canvas`:

```bash
npm run check:interop
```

Pass `--run` to execute checks (stub prints the matrix by default). Pass `--strict-bundle` to fail when `check:bundle` exceeds budget (off by default because whiteboard bundles currently exceed legacy gates).

## agentable-canvas

| Surface | What it proves | Command | Test artifact |
|---------|----------------|---------|-----------------|
| Legacy substrate retired | Single tldraw engine; `src/canvas/` gone | `npm run test -- tests/unit/p7t2LegacySubstrateRetirement.test.ts` | Vitest |
| React panel registry | Host loader map resolves to PanelShape | `npm run test -- tests/unit/whiteboardPanelRegistry.test.ts` | Vitest |
| Career embed/React parity | Same tenant + panel ids for embed vs React config | `npm run test -- tests/unit/careerPackInterop.test.ts` | Vitest |
| Engine SPI boundary | No illegal cross-imports | `npm run test -- tests/unit/engineImportBoundary.test.ts` | Vitest |
| Lit `<agentable-whiteboard>` | Custom element registers; shadow mount | `npm run test:component -- --files tests/component/agentable-whiteboard.test.ts` | web-test-runner |
| Lit `<agentable-canvas>` | Legacy tag still registers | `npm run test:component -- --files tests/component/agentable-canvas.test.ts` | web-test-runner |
| Embed build | All embed bundles compile | `npm run build:embed` | `dist/embed/*` |
| Embed binding guard | Custom elements export expected tags | `npm run check:embed-bindings` | `scripts/check-embed-bindings.mjs` |
| gallery import guard | Examples never import `src/` internals | `npm run check:gallery-imports` | `scripts/check-gallery-imports.mjs` |
| gallery e2e | Ten examples green, zero console errors | `npm run test:e2e -- tests/e2e/gallery.spec.ts` | `examples/01`–`10` |
| Bundle budget (informational) | Gzip size vs legacy ceilings | `npm run check:bundle` | `scripts/check-bundle-size.mjs` |

### Full unit suite (optional gate)

```bash
npm run test
npm run lint
npm run typecheck
```

## landi-canvas-studio (reference host)

Run from `landi-canvas-studio` root. Studio pins `agentable-canvas` via git ref (`github:mikehenken/agentable#v0.2.0`).

| Surface | What it proves | Command | Notes |
|---------|----------------|---------|-------|
| Host wiring unit tests | `createCanvasHost` + whiteboard loaders | `npm run test` | Includes `src/lib/canvas-host.test.ts` |
| Whiteboard mount (mock e2e) | Full-page shell loads whiteboard chunk | `npm run test:e2e:mock` | Requires `.env.local` per studio setup |
| Local substrate alias | HMR against sibling clone | `VITE_LOCAL_AGENTABLE=1 npm run dev` | Manual smoke at `http://localhost:5173` |

Studio does not yet define `check:interop`; use the table above in CI orchestration or a future studio workflow step.

## CI wiring (today)

| Repo | Workflow | Steps relevant to interop |
|------|----------|---------------------------|
| agentable-canvas | `.github/workflows/ci.yml` | `npm run test` (quality-gates job) |
| landi-canvas-studio | (project CI) | `npm run test`, `npm run test:e2e:mock` when configured |

Suggested addition to agentable-canvas CI (not yet merged):

```yaml
- run: npm run build:embed
- run: npm run check:embed-bindings
- run: npm run test:component
- run: npm run check:interop -- --run
```

## Known gaps

| Gap | Impact | Tracking |
|-----|--------|----------|
| Vue/Svelte gallery host pages | Wrapper interop locked via shared core; no dedicated gallery HTML yet | notes in `06-react-host-deep` README |
| `check:bundle` fails on current whiteboard payload | Legacy 950 KB gate vs ~3.7 MB gz `agentable-canvas.js` | Recalibrate budgets or split bundles |
| No gzip gate for `agentable-whiteboard.js` | ~3.0 MB gz ungated | Add row to `check-bundle-size.mjs` |
| Studio interop not in agentable CI | Cross-repo drift | Run studio tests in orchestration study or monorepo workflow |
| `./panels` not in package exports | Adopters need alias for `createCanvasHost` | Future export path |

## Related

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [whiteboard-embed.md](../setup/whiteboard-embed.md)
- Script: `scripts/check-interop-matrix.mjs`
