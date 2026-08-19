---
doc_type: guide
title: Whiteboard embed
description: Lit embed tags, verified attributes, build commands, and honest bundle budget disclosure for agentable-canvas.
created_at: "2026-07-21"
version: "1.0.0"
updated_at: "2026-07-21"
lrn: "lrn::en:platform:component:agentable-canvas:whiteboard-embed::doc"
entity_id: platform.component.agentable-canvas.whiteboard-embed
entity_type: guide
related_docs:
  - "development/ARCHITECTURE.md"
  - "ADOPTER_QUICKSTART.md"
  - "RELEASE.md"
changelog:
  - version: "1.0.0"
    date: "2026-07-21"
    type: "minor"
    author: "documentation-engineer"
    description: " whiteboard embed reference with verified attributes and bundle disclosure"
---

# Whiteboard embed

Use a Lit custom element when the host page is not React (WordPress, static HTML, CMS templates). Both embed tags mount `WhiteboardShell` (tldraw + `PanelShape` panels) inside Shadow DOM.

**Preferred tag:** `<agentable-whiteboard>` 
**Legacy tag:** `<agentable-canvas>` (same substrate after; kept for existing hosts)

## Build

From the `agentable-canvas` repo root:

```bash
npm install
npm run build:embed
```

Outputs under `dist/embed/`:

| File | Format |
|------|--------|
| `agentable-whiteboard.js` | ESM |
| `agentable-whiteboard.umd.js` | UMD |
| `agentable-whiteboard.css` | Extracted styles (also inlined into JS for Shadow DOM) |
| `agentable-canvas.js` | ESM (legacy tag bundle) |
| `agentable-canvas.umd.js` | UMD |
| `voice-call-button.js` | Standalone voice pill (optional) |

Full embed pipeline including size check:

```bash
npm run build:embed:all
```

`build:embed:all` runs `build:embed`, `build:styles`, `check:bundle`, and `check:embed-bindings`.

## Script-tag example

```html
<agentable-whiteboard
  tenant="demo"
  primary-color="#3B82F6"
  config-url="/config/demo.json"
  canvas-mode="bounded"
  canvas-bounds="1200x800"
  voice-enabled
  snap-grid
  token-endpoint="https://your-worker.example.com/mint"
  toolbar-config='{"tools":["select","draw","hand","layers","voice","auto-arrange","reset"],"layoutActionPlacement":"both"}'
  style="display:block;width:100%;min-height:600px;"
></agentable-whiteboard>

<script type="module" src="/embed/agentable-whiteboard.js"></script>
```

UMD fallback:

```html
<script src="/embed/agentable-whiteboard.umd.js"></script>
```

## Verified attributes

Attributes match `@property` declarations in `src/embed/agentable-whiteboard.ts` and `src/embed/agentable-canvas.ts`. Empty attribute means "not set" so `config-url` JSON can supply the value.

| Attribute | Type | Default (when set explicitly) | Purpose |
|-----------|------|-------------------------------|---------|
| `tenant` | string | `default` | Tenant brand id |
| `primary-color` | string | `#3B82F6` | Brand color; sets `--landi-color-primary` on host |
| `welcome-message` | string | `Hi! How can I help?` | Chat greeting |
| `api-endpoint` | string | `/api` | Backend API base |
| `voice-enabled` | boolean | `false` (opt-in) | Voice widget; set attribute or `voiceEnabled: true` in config JSON |
| `snap-grid` | boolean | `true` | 20px snap grid |
| `system-prompt` | string | `""` | Agent system prompt |
| `voice-greeting` | string | `""` | Voice session greeting |
| `voice-greeting-mode` | string | `""` | Greeting mode hint |
| `token-endpoint` | string | `""` | Server token mint URL (production voice) |
| `fullpage-on-engage` | boolean | `false` | Expand canvas on first engagement |
| `fullscreen-on-engage` | boolean | alias of `fullpage-on-engage` | Same behavior |
| `canvas-mode` | string | `infinite` | `infinite`, `bounded`, or `fixed` |
| `canvas-bounds` | string | `""` | Bounds for bounded mode (e.g. `1200x800`) |
| `canvas-behavior` | string | `""` | Camera behavior hint |
| `canvas-zoom` | string | `""` | Initial zoom hint |
| `host-header-height` | string | `""` | Reserve space for a fixed host header |
| `locale` | string | `en` | Session locale |
| `config-url` | string | `""` | JSON tenant config (panels, adapter, toolbar) |
| `panel-data-url` | string | `""` | Legacy moss panel-data JSON URL |
| `toolbar-config` | JSON string | `""` | Whiteboard toolbar whitelist and order (`agentable-whiteboard` only) |

