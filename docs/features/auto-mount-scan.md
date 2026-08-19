---
lrn: lrn::en:platform:agentable-canvas.feature.auto-mount-scan::doc
related_docs:
  - docs/features/agentable-panel-single-element.md
  - docs/features/lazy-panel-hydration.md
  - landi-canvas-studio/docs/development/agentable-panels/02-PANEL_SYSTEM_SPEC.md
changelog:
  - date: 2026-07-21
    summary: lazy-hydrate placeholder attribute and deferred mount behavior.
  - date: 2026-07-21
    summary: auto-mount scan — data-attribute placeholders, named slots, shared page session.
---

# Auto-mount scan 

Marketing hosts declare panel surfaces with data attributes; the embed script scans the DOM and mounts `<agentable-panel>` elements into the shared page session — **one script tag, zero authored JS**.

## Zero-JS host markup

```html
<div
  data-agentable-panel="open-positions"
  data-config-url="/config/sandals-career.json"
  data-primary-color="#0077B6"
></div>

<aside data-agentable-slot="sidebar"></aside>

<script type="module" src="/embed/agentable-panel.js"></script>
```

On load, `agentable-panel-bootstrap.ts` registers the custom element and runs `bootstrapAutoMountScan`.

## Placeholder contract

| Attribute | Role |
|-----------|------|
| `data-agentable-panel` | Marker; value may be the panel id when `data-panel` is omitted |
| `data-panel` | Registered panel id (preferred) |
| `data-config-url` | Tenant config URL (same merge as `<agentable-panel>`) |
| `data-panel-data-url` | Legacy adapter data URL |
| `data-slot-name` | Named slot id for `open_panel` targeting |
| `data-primary-color`, `data-locale`, … | Branding/locale passthrough |
| `data-lazy-hydrate` | Skeleton-first placeholder; mount `<agentable-panel>` on intersection |

After mount, the placeholder receives `data-agentable-mounted=""` and contains a child `<agentable-panel>`. Lazy placeholders use `data-agentable-lazy-pending=""` until visible.

## Named slots

Hosts declare regions with `data-agentable-slot="sidebar"`. The scan registers each region in the window-scoped slot registry (`ensurePageSlotRegistry`). Agent `open_panel` accepts a `slot` argument and mounts into the registered element via `PanelOnlyEngine`.

`<agentable-panel slot-name="sidebar">` also registers itself as the slot target for agent placement updates.

## Shared page session

Every mounted panel calls `ensurePageSession.join` in `firstUpdated`, so auto-mounted surfaces share one agent context with voice, canvas, and other embeds on the page.

## Module map

| Path | Role |
|------|------|
| `src/embed/agentable-panel-bootstrap.ts` | Published embed entry — element + auto-scan |
| `src/embed/autoMountScan.ts` | Scan + MutationObserver lifecycle |
| `src/embed/mountAgentablePanel.ts` | Placeholder → `<agentable-panel>` mapping |
| `src/session/pageSlots.ts` | Named slot registry + `open_panel` mount |
| `src/embed/panel/panelOnlyEngine.ts` | Routes slot placement to page slots |

## Tests

- Unit: `tests/unit/autoMountScan.test.ts`, `tests/unit/pageSlots.test.ts`
- Integration: `tests/integration/autoMountScanLifecycle.test.ts`

## Published entry

Same bundle as: `agentable-canvas/embed/panel` → `dist/embed/agentable-panel.js` (bootstrap entry).
