---
lrn: lrn::en:platform:agentable-canvas.feature.iframe-oembed-fallback::doc
related_docs:
  - docs/features/agentable-panel-single-element.md
  - docs/features/auto-mount-scan.md
  - landi-canvas-studio/docs/development/agentable-panels/02-PANEL_SYSTEM_SPEC.md
changelog:
  - date: 2026-07-21
    summary: iframe + oEmbed fallback — sandboxed host page, postMessage bridge, oEmbed discovery.
---

# iframe + oEmbed fallback 

Script-stripping CMS hosts cannot run the agentable embed script. They embed a **sandboxed iframe** that loads our hosted panel surface and communicate over a **typed postMessage bridge**.

## CMS oEmbed flow

1. Host page declares oEmbed discovery:

```html
<link
  rel="alternate"
  type="application/json+oembed"
  href="https://embed.example.com/oembed?url=https%3A%2F%2Fembed.example.com%2Fembed%2Fiframe-host.html%3Fsurface%3Dpanel%26panel%3Dopen-positions&format=json"
/>
```

2. CMS fetches oEmbed JSON and renders the returned `html` snippet (sandboxed iframe, no parent scripts).

3. Parent and iframe exchange **only** whitelisted bridge messages (`handshake`, `ping`, `resize`, `event`, `session`, `error`). Parent cannot inject or execute scripts inside the iframe.

## Iframe host URL

```
/embed/iframe-host.html?surface=panel&panel=open-positions&config-url=/config/sandals-career.json&parent-origin=https://cms.example.com
```

| Query param | Role |
|-------------|------|
| `surface` | `panel`; `canvas` `widget` reserved |
| `panel` | Registered panel id |
| `config-url` | Tenant config URL |
| `parent-origin` | Allowlisted parent origin for postMessage (comma-separated ok) |
| `bridge-id` | Optional stable bridge id |

Sandbox token set: `allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox` — **no** `allow-same-origin`.

## JS-capable parent wrapper

Hosts that can run JS but want iframe isolation:

```html
<agentable-iframe-embed
  panel="open-positions"
  embed-base-url="https://embed.example.com"
  config-url="/config/sandals-career.json"
  width="640"
  height="480"
></agentable-iframe-embed>
<script type="module">
  import 'agentable-canvas/embed/iframe-oembed';
</script>
```

Events: `agentable:iframe-ready`, `agentable:iframe-event`, `agentable:iframe-session`, `agentable:iframe-error`.

## Module map

| Path | Role |
|------|------|
| `src/embed/iframe/embedBridgeProtocol.ts` | Typed bridge envelope + sandbox constants |
| `src/embed/iframe/originValidation.ts` | Parent origin allowlist |
| `src/embed/iframe/iframeChildBridge.ts` | Child-side bridge (inside iframe) |
| `src/embed/iframe/iframeParentBridge.ts` | Parent-side bridge |
| `src/embed/iframe/iframeHostBootstrap.ts` | Host page bootstrap + panel mount |
| `src/embed/oembed/oEmbedDiscovery.ts` | oEmbed link + response builders |
| `src/embed/agentable-iframe-embed.ts` | Lit parent wrapper |
| `dist/embed/iframe-host.html` | Published sandboxed host page |

## Published artifacts

- Library: `agentable-canvas/embed/iframe-oembed`
- Host page: `agentable-canvas/embed/iframe-host.html` → `dist/embed/iframe-host.html`

## Tests

- Unit: `embedBridgeProtocol.test.ts`, `originValidation.test.ts`, `oEmbedDiscovery.test.ts`, `iframePostMessageBridge.test.ts`
- Integration: `iframeOEmbedFallback.test.ts`

Build: `npm run build:embed:iframe-host`
