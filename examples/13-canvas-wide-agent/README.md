# 13 — Canvas-wide operator (Meridian Labs)

 gallery example **13**: fictional **Meridian Labs** open agent canvas with the P13 canvas-wide operator surface — **dock-inside** rail beside the whiteboard plus a **floating** overlay placement, sharing one page session with the scoped Atlas copilot.

## P13 features shown

| Feature | Where |
|---------|--------|
| Operator surface | Nested in both placements — tabbed threads, Ask/Build/Draw, model switcher shell |
| Placements | `dock-inside` side rail + `floating` bottom-right overlay |
| Mode tool-scope | Operator modes enforced at runtime when bridge bound |
| Model switcher | UI shell; rebind when host registers `registerModelResolver` |
| Multi-agent registration | Operator `canvas:operator` scope alongside Meridian scoped agent |
| Voice off-by-default | `meridian-labs-open-config.json` sets `voiceEnabled: false` |

## Fixtures

Shared host config: `examples/shared/meridian-labs-open-config.json` 
Shared adapter data: `examples/shared/meridian-labs-open-data.json`

## Published entry points only

Gallery pages import embed bundles from `/embed/` — never from `src/` internals.

| Bundle | Purpose |
|--------|---------|
| `/embed/agentable-whiteboard.js` | Open canvas + scoped agent |
| `/embed/agentable-operator-surface-placement.js` | Operator placements + nested surface |

Standalone operator-only hosts may use `/embed/agentable-operator-surface.js` instead.

## Run locally

Build embed bundles (includes operator entries):

```bash
npm run build:embed:operator
npm run build:embed:whiteboard
```

Start the gallery static server (port **5199**):

```bash
node scripts/gallery-server-nobuild.mjs
```

Open:

[http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html](http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html)

## Run tests

```bash
npm run check:gallery-imports
npm run test -- tests/component/agentable-operator-surface.test.ts tests/component/operator-surface-placement.test.ts
npm run test:e2e -- tests/e2e/gallery.spec.ts -g "13-canvas-wide-agent"
```

Gallery page: `examples/13-canvas-wide-agent/index.html`
