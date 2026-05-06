# Installing `agentable-canvas` in another project

Three install modes, pick the one that matches your host environment.

---

## Mode 1 — Script-tag embed (any HTML page)

The fastest path. Drop the built ESM bundle into your `<head>` and place
the custom element anywhere in the body. Works in vanilla HTML, WordPress,
Vue, Angular, plain SSR — anything that runs JavaScript in a browser.

### From a GitHub Release (recommended)

```html
<!-- Pin a release and load over jsDelivr's GitHub mirror -->
<script
  type="module"
  src="https://cdn.jsdelivr.net/gh/mikehenken/agentable@v0.0.1/dist/embed/agentable-canvas.js"
></script>

<agentable-canvas
  tenant="your-tenant"
  primary-color="#0D7377"
  welcome-message="Hi! How can I help?"
  style="width: 100%; height: 100vh; display: block;"
></agentable-canvas>
```

`jsdelivr.net/gh/<user>/<repo>@<tag>/<path>` resolves any file at any
git ref. Replace `v0.0.1` with whatever release tag you want to pin.

### Self-hosted

Download `dist/embed/agentable-canvas.js` from the
[Releases page](https://github.com/mikehenken/agentable/releases),
host it on your own CDN, and reference it the same way.

### UMD fallback (for environments without ES modules)

```html
<script src="https://cdn.jsdelivr.net/gh/mikehenken/agentable@v0.0.1/dist/embed/agentable-canvas.umd.js"></script>
```

Same custom-element API once loaded.

---

## Mode 2 — npm-style install from GitHub (React / Vite / Webpack hosts)

For React projects that want to import the canvas as a library and use
typed React components instead of the web-component wrapper.

```bash
# Pin to a tag (recommended)
npm install github:mikehenken/agentable#v0.0.1

# Or track main
npm install github:mikehenken/agentable
```

This installs the package as `agentable-canvas` (the `name` field in
`package.json`). Imports:

```tsx
// React shell — full canvas, all panels, brand-tokenable
import { CanvasShell } from 'agentable-canvas/react-canvas';
import 'agentable-canvas/styles.css';

export function MyPage() {
  return (
    <CanvasShell
      config={{
        tenant: 'acme',
        persona: {
          assistantName: 'Ada',
          tenantTitle: 'Acme Career Concierge',
          systemPrompt: 'You help Acme employees find growth paths…',
          voiceGreeting: 'Hi, I'm Ada — what are you working on today?',
          // For voice on a public deployment, mint ephemeral Gemini Live
          // tokens server-side and point the canvas at the endpoint.
          tokenEndpoint: 'https://your-token-worker.example.com',
        },
      }}
    />
  );
}
```

### Other entry points

```ts
import { CanvasShell }           from 'agentable-canvas/react-canvas';  // React-only host
import { AgentableCanvas }       from 'agentable-canvas/react';         // React wrapper around the Lit element
import 'agentable-canvas/embed';                                        // Side-effect: registers <agentable-canvas>
import 'agentable-canvas/embed/voice-call-button';                      // Side-effect: registers <voice-call-button>
import { hexToHsl }              from 'agentable-canvas/utils/hex-to-hsl';
```

### Vite consumers

If your host project also uses Vite, the source TSX exports
(`./react`, `./react-canvas`) work directly — your bundler compiles them.
No extra config needed.

### Webpack 5 consumers

You may need to add a TypeScript loader for the `node_modules/agentable-canvas/src/`
tree, or import only the prebuilt entry points:

```ts
import 'agentable-canvas/embed';   // Always pre-built
```

---

## Mode 3 — Git submodule (monorepo / vendored)

For organizations that want to fork or pin a specific commit and ship it
inside their monorepo:

```bash
git submodule add https://github.com/mikehenken/agentable.git vendor/agentable
cd vendor/agentable
npm install
npm run build:embed:all
```

Then import from `vendor/agentable/dist/embed/agentable-canvas.js`.

---

## What ships in the package

```
dist/
├── embed/
│   ├── agentable-canvas.js       # ESM, ~3.6MB (~894KB gz) — primary
│   ├── agentable-canvas.umd.js   # UMD, ~2.3MB (~696KB gz) — script-tag fallback
│   ├── voice-call-button.js      # ESM, ~38KB
│   ├── voice-call-button.umd.js  # UMD, ~31KB
│   └── *.map                     # source maps for all four
└── styles.css                    # Pre-built Tailwind for React-canvas consumers (~16KB gz)

src/                              # Source TSX/CSS for React-host consumers via the `./react*` exports
scripts/                          # Build + size-check scripts
*.config.{ts,js}                  # Vite + Tailwind + PostCSS configs
```

CSS for the web-component embed is **inlined into the JS bundle** — you
do not need to ship `styles.css` for `Mode 1` (script-tag) or for the
Lit-wrapper React import (`agentable-canvas/react`). You only need
`styles.css` if you import `CanvasShell` from `agentable-canvas/react-canvas`,
because that mode bypasses the Shadow DOM.

---

## Voice setup (production)

The bundled voice path uses Google Gemini Live. For development, set
`VITE_GEMINI_API_KEY` in your host project's `.env.local`. **Do not**
ship that key in a public client bundle — for production, mint
short-lived ephemeral tokens server-side and pass the endpoint via
`tokenEndpoint` (web-component attribute: `token-endpoint`).

The token endpoint must accept `POST /` and respond:

```json
{ "token": "auth_tokens/...", "expireTime": "2026-05-05T20:30:00Z" }
```

A reference Cloudflare Worker implementation lives in the companion
[moss-demo](https://github.com/mikehenken/moss-demo) repo at
`worker/src/index.js`.

---

## Verifying your install

```bash
# After `npm install`, the prepare script ensures dist/ exists.
ls node_modules/agentable-canvas/dist/embed/agentable-canvas.js
```

If the file is present, the install worked. If not, run:

```bash
cd node_modules/agentable-canvas
npm run build:embed:all
```

---

## Versioning + upgrading

Tags follow semver. `0.x` releases are pre-stable — minor bumps may
introduce breaking changes. Read [CHANGELOG.md](./CHANGELOG.md) before
upgrading.

To upgrade a github-installed package:

```bash
npm install github:mikehenken/agentable#v0.1.0
```
