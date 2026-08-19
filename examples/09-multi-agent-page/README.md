# 09 — Multi-agent page

 gallery example (P6 seed): **two agents** on one page with chrome attribution, per-agent HITL queues, and scope refusal.

## Use case

Editor + concierge agents coexist; each opens different panels; out-of-scope tool calls return structured refusals.

## Fixtures

Harness source: `tests/e2e/harness/multiAgentHarness.ts` (unchanged). Gallery page: `examples/09-multi-agent-page/index.html`.

## Run e2e

```bash
npm run test:e2e -- tests/e2e/gallery.spec.ts -g "09-multi-agent-page"
```

Also: `npm run test:e2e -- tests/e2e/multi-agent-defaults.spec.ts`
