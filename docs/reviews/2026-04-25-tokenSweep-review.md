# M2 Partial — Token Sweep + Theming (2026-04-25)

Single architect-reviewer. NO SELF-REVIEW.

## Surface reviewed
- `src/index.css` — added 3 tokens (`--landi-color-accent`, `--landi-color-canvas-bg`, `--landi-color-canvas-dot`)
- `src/canvas/VoiceWidget.tsx` — visualizer bars migrated to tokens
- `src/canvas/CanvasShell.tsx` — workspace surface migrated to tokens
- `src/canvas/CanvasContext.tsx` — `CanvasLabels` type + `labels` field on `CanvasTenantConfig` (parallel work this iteration)
- `dist/styles.css` rebuilt

## Findings + resolution

### HIGH (resolved)
| # | Finding | Resolution |
|---|---|---|
| H1 | `:root` selector won't match inside Lit Shadow DOM (mode L). Tokens declared on `:root` would silently fall through to `var()` fallbacks inside the embed bundle, losing tenant overrides. **Could be silently broken right now.** | Selector duplicated to `:root, :host` in `index.css` so tokens resolve in BOTH mounting modes (light DOM for React mode B/C, Shadow DOM for Lit mode L). Comment added explaining the rationale. |

### MEDIUM (resolved)
| # | Finding | Resolution |
|---|---|---|
| M1 | `--landi-color-canvas-bg` / `--landi-color-canvas-dot` overload "canvas" (product name + HTML element + surface) | Renamed to `--landi-color-workspace-bg` / `--landi-color-workspace-dot`. Done before any embedder consumes the wrong name. |

### MEDIUM (deferred)
| # | Finding | Reason |
|---|---|---|
| M2 | Add canonical theming section to README/EMBEDDING.md showing all 13 tokens with one-line purpose each | Tracked. Documentation pass; better folded into a deliberate v1.0 polish than mid-loop. |
| M3 | Group tokens with section comments (`/* Brand */`, `/* Surfaces */`, `/* Status */`) for readability | Tracked. Cosmetic. |
| M4 | `docs/status/token-sweep-inventory.md` listing remaining ~60 hex literals with tier label so the work is bounded | Tracked. Inventory deferred to a focused future iteration. |

### LOW (acknowledged)
| # | Finding | Resolution |
|---|---|---|
| L1 | First-pass scope (canvas chrome + visualizer) is reasonable triage; Tailwind grays/whites correctly deferred | Confirmed. |
| L2 | `var(--token, #fallback)` fallback hex isn't redundant — defends against pre-paint loads, invalid overrides, tree-shaken stylesheets | Confirmed; pattern kept. |
| L3 | `--landi-color-accent` naming is right (industry-standard term across MUI, Tailwind, Material) | Confirmed. |
| L4 | Inline `style={{background: 'var(...)'}}` over Tailwind arbitrary `bg-[var(...)]` for dynamic colors — defensible given Tailwind v3 JIT edge cases | Confirmed; comment added in VoiceWidget. |

## Parallel work landed this iteration

### CanvasLabels config object (UX reviewer NIT from previous loop)
- New `CanvasLabels` interface on `CanvasContext`: `shareArtifact`, `sendMessage`, `emptyArtifacts`, `emptyArtifactsHint`
- Added to `CanvasTenantConfig.labels` + `PartialCanvasTenantConfig.labels` (deeply optional)
- Default values: "Share", "Send message", "No artifacts yet", and the empty-artifacts body copy
- Sandals can override `labels.shareArtifact = 'Send to recruiter'` via `<CareerCanvas>` if/when that copy decision lands
- Wiring this into ChatPanel/ArtifactsPanel consumption deferred — type contract is in place; consumers can be flipped one at a time

## Verification post-fix
- 41/41 tests still passing
- Browser: tokens resolve correctly via `:root, :host` cascade
  - `--landi-color-workspace-bg`: `#F5F5F2` ✓
  - `--landi-color-workspace-dot`: `#D0D0CC` ✓
  - `--landi-color-accent`: `#C9A227` ✓
  - Canvas computed bg: `rgb(245, 245, 242)` ✓
- Zero console errors

## Status
DONE — 1 HIGH + 1 MEDIUM resolved. 3 MEDIUMs (theming doc, token grouping, hex inventory) deferred with rationale.
