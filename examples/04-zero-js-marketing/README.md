# 04 — Zero-JS marketing

 gallery example: **full Archipelago Resorts careers landing page** with **one embed script tag** and `data-agentable-panel` auto-mount. No React host, no hand-written panel mount code.

## What this demonstrates

- Luxury hospitality careers marketing page (hero, resorts, mission, growth, ACU, roles, publications, testimonials, footer)
- Open Positions panel band via `data-agentable-panel="open-positions"` + shared Archipelago fixture config
- Vanilla HTML/CSS with light `main.js` for nav, scroll progress, carousels, and filters only
- `window.__galleryReady` assertions for ≥8 fixture job titles, search + filter chips, and `career-light` theme (not gallery-dark)

## Files

| File | Purpose |
|------|---------|
| `index.html` | Semantic landing sections (`#hero` … `#agent`) |
| `styles.css` | Dark shell `#0a0a0a`, teal `#0E7490`, serif headlines, full-bleed photography |
| `main.js` | Scroll progress, nav state, mobile menu, section observer, carousels |
| `assets/` | Archipelago Resorts photography (Gemini-regenerated; no Sandals trademarks) |
| `scripts/regen-archipelago-marketing-images.mjs` | Gemini image regen tooling + prompt catalog |

## Image regeneration

Marketing photography is regenerated as **Archipelago Resorts** (fictional) so gallery example 04 never ships Sandals/Beaches/Moss trademarks.

**Model note (verified 2026-07-25):** owner-requested `gemini-3.1-pro-image-preview` **404s** on Gemini Developer API `v1beta`. The script defaults to GA **`gemini-3-pro-image`** (Nano Banana Pro) with fallback **`gemini-3.1-flash-image`**. Pass `--model=gemini-3.1-pro-image-preview` to retry when Google publishes that id.

```bash
# From agentable-canvas repo root — print inventory + prompts only
node examples/04-zero-js-marketing/scripts/regen-archipelago-marketing-images.mjs --dry-run

# Generate missing outputs (skips files that already exist)
node examples/04-zero-js-marketing/scripts/regen-archipelago-marketing-images.mjs

# Overwrite everything
node examples/04-zero-js-marketing/scripts/regen-archipelago-marketing-images.mjs --force

# Single asset subset
node examples/04-zero-js-marketing/scripts/regen-archipelago-marketing-images.mjs --only=hero-team-collage,team-maya --force

# Audit HTML/JS srcs vs assets on disk
node examples/04-zero-js-marketing/scripts/check-asset-refs.mjs
```

Requires `@google/genai` (and optionally `sharp` for PNG→JPEG). API key: `GEMINI_API_KEY` (or `GOOGLE_API_KEY` `VITE_GEMINI_API_KEY`) in the environment or a nearby `.env.local`. Never commit secrets.

Outputs + mapping:

| Path | Purpose |
|------|---------|
| `assets/` | Generated photography partner marks |
| `scripts/archipelago-image-manifest.json` | Source → output inventory + status |
| `scripts/archipelago-image-prompts.json` | Full prompt catalog per asset |

## Panel embed contract

```html
<div
  data-agentable-panel="open-positions"
  data-config-url="/examples/shared/archipelago-panel-config.json"
  data-primary-color="#0E7490"
  data-tenant="archipelago-resorts"
></div>
<script type="module" src="/embed/agentable-panel.js"></script>
```

Exactly **one** panel embed script. No `/embed/agentable-panel.css` link (styles ship inside the module bundle).

## Walk URL

```
http://127.0.0.1:5199/examples/04-zero-js-marketing/index.html
```

## Build embed (if panel bundle stale)

```bash
npm run build:embed:panel
```

## Run e2e

```bash
npm run test:e2e -- tests/e2e/gallery.spec.ts -g "04-zero-js-marketing"
```

## GATE 7 artifacts

`landi-labs/studies/Orchestration/agentable-panels/logs/retroactive-ui-coverage/04-zero-js-marketing`
