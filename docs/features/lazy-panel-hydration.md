---
lrn: lrn::en:platform:agentable-canvas.feature.lazy-panel-hydration::doc
related_docs:
  - docs/features/agentable-panel-single-element.md
  - docs/features/auto-mount-scan.md
  - landi-canvas-studio/docs/development/agentable-panels/02-PANEL_SYSTEM_SPEC.md
changelog:
  - date: 2026-07-21
    summary: lazy hydration — IntersectionObserver activation, skeleton-first UI, auto-mount integration.
---

# Lazy panel hydration 

Panel embed surfaces can defer expensive work (page-session join, config fetch, React mount) until they intersect the viewport. A skeleton placeholder renders immediately ( skeleton-first).

## Direct element usage

```html
<agentable-panel
  panel="open-positions"
  config-url="/config/sandals-career.json"
  lazy-hydrate
></agentable-panel>
<script type="module" src="/embed/agentable-panel.js"></script>
```

| Attribute | Role |
|-----------|------|
| `lazy-hydrate` | When present, show Lit skeleton until visible; then join page session and mount `PanelEmbedShell` |

Shadow part: `skeleton` (status landmark, `aria-busy="true"`).

## Auto-mount placeholders

```html
<div
  data-agentable-panel="open-positions"
  data-config-url="/config/sandals-career.json"
  data-lazy-hydrate
></div>
```

Scan behavior:

1. Placeholder receives a light-DOM skeleton (`data-testid="agentable-panel-embed-skeleton"`) and `data-agentable-lazy-pending`.
2. When the placeholder intersects (200px root margin prefetch), `<agentable-panel>` mounts and `data-agentable-mounted` is set.
3. The mounted panel activates immediately (visibility already confirmed at placeholder level).

## Implementation

| Path | Role |
|------|------|
| `src/embed/lazyHydration.ts` | Shared observer helper, skeleton markup/styles, attribute parsing |
| `src/embed/agentable-panel.ts` | `@lit-labs/observers` `IntersectionController`; defers `_activatePanel` |
| `src/embed/autoMountScan.ts` | Defers placeholder mount; integrates skeleton + observer |
| `src/embed/mountAgentablePanel.ts` | Maps `data-lazy-hydrate` → `lazy-hydrate` on the custom element |

## Tests

- Vitest: `tests/unit/lazyHydration.test.ts`, `tests/unit/agentablePanelLazyHydrate.test.ts`, lazy cases in `tests/unit/autoMountScan.test.ts`
- Component: `tests/component/agentable-panel-lazy-hydrate.test.ts`

## Published entry

Same bundle as /: `agentable-canvas/embed/panel` → `dist/embed/agentable-panel.js`.
