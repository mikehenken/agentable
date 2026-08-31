# Workflow: adopt embed

Minimal path to a working embed without touching framework internals.

## 1. Choose surface

| Surface | Script tag | When |
|---------|------------|------|
| Full canvas | `<agentable-canvas>` | Chat + voice + engage-to-canvas |
| Whiteboard only | `/embed/agentable-whiteboard.js` | Spatial panels on tldraw (prebuilt bundle) |
| Single panel | `<agentable-panel panel="inbox">` via `/embed/agentable-panel.js` | Inline panel mid-page |
| Zero JS | `data-agentable-panel` attributes | Marketing page auto-mount |

Whiteboard and panel are **not** npm export subpaths. Hosts load prebuilt files from `dist/embed/` after build, or copy from the examples site.

## 2. Install

```bash
npm install @mikehenken/agentable-canvas
npm run build:embed # if dist/ missing inside node_modules
```

From the parent `sandals/` workspace root, prefer installing inside this package with `npm install --workspaces=false` to avoid hoisting surprises.

## 3. Lit full canvas

```html
<agentable-canvas
  tenant="demo"
  primary-color="#3B82F6"
  voice-enabled
  token-endpoint="/api/mint-token"
></agentable-canvas>
<script type="module" src="/path/to/agentable-canvas.js"></script>
```

Or import the published subpath after build:

```ts
import '@mikehenken/agentable-canvas/embed';
```

Token mint stays server-side. Never put `VITE_GEMINI_API_KEY` in host pages.

## 4. React whiteboard host

```tsx
import { LazyWhiteboardShell } from '@mikehenken/agentable-canvas/whiteboard';

<LazyWhiteboardShell
  config={{
    tenant: 'demo',
    persona: { tokenEndpoint: '/api/mint-token' },
  }}
  mode={{ kind: 'bounded', bounds: { w: 1920, h: 1080 } }}
/>
```

See `docs/setup/ADOPTER_QUICKSTART.md` for a two-panel example with custom registry entries.

## 5. Domain pack

```ts
import { createCareerPack } from '@agentable/career-pack';
// or createSupportInboxPack from @agentable/support-inbox-pack for tutorial shape
```

Register panels on the host; framework default registry is example-only. Packs are private workspace packages under `packages/`, not npm exports of `@mikehenken/agentable-canvas`.

## 6. Verify

```bash
npm run test:smoke    # gallery Playwright smoke
npm run test:release  # engine SPI + release conformance gate
```

## 7. Agent integration

Point coding agents at:

- This skill: `.cursor/skills/agentable-framework/SKILL.md`
- Machine index: `llms.txt`
- Live workspace (dev): canvas-over-MCP worker with OAuth scopes

For local gallery with Pages Functions (`/v1/chat`, `/v1/voice/token`), use `npm run serve:site:functions` with a `.dev.vars` file (see `.dev.vars.example`). Wrangler does not read `.env.local`.
