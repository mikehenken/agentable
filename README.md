# agentable-canvas

Embeddable AI canvas: chat panel, draggable workspace, voice transport (Gemini Live), and a Lit web component shell. Drop one tag into any page: React 18/19, Vue, Angular, plain HTML.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Repository:** [mikehenken/agentable](https://github.com/mikehenken/agentable) (default branch: `main`)

## Documentation

| Topic | Link |
|-------|------|
| Architecture (whiteboard, PanelShape, exports) | [docs/development/ARCHITECTURE.md](docs/development/ARCHITECTURE.md) |
| Release workflow | [docs/setup/RELEASE.md](docs/setup/RELEASE.md) |
| Branching (`main` only) | [docs/setup/BRANCHING.md](docs/setup/BRANCHING.md) |
| Full index | [docs/DOCS_INDEX.md](docs/DOCS_INDEX.md) |

## Package exports

| Path | Surface |
|------|---------|
| `@mikehenken/agentable-canvas/whiteboard` | tldraw infinite canvas + `PanelShape` panels |
| `@mikehenken/agentable-canvas/react-canvas` | Pure React `<CanvasShell>` |
| `@mikehenken/agentable-canvas/react` | React wrapper over Lit element |
| `@mikehenken/agentable-canvas/embed` | Lit `<agentable-canvas>` web component |

## Quick start

### Lit web component

```html
<agentable-canvas tenant="my-co" primary-color="#3B82F6" voice-enabled></agentable-canvas>
<script src="https://cdn.example.com/@mikehenken/agentable-canvas/v1/agentable-canvas.js"></script>
```

### Pure React

```tsx
import { CanvasShell } from '@mikehenken/agentable-canvas/react-canvas';
import '@mikehenken/agentable-canvas/styles.css';

export default function Page() {
  return <CanvasShell config={{ tenant: 'my-co' }} />;
}
```

### Whiteboard (tldraw host, e.g. landi-canvas-studio)

```tsx
import { LazyWhiteboardShell } from '@mikehenken/agentable-canvas/whiteboard';

<LazyWhiteboardShell config={{ tenant: 'my-co' }} tokenEndpoint="/api/mint-token" />
```

## Development

```bash
npm install
npm run dev          # Vite dev server
npm run lint
npm run typecheck
npm run test
npm run build
```

## Consumer pinning (git SHA)

Downstream apps (e.g. **landi-canvas-studio**) install via git ref:

```json
"@mikehenken/agentable-canvas": "github:mikehenken/agentable#<sha>"
```

After a release, bump the SHA. See [docs/setup/RELEASE.md](docs/setup/RELEASE.md).

## Embedding reference

- [EMBEDDING.md](EMBEDDING.md): theming, Shadow DOM, CDN layout
- [INSTALL.md](INSTALL.md): install paths
- [CHANGELOG.md](CHANGELOG.md): version history

## Architecture (summary)

Three surfaces ship from one package: `./whiteboard` (tldraw + `PanelShape`), `./react-canvas` (absolute-positioned workspace), and `./embed` (Lit shell). Tenant brand voice is injected by hosts, never baked into the OSS core.

Details: [docs/development/ARCHITECTURE.md](docs/development/ARCHITECTURE.md).

## License

MIT. See [LICENSE](LICENSE).

## Contributing

1. Branch from `main`, open PR into `main` ([branching guide](docs/setup/BRANCHING.md))
2. CI must pass (lint, typecheck, test)
3. Releases are manual via GitHub Actions ([release guide](docs/setup/RELEASE.md))

Issues and PRs: https://github.com/mikehenken/agentable
