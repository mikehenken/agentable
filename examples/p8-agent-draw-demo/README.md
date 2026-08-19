# P8 — Agent draw & see (try-it demo)

Interactive **Northstar Atelier** demo: scripted `draw_shapes` and `read_canvas` tool calls on a live tldraw whiteboard — **no LLM or API keys**.

## What you will see

1. Click **Run full demo** (or step through individual actions).
2. The design agent **Astra** draws a flow diagram and explicit shapes on the canvas.
3. **Read canvas (see)** returns a shape graph with `agentId` provenance (`northstar-designer`).
4. Shapes carry `meta.agentableAgent` — visible in the activity log and provenance summary.

## Quick start (recommended — Vite dev, no embed build)

```bash
cd sandals/agentable-canvas
npm run dev:p8-demo
```

Open [http://localhost:3018/examples/p8-agent-draw-demo/index.dev.html](http://localhost:3018/examples/p8-agent-draw-demo/index.dev.html)

## Gallery e2e server path

For the static gallery server (Playwright parity):

```bash
cd sandals/agentable-canvas
npm run build:gallery-harnesses
node scripts/e2e-embed-server.mjs
```

Open [http://127.0.0.1:5199/examples/p8-agent-draw-demo/index.html](http://127.0.0.1:5199/examples/p8-agent-draw-demo/index.html)

## What to click

| Action | Tool | Effect |
|--------|------|--------|
| **Run full demo** | `clear_agent_drawings` → `draw_shapes` ×2 → `read_canvas` | Full draw + see loop with provenance summary |
| Draw flow diagram | `draw_shapes` (flow layout) | Auto-layout boxes + arrows from logical nodes |
| Draw shape batch | `draw_shapes` (explicit shapes) | Branded box + caption text |
| Read canvas (see) | `read_canvas` | Shape graph in activity log; provenance counts in sidebar |
| Clear agent drawings | `clear_agent_drawings` | Removes agent-stamped marks |

## Fixtures

Fictional brand data: `fixtures/northstarBrand.ts`

Harness (imports `src/` — not for gallery copy-paste): `tests/e2e/harness/p8AgentDrawDemoHarness.tsx`

## Tests

```bash
npm run test:e2e -- tests/e2e/p8-agent-draw-demo.spec.ts
```

## Related docs

- [drawing-tools-provenance.md](../../docs/features/drawing-tools-provenance.md)
- [perception-read-screenshot-canvas.md](../../docs/features/perception-read-screenshot-canvas.md)
- [p8-agent-draw-demo.md](../../docs/features/p8-agent-draw-demo.md)
