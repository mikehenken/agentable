---

lrn: lrn::en:platform:agentable-canvas.feature.whiteboard-embed-wiring::feature

related_docs:

  - docs/features/dom-workspace-engine.md

  - packages/career-pack/README.md

changelog:

  - date: 2026-07-25

    summary: Iteration-3 — explicit dark-canvas on gallery examples; layout-hints reset on dispose; late provider wiring recovery; one-tldraw-bundle host contract test.

  - date: 2026-07-25

    summary: Combined career-whiteboard.js embed bundle (single tldraw graph); provider bootstrap before custom element define.

  - date: 2026-07-25

    summary: Pack boundary correction — career wiring moved to career-pack; core exposes provider registry.

---



# Whiteboard embed wiring (pack seam)



Core `agentable-canvas` whiteboard Lit embeds (`<agentable-whiteboard>`, `<agentable-canvas>`) resolve panel host, nav rail, and panel loaders through a **generic injection seam**. Core never imports domain packs and **does not auto-detect career tenants** — packs gate themselves (e.g. `KNOWN_CAREER_TENANT_IDS` in career-pack) and return `null` when inactive.



## Core API



| Symbol | Location | Role |

|--------|----------|------|

| `resolveWhiteboardEmbedWiring` | `src/embed/whiteboard/resolveWhiteboardEmbedWiring.ts` | Merge injected wiring or consult registered providers; default chat-only |

| `registerWhiteboardWiringProvider` | `src/embed/whiteboard/whiteboardWiringProviderRegistry.ts` | Packs register factories (pack → core direction) |

| `onWhiteboardWiringProvidersChanged` | `src/embed/whiteboard/whiteboardWiringProviderRegistry.ts` | Notifies embed elements when a provider registers (split-script recovery) |

| `refreshWhiteboardWiring` | `<agentable-whiteboard>` `<agentable-canvas>` | Public re-resolve when chat-only wiring stuck after late provider load |

| `configureWhiteboardLayoutHints` | `src/engines/tldraw/layout/whiteboardLayoutConfig.ts` | Domain-neutral layout hints (list panel ids, arrange order, palette entities) |



### Provider contract



- Packs **must return `null`** from their wiring factory when inactive for the current tenant/config. The registry uses **first matching non-null result**.

- Active packs call `configureWhiteboardLayoutHints` when creating a host bundle; `disposeCareerWhiteboardHostBundle` (career-pack) calls `resetWhiteboardLayoutHints` so hints do not leak across embed lifecycles.



### Canvas chrome (light dark)



Core uses **attribute-only** theming: `light-canvas` `dark-canvas`. When neither is set, default is **light**. Gallery and operator demo pages that previously relied on the removed tenant heuristic (`archipelago → light`, others → dark) must set `dark-canvas` explicitly on the embed tag.



## Host contract — one tldraw bundle per page



Each host HTML page must load **at most one** tldraw-bearing embed script:



| Bundle | Role |

|--------|------|

| `agentable-canvas.js` | Legacy tag; whiteboard mount + tldraw |

| `agentable-whiteboard.js` | Generic whiteboard embed |

| `career-whiteboard.js` | Career pack + whiteboard (single graph) |



`tests/unit/embedSingleTldrawBundleGuard.test.ts` scans `examples/**/*.html` and `archipelago/website/public/embed/**/*.html` and fails if any page references more than one of the above.



**Accepted limitation:** Bundles remain self-contained lib builds; `resolve.dedupe` only dedupes within a single Vite graph. Loading two tldraw-bearing scripts on one page still duplicates tldraw at runtime. The guard converts the footgun to a CI failure. A shared-externals embed build (one React/tldraw singleton across bundles) is the eventual structural fix — deferred during HITM example freeze.



## Career pack entry 



```typescript

import { registerCareerWhiteboard } from 'agentable-canvas/career-pack';



const { host, navItems, panels, dispose } = registerCareerWhiteboard({

  tenantConfig,

  configDocument,

  panelDataRaw,

});

```



Lit hosts that need career panels load the **combined bundle** (single tldraw graph):



```html

<link rel="stylesheet" href="/embed/career-whiteboard.css" />

<agentable-whiteboard tenant="archipelago" config-url="…" light-canvas></agentable-whiteboard>

<script type="module" src="/embed/career-whiteboard.js"></script>

```



Build: `npm run build:embed:career-whiteboard` → `dist/embed/career-whiteboard.js`.



Do **not** load `agentable-whiteboard.js` and a separate pack bootstrap in production — that creates two module graphs and duplicate tldraw at runtime (`didWarn: true`). Prefer `career-whiteboard.js` or ensure the pack provider registers **before** the embed element's first render; embed elements also listen for late registration via `refreshWhiteboardWiring`.



### React hosts



```typescript

import { registerCareerWhiteboard } from 'agentable-canvas/career-pack';

```



## Boundary enforcement



`tests/unit/careerPackBundleBoundary.test.ts` fails if any `src/` file imports `packages/career-pack` or `@agentable/career-pack`, except four pre-existing allowlisted files pending `EmbedPanelPackPlugin` migration.



## Embed config surface



Whiteboard embeds consume (when present on config JSON or attributes):



- `panels` — forwarded to pack merge host registration

- `snapGrid`, `fullpageOnEngage`, `hostHeaderHeight` — applied in `WhiteboardShell`

- `toolbar` `toolbarConfig` — `DEFAULT_WHITEBOARD_TOOLBAR_TOOLS` when omitted