### Config merge order

1. Built-in defaults (table above)
2. Document from `config-url` (and legacy `panel-data-url` data)
3. Explicit element attributes (win on conflict)

Call `element.reload` to re-fetch remote config. Listen for `agentable:config-reloaded` on the element.

### Imperative voice API

```javascript
const el = document.querySelector('agentable-whiteboard');
el.startVoiceCall;
el.endVoiceCall;
```

Events bubble with `composed: true` (e.g. `landi:message-sent`, `landi:panel-opened`). See root [README.md](../../README.md) for the event catalog.

## npm package imports

After `npm run build:embed`:

```javascript
import 'agentable-canvas/embed/whiteboard';
 registers <agentable-whiteboard>
```

Legacy:

```javascript
import 'agentable-canvas/embed';
 registers <agentable-canvas>
```

React wrapper (legacy tag, not whiteboard-specific props):

```tsx
import { AgentableCanvas } from 'agentable-canvas/react';
```

For full whiteboard control in React, import `WhiteboardShell` from `agentable-canvas/whiteboard` (see [ADOPTER_QUICKSTART.md](./ADOPTER_QUICKSTART.md)).

## Bundle budget (honest disclosure)

`scripts/check-bundle-size.mjs` (`npm run check:bundle`) enforces **gzipped** ceilings defined in that script:

| Artifact | Budget (gz) | Notes |
|----------|-------------|-------|
| `embed/agentable-canvas.js` | 950 KB | Legacy embed ESM |
| `embed/agentable-canvas.umd.js` | 750 KB | Legacy embed UMD |
| `embed/voice-call-button.js` | 40 KB | Lit-only |
| `embed/voice-call-button.umd.js` | 60 KB | Lit-only |
| `dist/styles.css` | 30 KB | React consumer stylesheet |

**Current reality (measured 2026-07-21 on a built tree):**

| Artifact | Measured (gz) | vs budget |
|----------|---------------|-----------|
| `embed/agentable-canvas.js` | ~3693 KB | ~3.9x over 950 KB budget |
| `embed/agentable-canvas.umd.js` | ~3294 KB | ~4.4x over 750 KB budget |
| `embed/agentable-whiteboard.js` | ~3057 KB | **not gated** (no row in `check:bundle` yet) |
| `embed/voice-call-button.js` | ~11 KB | within budget |

Whiteboard embed bundles ship React, ReactDOM, tldraw, Lit, and panel UI in one file because non-React hosts cannot externalize React. The 950 KB gate predates the whiteboard-only bundle and currently fails on the legacy `agentable-canvas.js` artifact. Treat `check:bundle` as an informational drift alarm until budgets are recalibrated or code-splitting lands (see comment in `scripts/check-bundle-size.mjs`).

**Operational guidance:**

- Expect multi-MB first load for full whiteboard embeds; cache aggressively on CDN
- Use `LazyWhiteboardShell` in React hosts to defer tldraw until route navigation
- `voice-call-button` remains suitable for a lightweight voice-only pill

## CDN studio copy path

landi-canvas-studio copies built embed files to `public/embed/` via `npm run copy-embed-assets` for first-party hosting at `canvas.landi.build/embed/*`. See landi-canvas-studio `docs/features/canvas/embed-cdn.md`.

## Related

- [ARCHITECTURE.md](../development/ARCHITECTURE.md)
- [INSTALL.md](../../INSTALL.md)
- [EMBEDDING.md](../../EMBEDDING.md) (root-level; some paths predate )
