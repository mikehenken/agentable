# Track A.4 — 10-Section READMEs (2026-04-25)

Single reviewer (superpowers:code-reviewer) — documentation-accuracy task.

## Surface reviewed
- `agentable-canvas/README.md` (canvas)
- `agentable-canvas/docs/voice-call-button.md` (button)

## Findings + resolution

The reviewer found 11 LIES in the first draft. All resolved this iteration.

### LIES (resolved)
| # | Finding | Resolution |
|---|---|---|
| L1 | `welcome-message` / `api-endpoint` documented as functional but actually inert | Marked as `reserved (M2/M3)` in §2 with explicit "today the heading is derived from `assistantName` instead" / "today the canvas always shows voice" notes |
| L2 | `voice-enabled` / `snap-grid` likewise inert | Marked `reserved (M2)` with same treatment |
| L3 | All 4 `landi:call-*` event payloads claimed `{}` or missing fields | Corrected to `{ timestamp: string }`, `{ state, level, timestamp }`, `{ message, timestamp }` per actual code |
| L4 | `landi:call-started` trigger described as "Button reflects kernel listening/speaking" — overspecified | Corrected to "Kernel transitions `connecting → listening`" per actual button code |
| L5 | `_setImpl` / `_clearImpl` / `_publish` undocumented | Acceptable as "internal" (kept). Not surfaced in docs to avoid public-API lock-in. |
| L7 | Variant enum claimed `"nav" | "hero" | "compact"` — `compact` doesn't exist | Corrected to `"nav" | "hero"` |
| L8 | `::part` table missing 5 of 8 actual parts; renamed `mic-dot` (didn't exist) → `level-dot` (real) | Full table rewritten: `button`, `icon-wrap`, `icon`, `spinner`, `halo`, `level-dot`, `label`, `chip` |
| L9 | Brand-tokens block in voice-call-button.md was entirely fabricated (10 invented tokens, 0 of which existed) | Replaced with the actual ~21 `--landi-vcb-*` tokens from `voice-call-button.ts:96–127` |
| L10 | Slot fallback claimed `"Talk"` — actual code has `"Talk with our AI"` | Corrected |
| M1 | `<voice-call-button>` claimed "observation-only" but actually has public `start()` / `stop()` / `toggle()` methods | Rewrote §4 to document public methods AND the kernel-driven path |
| L6 | `useVoiceCall` JSDoc claimed `available` was a real "kernel has registered impl" check; actually a heuristic on error message | Updated JSDoc in `useVoiceCall.ts` to document the heuristic honestly + TODO M2 for honest signal |

### MISSING / NIT (deferred)
- `level` and `isActive` not shown in `useVoiceCall` example — added briefly via the example update; full prop reference deferred to a typed API doc
- A11y behavior of `<voice-call-button>` (aria-pressed, aria-label, live region) — defer to a dedicated a11y doc in Track A.2

### LOW
- Line numbers in §8 ("see `geminiLiveClient.ts:113`") will drift — accepted; will be updated in CHANGELOG entries
- Pinning React 19 specifically — kept as `≥18` since `useSyncExternalStore` is the only requirement

## Verification
- README §2 default values cross-checked against `DEFAULT_CONFIG` in `agentable-canvas.ts`
- README §3 event payloads cross-checked against `voice-call-button.ts:42–46, 346–356`
- README §5 brand tokens cross-checked against `index.css` lines 29–51
- README §4 hook signature matches `useVoiceCall` return type
- voice-call-button.md §6 part names cross-checked against `voice-call-button.ts:439–471`

## Status
DONE — 11 LIES + 1 internal-source comment fix resolved. 2 MISSINGs deferred with explicit tracks. Documentation is now publishable-ready (won't break consumers within the first day of use).
