---
lrn: lrn::en:platform:agentable-canvas.feature.p8-agent-draw-demo::doc
related_docs:
  - docs/features/drawing-tools-provenance.md
  - docs/features/perception-read-screenshot-canvas.md
  - examples/p8-agent-draw-demo/README.md
changelog:
  - date: 2026-07-21
    summary: P8 try-it demo surface with scripted draw_shapes and read_canvas on Northstar Atelier fixtures.
  - date: 2026-07-22
    summary: Iteration-7 fundamental rework — production index.html uses 08-style embed + gallery-demo.mjs; harness isolated to index.dev.html Playwright only; public runNorthstarDemo runScriptedTool on agentable-whiteboard.
---

# P8 agent draw & see — try-it demo

Runnable browser demo for Phase 8 **agents draw and see**: scripted agent tool calls on a live whiteboard with provenance verification — no LLM or API keys.

## Surfaces

| Surface | URL (local) |
|---------|-------------|
| **Production gallery** | `http://127.0.0.1:5199/examples/p8-agent-draw-demo/index.html` — `<agentable-whiteboard>` + `gallery-demo.mjs` |
| Vite dev harness | `http://localhost:3018/index.dev.html` via `npm run dev:p8-demo` |
| Playwright e2e | Same gallery URL; harness bundle only via `index.dev.html` |

## Behavior

1. **Draw** — `draw_shapes` with flow auto-layout and explicit shape batch; every mark stamped `meta.agentableAgent`.
2. **See** — `read_canvas` returns a shape graph; nodes include `agentId` when provenance is present.
3. **Clear** — `clear_agent_drawings` removes agent-stamped marks only.

Fixtures use fictional **Northstar Atelier** brand (`examples/p8-agent-draw-demo/fixtures/northstarBrand.ts`).

## Module map

- `examples/p8-agent-draw-demo/index.html` — production gallery (08 pattern)
- `examples/p8-agent-draw-demo/gallery-demo.mjs` — thin sidebar controller calling embed API
- `examples/p8-agent-draw-demo/config.example.json` — northstar offline config (bounded 400×720)
- `src/embed/galleryScriptedDemo.ts` — scripted tool runner bundled in embed
- `tests/e2e/harness/p8AgentDrawDemoHarness.tsx` — React harness for dev/e2e only

## Tests

- `tests/e2e/p8-agent-draw-demo.spec.ts` — Playwright smoke (`@demo`)
