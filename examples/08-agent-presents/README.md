# 08 - Agent presents (Apogee Aerospace · chat-to-draw)

Flagship interactive **chat-to-draw** product demo. A visitor types an instruction in a visible chat panel, and Nova, the fictional **Apogee Aerospace** systems design assistant, draws it live on a real tldraw whiteboard using the agent draw tools (`draw_shapes`, `connect_shapes`, `group_shapes`, `frame_shapes`, `arrange`, `annotate_panel`).

This is the only gallery example that mounts a real, live-editable tldraw canvas driven end to end by the chat panel (`WhiteboardChatPanel` → `ChatPanel` → `geminiChatClient`), rather than a scripted button demo or an inert config-only page.

## What you will see

1. The whiteboard mounts a real tldraw canvas with the chat panel already open.
2. Pick a starter prompt (or type your own), e.g. "Sketch a 3-stage launch-sequence flow."
3. With a live `chatProxyUrl` configured, Gemini reasons about the request and calls the draw tools; shapes appear on the canvas as the model calls them.
4. Without a live endpoint configured (the default for anyone who clones this repo without `config.local.json`), a system-style chat line reports **offline demo mode** and the same tool pipeline still draws a deterministic sample sketch, so the chat-to-draw mechanism is visibly working even with no credentials.

## Live vs. offline

| | Live | Offline (default) |
|---|---|---|
| Trigger | `config.local.json` present with a real `chatProxyUrl` | No `config.local.json`, or `config.example.json` placeholders unresolved |
| What draws | Whatever Gemini decides to sketch from the prompt | The same fixed `NORTHSTAR_FLOW_DIAGRAM` + `NORTHSTAR_SHAPE_BATCH` draw calls used by `examples/p8-agent-draw-demo` |
| Chat line | Model's own reply | "Offline demo mode: no live chat endpoint is configured..." |

The underlying bug fix that makes both paths work is in `src/chat/geminiChatClient.ts` and `src/voice/geminiLiveClient.ts`: every `executeTool` call is now bound to a stable acting-agent context (`withAgentToolContextAsync`), so draw/authoring tool handlers can resolve the acting agent instead of throwing. The offline path lives in `src/chat/offlineDrawFallback.ts`.

## Config: what the coordinator must fill in

This example loads its config from `config-url`, resolved by a small inline script in `index.html`:

1. It first tries `./config.local.json` (gitignored via `*.local.json`, never committed).
2. If that 404s, it falls back to the committed `./config.example.json` (placeholder endpoints, offline mode).

To wire up the live path, create `examples/08-agent-presents/config.local.json` as a copy of `config.example.json` with these two `persona` fields replaced:

| Field | Placeholder in `config.example.json` | Real value |
|---|---|---|
| `persona.chatProxyUrl` | `<SET_IN_config.local.json>` | `${VITE_LANDI_AGENTS_URL}/api/ai/gemini/chat` |
| `persona.tokenEndpoint` | `<SET_IN_config.local.json>` | the landi voice token-mint endpoint, if voice is re-enabled |

`config.local.json` is gitignored and must never be committed. `config.example.json` must never carry a real URL, key, or token - placeholders only.

`ChatPanel` treats any endpoint string shaped like `<...>` as "not configured" (see `isConfiguredEndpoint` in `ChatPanel.tsx`), so leaving the placeholders in place is exactly what makes the offline fallback trigger.

## Optional: tldraw license key

The whiteboard passes `licenseKey` to `<Tldraw>` from `import.meta.env.VITE_TLDRAW_LICENSE_KEY` (see `src/engines/tldraw/WhiteboardShell.tsx`). Set that env var at build time to remove the tldraw watermark; leave it unset for an unlicensed build (no error, just the watermark). Never commit a real key.

## Fixtures

- `fixtures/archipelagoResorts.ts` - pre-existing structured scenario fixtures (career trajectory, job-economy chart, island walkthrough) used only by the Vitest-level engine acceptance test below. They are unrelated to this page's live/offline chat-to-draw product surface and were left in place unchanged.
- `examples/p8-agent-draw-demo/fixtures/northstarBrand.ts` - reused by the offline fallback (`NORTHSTAR_FLOW_DIAGRAM`, `NORTHSTAR_SHAPE_BATCH`) so the deterministic offline sketch is the same one already exercised by the P8 demo.

## Tests

Engine-level acceptance (unchanged, still validates the draw/compose/walkthrough tool pipeline against the original scenario fixtures):

```bash
npm run test -- tests/integration/agentPresentsE2e.test.ts tests/unit/agentPresentsFixtures.test.ts
```

Bug-fix and offline-fallback unit tests:

```bash
npm run test -- tests/unit/geminiChatClient.test.ts tests/unit/geminiLiveToolContext.test.ts tests/unit/offlineDrawFallback.test.ts --pool=forks --poolOptions.forks.singleFork=true
```

Gallery smoke test (custom element registers, zero console errors):

```bash
npm run test:e2e -- tests/e2e/gallery.spec.ts -g "08-agent-presents"
```

New browser-tier chat-to-draw test (offline path: canvas mounts, a chat prompt draws shapes, no duplicate-tldraw warning):

```bash
npm run test:e2e -- tests/e2e/agent-presents-chat-to-draw.spec.ts
```

Gallery page: `examples/08-agent-presents/index.html`
