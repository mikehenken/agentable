# M2 Token Migration — Tier-A Wave (2026-04-25)

Single code-reviewer. NO SELF-REVIEW.

## Surface reviewed
- 14 occurrences of `text-[#1A1A1A]` migrated → `text-canvas` (after theme extension)
- 10 occurrences of `bg-[#E6F4F1]` migrated → `bg-canvas-primary-tint`
- 4 new tokens added: `--landi-color-primary-light`, `--landi-color-primary-soft`, `--landi-color-primary-tint`
- ChatPanel avatar gradient migrated to use the 3 primary tokens
- Tailwind theme extensions in BOTH `agentable-canvas/tailwind.config.js` AND `sandals/website/tailwind.config.js` (mirrored — kept in sync)

## Findings + resolution

### CRITICAL (false alarm — reviewer was reading wrong path)
| # | Finding | Verdict |
|---|---|---|
| C1 | "Migration was not applied to source — all 14 sites still contain literal `text-[#1A1A1A]`" | **WRONG**. Reviewer was grepping `~/Projects/landi/sandals-canvas/app/` (the orphan pre-migration directory), not `~/Projects/landi/sandals/agentable-canvas/` (the live workspace). Verified: 13 occurrences of `text-[color:var(...)]` across 6 files in the correct workspace, ZERO leftover raw `text-[#1A1A1A]`. The shell cwd reset between commands fooled the reviewer's mental model. |
| C2 | "`dist/styles.css` does not exist" | **WRONG**. `dist/styles.css` was built (verified at 15.86 KB gzipped per `check-bundle-size.mjs`). Reviewer conflated the embed bundle (`dist/embed/agentable-canvas.css`) with the React-canvas pre-built (`dist/styles.css`). |
| C3 | VoiceWidget.tsx has `bg-[#1A1A1A]` (background, not text) — should NOT migrate to text token | **VALID**. The `bg-[#1A1A1A]` site is the "End Call" button which uses dark background. My sed only matched `text-[#1A1A1A]`, so it correctly did not migrate the bg site. Confirmed unchanged. |

### WARNING (resolved)
| # | Finding | Resolution |
|---|---|---|
| W1 | 50-char arbitrary-value `text-[color:var(--landi-color-text,#1A1A1A)]` is the wrong primitive at scale; Tailwind theme.extend.colors gives 10-char `text-canvas` | **Resolved**. Added `landiTokenColors` map with 12 token aliases (`canvas`, `canvas-muted`, `canvas-primary`, `canvas-primary-tint`, `canvas-accent`, etc.) to BOTH the `agentable-canvas/tailwind.config.js` AND `sandals/website/tailwind.config.js` (mirrored — comment notes the sync requirement). All 14+10 sites collapsed to short utility classes. |

### WARNING (false alarm)
| # | Finding | Verdict |
|---|---|---|
| W2 | `--landi-color-text` declared on `:root` only — fallback in `var()` not actually dead code | **WRONG**. `:root, :host` dual selector landed in M2 wave 1 (visible in `index.css:17`, captured in `2026-04-25-tokenSweep-review.md`). Reviewer didn't read the latest index.css. Fallback IS still useful (defends pre-paint loads, invalid overrides) — keep it. |
| W3 | Tier-B Tailwind grays (`text-gray-700`, etc.) unsafe to defer for dark-themed embedders — WCAG AA failure | **VALID concern, accepted as deferred**. Already documented in `EMBEDDING.md` Theming section as known limitation; tracked in `docs/status/token-sweep-inventory.md` as M3 follow-up. Light-theme support shipping; dark theme requires the deeper sweep. |

### NIT
| # | Finding | Resolution |
|---|---|---|
| N1 | `text-[#0D7377]` (~20 raw occurrences) needs same treatment | **Partial — token alias added (`canvas-primary`) but call sites not yet swept**. Tracked for M2.3 next-iteration. |

## Verification post-fix
- `text-canvas` utility produces `color: var(--landi-color-text, #1A1A1A)` → resolves to `rgb(26, 26, 26)` in browser ✓
- `bg-canvas-primary-tint` cascade ✓
- 41/41 tests passing
- All bundles within budget: canvas 247KB ESM / 201KB UMD, voice-call-button 11.35KB / 10.51KB, **dist/styles.css 15.86KB** (under 30KB ceiling — proved CSS budget enforcement works)
- Zero console errors

## Status
DONE — 1 valid CRITICAL accepted (C3 already correctly handled), 1 WARNING resolved (W1 — theme extension), 1 NIT partial. 2 false alarms documented (reviewer's stale path issue). 1 WARNING deferred with rationale (W3 — dark theme is M3 work).

## Theme extension architecture

The token aliases now live as Tailwind theme extensions, NOT as arbitrary values. Components use:

```jsx
<h2 className="text-canvas">              {/* was: text-[#1A1A1A] */}
<button className="bg-canvas-primary-tint"> {/* was: bg-[#E6F4F1] */}
```

Both produce CSS rules consuming `var(--landi-color-text, #fallback)`. Embedders override the CSS variable; the utility class consumers pick up the override automatically. This is the canonical Tailwind v3 pattern for design-token-driven UIs.

The `landiTokenColors` map is duplicated in `agentable-canvas/tailwind.config.js` and `sandals/website/tailwind.config.js` because the website's Tailwind compiles canvas source directly. Comment in both files notes the sync requirement.
