# Package exports reference

Verified against root `package.json` `exports` (`@mikehenken/agentable-canvas@0.4.0`). Import **only** published subpaths with the scoped prefix. Never import `src/` internals from a host app.

Install:

```bash
npm install @mikehenken/agentable-canvas
```

## Published subpaths (complete map)

| Subpath | Target | Runtime | Notes |
|---------|--------|---------|-------|
| `.` | `./src/react/index.tsx` | React | Same as `./react` |
| `./react` | `./src/react/index.tsx` | React | Lit shell wrapper |
| `./react-canvas` | `./src/react-canvas/index.tsx` | React | Legacy absolute-position workspace (frozen; whiteboard preferred) |
| `./whiteboard` | `./src/engines/tldraw/index.tsx` | React + tldraw | Primary spatial substrate |
| `./copilotkit-bridge` | `./src/canvas/protocol/copilotkit-bridge.tsx` | React | Opt-in CopilotKit transport (quarantined) |
| `./i18n` | `./src/i18n/index.ts` | TS | Locale layer |
| `./general` | `./src/components/general/index.ts` | React | Shared general components |
| `./ui-ai` | `./src/components/ui-ai/index.ts` | React | AI UI primitives |
| `./utils/hex-to-hsl` | `./src/embed/utils/hexToHsl.ts` | TS | Color helper for embed theming |
| `./styles.css` | `./dist/styles.css` | CSS | Built Tailwind bundle (`npm run build:styles`) |
| `./styles.source.css` | `./src/index.css` | CSS source | For hosts that run Tailwind over canvas paths |
| `./embed` | `./dist/embed/agentable-canvas.js` | Lit bundle | `<agentable-canvas>` (alias of `./embed/canvas`) |
| `./embed/canvas` | `./dist/embed/agentable-canvas.js` | Lit bundle | Same artifact as `./embed` |
| `./embed/voice-call-button` | `./dist/embed/voice-call-button.js` | Lit widget | `<voice-call-button>` |
| `./embed/agentable-canvas.css` | `./dist/embed/agentable-canvas.css` | CSS | Stylesheet for full canvas embed |
| `./package.json` | `./package.json` | JSON | Package manifest (version, exports introspection) |

Example imports (always scoped):

```ts
import { LazyWhiteboardShell } from '@mikehenken/agentable-canvas/whiteboard';
import '@mikehenken/agentable-canvas/styles.css';
```

Embed script tags load prebuilt files from `dist/embed/` after `npm run build:embed` or `npm run build:embed:site` inside the package.

## Not published (in-repo only)

These subpaths appeared in older docs but are **not** in `package.json` `exports`. Use the real consumption path instead.

| Former subpath | Real consumption path |
|----------------|----------------------|
| `./engines/tldraw` | `@mikehenken/agentable-canvas/whiteboard` (source: `src/engines/tldraw/`) |
| `./embed/panel` | Prebuilt `/embed/agentable-panel.js` (`vite.embed-panel.config.ts`; gallery examples 02, 03, 04, 10) |
| `./embed/whiteboard` | Prebuilt `/embed/agentable-whiteboard.js` (`vite.embed-whiteboard.config.ts`; examples 12, 13, p8) |
| `./embed/app-shell` | Prebuilt `/embed/agentable-app-shell.js` (`vite.embed-app-shell.config.ts`; example 11) |
| `./embed/agentable-starter-chip` | Prebuilt `/embed/agentable-starter-chip.js` (`vite.embed-starter-chip.config.ts`) |
| `./embed/ask-about-this-button` | Prebuilt `/embed/ask-about-this-button.js` (`vite.embed-ask-about.config.ts`) |
| `./embed/agent-status-pill` | Prebuilt `/embed/agent-status-pill.js` (`vite.embed-agent-status.config.ts`) |
| `./a2ui` | Unpublished; source at `src/a2ui/` (ingest adapter, no export subpath) |
| `./devtools` | Unpublished; source at `src/devtools/` (spec inspector + playground) |
| `./orchestration` | Removed in Wave 5 (orchestration UI moved out of this package) |
| `./career-pack` | Private workspace package `@agentable/career-pack` (`packages/career-pack/`) |
| `./support-inbox-pack` | Private workspace package `@agentable/support-inbox-pack` (`packages/support-inbox-pack/`) |
| `./catalog-charts` | Private workspace package `@agentable/catalog-charts` (`packages/catalog-charts/`) |

### Gallery and harness resolution

Gallery examples do **not** exercise `package.json` `exports`. They load prebuilt embed bundles:

```html
<script type="module" src="/embed/career-whiteboard.js"></script>
```

React example 06 uses a harness-only Vite alias in `vite.gallery-harnesses.config.ts` (line 15) pointing at `src/react/AgentablePanel.tsx`, not a published subpath.

## Install verification

```bash
npm install @mikehenken/agentable-canvas
ls node_modules/@mikehenken/agentable-canvas/dist/embed/agentable-canvas.js
```

If embed artifacts are missing, run `npm run build:embed` (canvas + voice button) or `npm run build:embed:site` (full gallery set) inside the installed package.

## Related

- [embed-builds.md](embed-builds.md): chunked ESM policy, bundle budgets, boundary guards
- [workflows/adopt-embed.md](workflows/adopt-embed.md): minimal host integration path
