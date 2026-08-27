# Workflow: adopt embed

Minimal path to a working embed without touching framework internals.

## 1. Choose surface

| Surface | Script tag | When |
|---------|------------|------|
| Full canvas | `<agentable-canvas>` | Chat + voice + engage-to-canvas |
| Whiteboard only | whiteboard embed bundle | Spatial panels on tldraw |
| Single panel | `<agentable-panel panel="inbox">` | Inline panel mid-page |
| Zero JS | `data-agentable-panel` attributes | Marketing page auto-mount |

## 2. Install

```bash
npm install github:mikehenken/agentable#v0.3.0
npm run build:embed # if dist/ missing
```

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

Token mint stays server-side. Never put `VITE_GEMINI_API_KEY` in host pages.

## 4. React whiteboard host

```tsx
import { LazyWhiteboardShell } from 'agentable-canvas/whiteboard';

<LazyWhiteboardShell
  config={{ tenant: 'demo', canvasMode: 'bounded' }}
  tokenEndpoint="/api/mint-token"
/>
```

See `docs/setup/ADOPTER_QUICKSTART.md` for a two-panel example with custom registry entries.

## 5. Domain pack

```ts
import { createCareerPack } from 'agentable-canvas/career-pack';
 or createSupportInboxPack from support-inbox-pack for tutorial shape
```

Register panels on the host; framework default registry is example-only.

## 6. Verify

```bash
npm run check:interop # embed + React smoke
npm run test:release-conformance # engine + a11y gate scaffold
```

## 7. Agent integration

Point coding agents at:

- This skill: `.cursor/skills/agentable-framework/SKILL.md`
- Machine index: `llms.txt`
- Live workspace (dev): canvas-over-MCP worker with OAuth scopes
