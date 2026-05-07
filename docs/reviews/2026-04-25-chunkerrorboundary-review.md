# ChunkErrorBoundary + Standalone 500 (2026-04-25)

Single code-reviewer. NO SELF-REVIEW.

## Surface
- `src/canvas/ChunkErrorBoundary.tsx` — class component catching `React.lazy` chunk-load failures, wired into `CanvasShell`'s Suspense
- `src/standalone.css` — fixed Vite 500 (`@layer base` directive without matching `@tailwind base`)
- `.claude/launch.json` — three workspace services configured

## Findings + resolution

### CRITICAL (resolved)
| # | Finding | Resolution |
|---|---|---|
| C1 | Re-throwing inside `getDerivedStateFromError` is undefined behavior in React 18+ — may unmount parent tree, double-invoke `componentDidCatch`, or trigger render-loop in concurrent mode | **Fixed**: `getDerivedStateFromError` now stores the error in state. The re-throw moved into `render()` — the canonical pattern. React catches the render-phase throw via the next boundary up the tree exactly as if the original error had reached there. |

### WARNING (resolved)
| # | Finding | Resolution |
|---|---|---|
| W2 | Missing chunk-error patterns: Vite Safari `Importing a module script failed`, Webpack 5 named chunks `Loading chunk vendor-react failed`, `Unable to preload CSS` | Added 3 more patterns. Regex updated to `Loading (CSS )?chunk [\w-]+ failed/i` so named chunks match. Now 6 patterns total. |
| W3 | `focus-visible:ring-2` Tailwind utility uses `box-shadow` not `outline`. Inline `outlineColor` did nothing for the ring | Set `--tw-ring-color` inline (the variable Tailwind reads when computing the ring color). Cast via `['--tw-ring-color' as string]` because TS doesn't ship typings for arbitrary CSS variable property names. |
| W6 | No retry-without-reload affordance — only escape was `window.location.reload()` which tears down voice WebSocket | **Added secondary "Try again" button** that calls `setState({error: null})`. Soft retry — React re-attempts the lazy import. If chunk genuinely gone (post-deploy), recurs and re-shows boundary. If network blip, no full page reload. "Reload to continue" remains as the hard-failure escape. |
| W4 | `aria-live` announcement on post-mount setState — implicit via `role="alert"` works but cross-AT robustness | Added explicit `aria-live="assertive"` and `aria-atomic="true"`. |
| W8 | `console.error` was the only telemetry seam; OSS embeddability needs typed CustomEvent dispatch | Added `window.dispatchEvent(new CustomEvent('landi:chunk-load-failed', { detail: { message, timestamp }, bubbles: true, composed: true }))` inside `componentDidCatch` (only when chunk error). Embedders wire telemetry without monkey-patching console. |

### NIT (resolved)
- N9: stored but unused `errorMessage` field — replaced state shape with `{ error: Error | null }`. Cleaner.
- N10: `bg-canvas-surface` confirmed as a real Tailwind utility resolving to `var(--landi-color-surface, #FFFFFF)` per `config/landi-token-colors.cjs`. Not a hardcoded color.

### NIT (deferred)
- N5: Render boundary inside the panning layer means user could pan the error message off-screen. Portal to `document.body` with `position: fixed` would fix it. Tracked.
- N7: `window.location.reload()` doesn't bypass HTTP cache; for stale-hash chunks this is fine (browser refetches index.html), but a hard `reload(true)` (deprecated) or `?v=Date.now()` cachebuster would be more aggressive. Documented inline.

### Standalone 500 (resolved)
- Cause: `src/standalone.css` opened `@layer base { ... }` but PostCSS/Tailwind requires a matching `@tailwind base` directive in every stylesheet that does so. `index.css` has the directive but the @layer scope doesn't extend across files.
- Fix: dropped the `@layer base` wrapper. Plain top-level CSS rules with source-order specificity — exactly what we want for these standalone-only host-page hijacks. `@apply bg-background text-foreground` still works in plain CSS.

## Verification
- 41/41 tests passing
- Website (5180): kernel installed, Sandy header, zero console errors
- Canvas standalone (5173): title "Agentable Canvas", root mount, zero console errors (500 fixed)

## Status
DONE — 1 CRITICAL + 4 WARNINGs + 2 NITs resolved. 2 NITs deferred (portal positioning, hard-reload cachebust) tracked for future iteration.
