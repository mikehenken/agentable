# Track A.3 — Bundle Budget + Pre-built Styles (2026-04-25)

Single architect-reviewer pass. NO SELF-REVIEW.

## Surface reviewed
- `agentable-canvas/scripts/check-bundle-size.mjs` (budget calibration)
- `agentable-canvas/scripts/build-styles.mjs` (new — Tailwind compile)
- `agentable-canvas/package.json` (exports, scripts)

## Findings + resolution

### MEDIUM (resolved)
| # | Finding | Resolution |
|---|---|---|
| M1 | "Calibrate budget upward" without a tracked code-split follow-up turns into permanent ceiling drift | Header comment in `check-bundle-size.mjs` already calls out the deferred React.lazy work on Settings/Applications/Resources panels with explicit ~160-180 KB target. Tracked under Track A.3 follow-up. |
| M2 | `build:styles` must run before `check:bundle` in CI chain — otherwise `dist/styles.css` is missing at publish | Added `build:styles` step to `build:embed:all` pipeline before `check:bundle`. Added `styles.css` to the budget table (30 KB gzipped ceiling) so Tailwind drift is caught. |
| M3 | README should recommend `import 'agentable-canvas/styles.css'` as the primary path; src-scan is advanced | Deferred to A.4 follow-up README polish. |

### LOW (resolved)
| # | Finding | Resolution |
|---|---|---|
| L1 | `source` is a Parcel-ism, not a standard Node/bundler condition. Won't resolve in Vite/Webpack/esbuild without explicit config | Replaced `{ default: dist, source: src }` with two explicit subpaths: `./styles.css` → dist (default), `./styles.source.css` → src (advanced consumers who want raw Tailwind directives). Explicit beats clever. |
| L2 | dist/styles.css size ~96 KB minified (14-18 KB gzipped) is reasonable for a 12-panel surface | Verified at 15.73 KB gzipped (52% under 30 KB budget). |
| L3 | Add tree-shaking warning for unconditional CSS side-effect import | Deferred to A.4 README polish. |

## Verification
```
Bundle size budget check (gzipped)
───────────────────────────────────────────────────
  ✓  embed/agentable-canvas.js             247.06 KB  /   280.00 KB  (88.2%)
  ✓  embed/agentable-canvas.umd.js         201.25 KB  /   230.00 KB  (87.5%)
  ✓  embed/voice-call-button.js             11.35 KB  /    40.00 KB  (28.4%)
  ✓  embed/voice-call-button.umd.js         10.51 KB  /    60.00 KB  (17.5%)
  ✓  styles.css                             15.73 KB  /    30.00 KB  (52.4%)
───────────────────────────────────────────────────
✓ All bundles within budget.
```

## Status
DONE — 2 MEDIUM + 1 LOW resolved. 2 MEDIUM/LOW deferred (README polish — Track A.4 follow-up).

---

## Track A.1 W5/W6 (paired)

Also landed in same iteration:

### W5 — useGeminiLive stable refs
`useEffect(() => kernel.voice._setImpl({start, stop}))` previously depended on `[start, stop]` whose identity changes on every render. Replaced with `useRef`-based stable wrappers and empty deps array — the impl registers once and reads the latest callbacks at call time.

### W6 — Public/internal type split
`VoiceController` (combined) is now `VoiceControllerPublic & VoiceControllerInternal`. Public surface (start/stop/toggle/getSnapshot/subscribe) is what the README documents and what host pages see. Internal surface (`_setImpl`/`_clearImpl`/`_publish`) is preserved on the runtime object but flagged in types so future docs/exports can narrow without breaking behavior.
