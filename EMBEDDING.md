Embedding the Agentable Canvas

Quick Start (CDN)

Add the script tag to any HTML page:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Site</title>
</head>
<body>
  <!-- Your page content -->
  
  <h1>Ready to explore your future?</h1>
  
  <!-- The canvas embeds here -->
  <agentable-canvas 
    tenant="acme"
    primary-color="#3B82F6"
    welcome-message="Hi! How can I help?"
  ></agentable-canvas>

  <script src="https://cdn.jsdelivr.net/npm/agentable-canvas@latest/dist/embed/agentable-canvas.js"></script>
</body>
</html>
```

React / npm

```bash
npm install agentable-canvas
```

```jsx
import { AgentableCanvas } from 'agentable-canvas/react';

function App() {
  return (
    <div>
      <h1>Ready to explore your future?</h1>
      <AgentableCanvas 
        tenant="acme"
        primaryColor="#3B82F6"
      />
    </div>
  );
}
```

Configuration

All via `data-*` attributes on the webcomponent:

Attribute	Type	Default	Description	
`tenant`	string	`"default"`	Brand/tenant name	
`primary-color`	string	`"#0D7377"`	Brand color	
`welcome-message`	string	`"Hi! I'm your Career Concierge."`	Initial greeting	
`api-endpoint`	string	`"/api"`	Backend API URL	
`voice-enabled`	boolean	`true`	Show voice widget	
`snap-grid`	boolean	`true`	Snap to grid	

Events (from canvas to parent page)

```javascript
document.querySelector('agentable-canvas').addEventListener('landi:message-sent', (e) => {
  console.log('User sent:', e.detail.text);
});

document.querySelector('agentable-canvas').addEventListener('landi:panel-opened', (e) => {
  console.log('Panel opened:', e.detail.panelId);
});

document.querySelector('agentable-canvas').addEventListener('landi:file-uploaded', (e) => {
  console.log('File uploaded:', e.detail.filename);
});
```

Trigger Voice Programmatically

```javascript
const canvas = document.querySelector('agentable-canvas');

// Start a voice conversation
canvas.startVoiceCall();

// End voice conversation
canvas.endVoiceCall();
```

Build from Source (for development)

```bash
git clone https://github.com/landi/canvas.git
cd canvas
npm install
npm run build
# Output: dist/agentable-canvas.js
```

Lit Wrapper (internal)

The thin Lit wrapper at `packages/landi-web/`:

```typescript
import { LitElement, html } from 'lit';

@customElement('agentable-canvas')
export class AgentableCanvasElement extends LitElement {
  @property() tenant = 'default';
  @property() primaryColor = '#0D7377';

  createRenderRoot() {
    return this; // Render into light DOM
  }

  connectedCallback() {
    super.connectedCallback();
    // Mount React app inside shadow DOM
    const mountPoint = document.createElement('div');
    mountPoint.style.width = '100%';
    mountPoint.style.height = '100%';
    this.appendChild(mountPoint);
    
    import('@landi/canvas/react').then(({ mount }) => {
      mount(mountPoint, {
        tenant: this.tenant,
        primaryColor: this.primaryColor,
      });
    });
  }
}
```

Local Development

```bash
# Start dev server
npm run dev
# Opens at http://localhost:5173

# Run tests
npm test

# Build for production
npm run build
```

Project Structure

```
agentable-canvas/
  src/
    canvas/
      CanvasShell.tsx      # Root layout (pannable bg + fixed UI)
      DraggablePanel.tsx   # Drag/resize/minimize/close primitive
      TopBar.tsx           # Logo + actions (floating)
      FloatingToolbar.tsx  # 5-tool center toolbar
      NavSidebar.tsx       # Collapsible nav (default collapsed)
      ChatPanel.tsx        # Chat widget
      ArtifactsPanel.tsx   # File uploads & generated artifacts
      GrowthPathsPanel.tsx # Career trajectory examples
      VoiceWidget.tsx      # Voice conversation (manual start)
      JourneyPanel.tsx     # Progress bar + next steps
      SettingsPanel.tsx    # 4-section settings with toggles
      BottomBar.tsx        # Download, About, Help, Docs
    stores/
      layoutStore.ts       # Zustand: all panel state
    types/
      index.ts             # PanelLayout, PanelId, Message types
  public/
  index.html
  vite.config.ts
  tailwind.config.js
