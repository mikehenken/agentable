# Package exports reference

Verified against root `package.json` `exports` field. Import **only** published subpaths — never `src/` internals ( gallery rule).

## Core surfaces

| Subpath | Runtime | Notes |
|---------|---------|-------|
| `.` `./react` | React | Lit shell wrapper |
| `./react-canvas` | React | Legacy absolute-position workspace (frozen; whiteboard preferred) |
| `./whiteboard` `./engines/tldraw` | React + tldraw | Primary spatial substrate |
| `./embed` | Lit bundle | `<agentable-canvas>` |
| `./embed/panel` | Lit bundle | Single-panel element |
| `./embed/whiteboard` | Lit bundle | Whiteboard embed |

## Widget embeds

| Subpath | Element |
|---------|---------|
| `./embed/voice-call-button` | `<voice-call-button>` |
| `./embed/agentable-starter-chip` | `<agentable-starter-chip>` |
| `./embed/ask-about-this-button` | `<ask-about-this-button>` |
| `./embed/agent-status-pill` | `<agent-status-pill>` |

## Framework modules

| Subpath | Module |
|---------|--------|
| `./a2ui` | A2UI ingestion adapter |
| `./devtools` | Panel devtools + spec playground |
| `./i18n` | Locale layer |
| `./copilotkit-bridge` | Opt-in CopilotKit transport (quarantined) |
| `./orchestration` | Orchestration UI primitives |
| `./general` | Shared general components |

## Domain packs (fixtures)

| Subpath | Package |
|---------|---------|
| `./career-pack` | `@agentable/career-pack` |
| `./support-inbox-pack` | `@agentable/support-inbox-pack` |
| `./catalog-charts` | `@agentable/catalog-charts` add-on |

## Styles

| Subpath | Asset |
|---------|-------|
| `./styles.css` | Built Tailwind bundle |
| `./styles.source.css` | Source entry for host bundlers |
| `./embed/agentable-canvas.css` | Embed stylesheet |

## Install verification

```bash
npm install github:mikehenken/agentable#v0.3.0
ls node_modules/agentable-canvas/dist/embed/agentable-whiteboard.js
```

If embed artifacts missing: `npm run build:embed` inside the package.
