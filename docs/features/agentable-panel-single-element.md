---
lrn: lrn::en:platform:agentable-canvas.feature.agentable-panel-single-element::doc
related_docs:
  - docs/features/perception-read-screenshot-canvas.md
  - docs/features/auto-mount-scan.md
  - docs/features/lazy-panel-hydration.md
  - docs/features/panel-framework-wrappers.md
  - landi-canvas-studio/docs/development/agentable-panels/02-PANEL_SYSTEM_SPEC.md
changelog:
  - date: 2026-07-21
    summary: lazy-hydrate attribute and doc link.
  - date: 2026-07-21
    summary: auto-mount scan doc link; slot-name wired to page slot registry.
---

# Single-panel embed element 

`<agentable-panel>` is the panel-only embed surface: one registered panel with framework chrome, shared page session, DataAdapter lifecycle, and HITL approval layer — without mounting tldraw or a full canvas.

## Usage

```html
<agentable-panel
  panel="open-positions"
  config-url="/config/sandals-career.json"
  primary-color="#0077B6"
  locale="en"
  slot-name="sidebar"
></agentable-panel>
<script type="module" src="/embed/agentable-panel.js"></script>
```

## Attributes

| Attribute | Role |
|-----------|------|
| `panel` | Required registered panel id (career pack ids: `open-positions`, `applications`, `growth-paths`, `resources`) |
| `config-url` | Tenant JSON config + adapter (same merge order as `<agentable-canvas>`) |
| `panel-data-url` | Legacy moss alias for adapter data URL |
| `panel-title` | Optional chrome title override (supports i18n catalog keys) |
| `hide-chrome` | Full-bleed body without title bar |
| `slot-name` | Named page-session slot for agent `open_panel` targeting (wired in ) |
| `lazy-hydrate` | Defer session join + React mount until visible; skeleton-first |
| `primary-color`, `locale`, … | Same branding/locale contract as other embed elements |

## Events (typed `AgentablePanelEventMap`)

| Event | When |
|-------|------|
| `agentable:config-reloaded` | After `reload` or config-url refresh |
| `agentable:panel-ready` | Panel definition resolved + host adapter ready |
| `agentable:adapter-loaded` | DataAdapter lifecycle online |
| `agentable:panel-error` | Unknown panel or adapter resolution failure |
| `agentable:chrome-changed` | Minimize close chrome |
| `agentable:approval-pending` | HITL card queued for this panel instance |
| `agentable:phase-changed` | `loading` → `ready` `error` `closed` |

All events use `bubbles: true` and `composed: true`.

## Shadow parts

Structural: `mount`, `surface`, `chrome`, `chrome-title`, `chrome-actions`, `body`, `skeleton`, `error`, `closed`.

## Module map

| Path | Role |
|------|------|
| `src/embed/agentable-panel.ts` | Lit custom element + event map |
| `src/embed/panel/PanelEmbedShell.tsx` | React shell (chrome, HITL, body) |
| `src/embed/panel/resolveEmbedPanelHost.ts` | Panel registry + adapter resolution |
| `src/embed/panel/panelOnlyEngine.ts` | Headless `createCanvasHost` engine (no canvas) |
| `src/embed/panel/EmbedPanelChrome.tsx` | Panel chrome (framework-owned) |
| `src/embed/panel/EmbedPanelBody.tsx` | Spec react panel body renderer |

## Published entry

- ESM: `agentable-canvas/embed/panel` → `dist/embed/agentable-panel.js`
- CSS: `agentable-canvas/embed/agentable-panel.css`

## Tests

- Vitest: `tests/unit/resolveEmbedPanelHost.test.ts`, `tests/unit/panelEmbedShell.test.tsx`
- Component + a11y: `tests/component/agentable-panel.test.ts`, `tests/component/a11y.test.ts`