```

Key Files

File	Purpose	
`src/stores/layoutStore.ts`	All panel state — positions, visibility, sizes	
`src/canvas/CanvasShell.tsx`	Root layout — infinite background + panning	
`src/canvas/DraggablePanel.tsx`	Drag handles, resize, minimize, close	
`src/types/index.ts`	TypeScript interfaces

---

## Theming

The canvas exposes brand-relevant CSS custom properties on `:root, :host` (both selectors so tokens resolve in light DOM AND inside the Lit Shadow Root). Override any of them on the host page to retheme the entire canvas without forking.

### Full token reference

Two forms exist for brand colors: a **solid hex** (legacy + non-Tailwind consumers) AND **HSL components** (`H S% L%` triplet, no `hsl(...)` wrapper). The HSL form is what Tailwind's `<alpha-value>` placeholder needs so utilities like `bg-canvas-primary/30` compose alpha against tenant-overridden brand. When you override `primary-color="#FF0000"` via the embed attribute, the runtime auto-syncs both forms via `hexToHslComponents` (M2.5/M2.6). When you override via raw CSS (recommended for stability), set BOTH forms together.

```css
agentable-canvas, .agentable-canvas-root {
  /* --- Brand (alpha-aware via HSL companion) --- */
  --landi-color-primary: #0D7377;          /* Buttons, focus rings, links, listening visualizer */
  --landi-color-primary-hsl: 182 80% 26%;  /* HSL companion — ENABLES `bg-canvas-primary/30` etc. */
  --landi-color-primary-hover: #095C5F;    /* Primary hover state */
  --landi-color-primary-hover-hsl: 182 83% 20%;
  --landi-color-primary-light: #14B8A6;    /* Lighter teal — gradient mid-stops, hover halos */
  --landi-color-primary-light-hsl: 173 80% 40%;
  --landi-color-primary-soft: #2DD4BF;     /* Mint highlight — gradient end-stops, glow tips */
  --landi-color-primary-soft-hsl: 172 66% 50%;
  --landi-color-primary-tint: #E6F4F1;     /* Pale teal — pill/chip backgrounds when active */
  --landi-color-primary-tint-hsl: 169 39% 92%;
  --landi-color-accent: #C9A227;           /* "Speaking" visualizer, highlights */
  --landi-color-accent-hsl: 45 70% 47%;

  /* --- Surfaces --- */
  --landi-color-surface: #FFFFFF;          /* Panel surfaces (chat, artifacts) */
  --landi-color-surface-subtle: #F7F9F9;   /* Cooler-than-white panels — assistant-msg, hover */
  --landi-color-background: #F0F0EC;       /* Page background SURROUNDING the canvas */
  --landi-color-workspace-bg: #F5F5F2;     /* Canvas working surface (under the dot grid) */
  --landi-color-workspace-dot: #D0D0CC;    /* Dot-grid color */
  --landi-color-border: #E5E5E5;           /* Panel borders, dividers, separators, toggle off-state */

  /* --- Text --- */
  --landi-color-text: #1A1A1A;             /* Primary text (headlines, body) */
  --landi-color-text-secondary: #4B5563;   /* Sub-headlines, supporting copy (WCAG AA 7.6:1) */
  --landi-color-text-muted: #9CA3AF;       /* Labels, timestamps, hints */

  /* --- Status --- */
  --landi-color-success: #10B981;          /* Success toasts, valid states */
  --landi-color-warning: #F59E0B;          /* Caution states */
  --landi-color-error: #EF4444;            /* Error text, error visualizer, destructive actions */
}
```

**Override pattern note:** The runtime `primary-color` attribute on `<agentable-canvas>` ONLY syncs `--landi-color-primary` + `--landi-color-primary-hsl` — sibling shades (`-hover`, `-light`, `-soft`, `-tint`, `-accent`) must be set individually via CSS for full tenant theming. Algorithmic shade derivation tracked for M3.

### Brand-tinted elevation tokens (`--canvas-elev-*`)

Box-shadows that need to retone with the brand color use a separate token namespace — `--canvas-elev-*` for primary-brand-tinted shadows, distinct from `--canvas-tone-*-glow` (per-department-tone glows; see next section). The split is intentional: brand-elevation cascades from `--landi-color-primary-hsl` and follows the agency's primary brand; tone-glow cascades from a separate semantic-accent palette and is independent of brand.

Three override altitudes, most → least granular:

```css
agentable-canvas, .agentable-canvas-root {
  /* Altitude 1 — replace the whole shadow string per intensity tier
     (offset, blur, spread, color all under your control). */
  --canvas-elev-primary-soft:    0 6px 20px rgba(0, 0, 0, 0.08);
  --canvas-elev-primary-rich:    0 10px 30px rgba(0, 0, 0, 0.12);
  --canvas-elev-primary-active:  0 10px 30px rgba(0, 0, 0, 0.18);
  --canvas-elev-primary-intense: 0 6px 20px rgba(0, 0, 0, 0.35);

  /* Altitude 2 — keep the geometry + brand HSL, retone the alpha only.
     Default values match the intensity-name semantics. */
  --canvas-elev-alpha-soft: 0.08;     /* hover-tint, light cards */
  --canvas-elev-alpha-rich: 0.12;     /* featured-card hover */
  --canvas-elev-alpha-active: 0.18;   /* selected/active state */
  --canvas-elev-alpha-intense: 0.35;  /* avatar, hero accent */

  /* Altitude 3 — keep geometry + alphas, swap the brand hue only.
     Cascades to all four primary-tinted elevations at once. */
  --landi-color-primary-hsl: 182 80% 26%;
}
```

Tailwind utility classes wired to these tokens:
- `shadow-canvas-primary-soft` / `hover:shadow-canvas-primary-soft`
- `shadow-canvas-primary-rich` / `hover:shadow-canvas-primary-rich`
- `shadow-canvas-primary-active`
- `shadow-canvas-primary-intense`

### Department-tone tokens (`--canvas-tone-*`)

For multi-department palettes (Culinary amber, Spa indigo, Recreation emerald, etc.), the canvas exposes per-tone gradient stops + glows. These cascade independently of brand primary, so swapping `--landi-color-primary-hsl` does NOT change the tone palette — the two are separate concerns.

```css
agentable-canvas, .agentable-canvas-root {
  /* Per-tone gradient stops (135deg, from → to) */
  --canvas-tone-teal-from: #0D7377;     --canvas-tone-teal-to: #14B8A6;
  --canvas-tone-amber-from: #D97706;    --canvas-tone-amber-to: #F59E0B;
  --canvas-tone-indigo-from: #4F46E5;   --canvas-tone-indigo-to: #6366F1;
  --canvas-tone-rose-from: #E11D48;     --canvas-tone-rose-to: #F43F5E;
  --canvas-tone-emerald-from: #059669;  --canvas-tone-emerald-to: #10B981;
  --canvas-tone-violet-from: #7C3AED;   --canvas-tone-violet-to: #A855F7;
  --canvas-tone-slate-from: #6B7280;    --canvas-tone-slate-to: #9CA3AF;

  /* Per-tone glow box-shadow (full string — replace if you need
     different geometry). Defaults at 12px y-offset, 32px blur,
     alpha tuned per-hue (0.18-0.22) to balance perceived weight. */
  --canvas-tone-teal-glow:    0 12px 32px rgba(20, 184, 166, 0.22);
  --canvas-tone-amber-glow:   0 12px 32px rgba(245, 158, 11, 0.22);
  --canvas-tone-indigo-glow:  0 12px 32px rgba(99, 102, 241, 0.22);
  --canvas-tone-rose-glow:    0 12px 32px rgba(244, 63, 94, 0.20);
  --canvas-tone-emerald-glow: 0 12px 32px rgba(16, 185, 129, 0.20);
  --canvas-tone-violet-glow:  0 12px 32px rgba(168, 85, 247, 0.22);
  --canvas-tone-slate-glow:   0 12px 32px rgba(107, 114, 128, 0.18);
}
```

Consumed via the `TONE_GRADIENT` and `TONE_GLOW` maps in `src/canvas/toneTokens.ts`. To inject your own palette without forking, set the `-from` / `-to` and `-glow` variables for whichever tones your panels reference.

### Token namespace contract

Three distinct token namespaces, each with its own altitude of override:

| Namespace | Purpose | Cascade source |
|---|---|---|
| `--landi-color-*` (+ `-hsl` companions) | Brand colors (primary / accent / surfaces / text / borders / status). The "color" tier. | Tenant override — all elevation/tone tokens that reference brand HSL recompose. |
| `--canvas-elev-*` (+ `-alpha-*` companions) | Brand-primary box-shadows (4 intensity tiers). The "elevation" tier. | Cascades from `--landi-color-primary-hsl`. Set elev or alpha tokens to override per-tier. |
| `--canvas-tone-*` (`-from`/`-to`/`-glow`) | Per-department tone palette (gradients + glows for multi-tone panels). The "semantic accent" tier. | Independent of brand primary — set per-tone. Adding a new tone is one row in `toneTokens.ts` + 3 new CSS variables. |

When in doubt: brand → `--landi-color-*`; brand-tinted shadow → `--canvas-elev-*`; semantic-accent palette → `--canvas-tone-*`.

### Brand override example

```css
/* Tenant overrides via the standard token cascade — no fork required. */
agentable-canvas[tenant="acme"] {
  --landi-color-primary: #0D7377;          /* Brand teal */
  --landi-color-accent: #C9A227;           /* Brand accent */
  --landi-color-workspace-bg: #F5F5F2;     /* Default; matches existing brand */
}
```

### A different agency (light theme — works today)

```css
/* Acme Corp — purple primary, orange accent, light workspace */
agentable-canvas[tenant="acme"] {
  --landi-color-primary: #7C3AED;
  --landi-color-primary-hsl: 262 83% 58%;
  --landi-color-primary-hover: #6D28D9;
  --landi-color-primary-hover-hsl: 263 69% 50%;
  --landi-color-accent: #F97316;
  --landi-color-accent-hsl: 25 95% 53%;
  --landi-color-workspace-bg: #FAF5FF;
  --landi-color-workspace-dot: #E9D5FF;
}
```

Set BOTH the hex and HSL forms together — the hex powers solid `bg-canvas-primary`, the HSL powers alpha-modified `bg-canvas-primary/30`, `border-canvas-primary/10`, etc. **Don't eyeball HSL** — a wrong-by-10-lightness companion silently makes alpha-modified shades look darker than solid ones, the exact split-brand bug the dual-form contract exists to prevent. Derive from the hex either in code via the bundled helper (`import { hexToHslComponents } from 'agentable-canvas/utils/hex-to-hsl'`) or via any reliable hex→HSL converter.

> **Dark-theme groundwork — usable, with caveats.** As of Track F.7.2 (2026-04-25), 241 Tailwind grayscale utility sites across 15 panel files have been migrated to consume the canvas's `--landi-color-text*` / `--landi-color-surface*` / `--landi-color-border` tokens. Setting `--landi-color-text: #F9FAFB` + `--landi-color-surface: #111827` etc. now correctly inverts the canvas chrome AND the panel internals.
>
> Caveats that remain:
> - **Role palettes** (`bg-blue-50`, `text-amber-700`, etc. on application-status badges, growth-path icons, etc.) are NOT tokenized — they retain the light Tailwind palette regardless of theme. Tracked for a future "role-palette token" decision.
> - **A small number of `bg-gray-100`/`gray-100` decorative usages** at low-contrast positions (e.g. one current site in `GrowthPathsPanel.tsx`) intentionally untouched — they're not load-bearing for theme coherence and tokenizing them at the cost of an extra "subtle decorative" alias adds more API surface than it's worth.
> - **Status colors** (`--landi-color-success/warning/error`) need separate dark-mode-friendly defaults if used on dark surfaces.
> - **Visual regression** has not been captured against a dark fixture; embedders shipping dark themes should run a Playwright `toHaveScreenshot()` baseline against their token set before launching.

### Importing the pre-built stylesheet (React-canvas mode)

```ts
// React 19 host using <CanvasShell> from agentable-canvas/react-canvas
import 'agentable-canvas/styles.css';
```

This ships the full Tailwind base (~16 KB gzipped) plus the canvas tokens defined above. Source available at `agentable-canvas/styles.source.css` for advanced consumers who want to run their own Tailwind compilation against the canvas source.

### Tenant labels (UI copy)

Independent of brand tokens, the canvas accepts a `labels` config object so embedders can swap action-button copy (e.g. "Share" → "Send to recruiter") without forking:

```tsx
import { CanvasShell } from 'agentable-canvas/react-canvas';

<CanvasShell
  config={{
    tenant: 'acme',
    persona: { /* ... */ },
    labels: {
      shareArtifact: 'Send to recruiter',
      sendMessage: 'Send to assistant',
      emptyArtifacts: 'No documents yet',
      emptyArtifactsHint: 'Documents you upload or the assistant generates will appear here.',
    },
  }}
/>
```

Defaults are sensible OSS-neutral strings ("Share", "Send message", "No artifacts yet", etc.) so the canvas works zero-config.
