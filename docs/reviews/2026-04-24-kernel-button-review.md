# Review summary — landiKernel + agentable-canvas wiring + landi-voice-call-button

**Date:** 2026-04-24
**Implementer:** Claude (this session)
**Reviewers (parallel, no self-review):**
- `chief-ux-ui-design-officer` — design fidelity, brand voice, token discipline, cognitive friction
- `architect-reviewer` — race conditions, memory, bundle independence, Lit perf, hook correctness
- `superpowers:code-reviewer` — TS strictness, slop, error handling, magic numbers
- `test-automator` — test scaffolding plan + smoke tests

**Files in scope:**
- `src/shared/landiKernel.ts`
- `src/embed/agentable-canvas.ts` (modified)
- `src/canvas/voice/useGeminiLive.ts` (refactored)
- `src/embed/landi-voice-call-button.ts` (new)
- `vite.embed-button.config.ts` (new)
- `scripts/check-bundle-size.mjs` (new)
- `scripts/copy-embed-to-sandals.mjs` (new)

## Severity counts

| Severity | Count | Status |
|---|---:|---|
| CRITICAL | 10 (deduplicated) | ❌ open — must be fixed before chunk is "done" |
| WARNING | 16 (deduplicated) | ❌ open — fix this session if possible |
| SLOP | 8 (deduplicated) | open |
| NIT | 13 | tracked |

## Consolidated CRITICAL findings (must fix)

### C1 — Chip language fails Sandals brand voice
**Reviewer:** chief-ux-ui-design-officer
**File:** `src/embed/landi-voice-call-button.ts:347-355`
**What:** Chip text "Connecting" / "Listening" / "Sandy is talking" / "Voice error" — generic chatbot language. "Voice error" reads as raw system diagnostic. "Sandy is talking" is inconsistent with `VoiceWidget.tsx:48` which uses "Sandy is speaking".
**Fix:** Change `_statusLabel()`:
- `connecting` → "Connecting" (keep)
- `listening` → "Listening" (keep)
- `speaking` → **"Sandy is speaking"** (match VoiceWidget)
- `error` → **"Tap to retry"** (action, not diagnostic; full error stays in aria-live region)

### C2 — Hardcoded color/typography values inside body rules
**Reviewer:** chief-ux-ui-design-officer + superpowers:code-reviewer
**File:** `src/embed/landi-voice-call-button.ts:119, 120, 124, 211`
**What:** Raw `rgba(255,255,255,0.12)` chip background, raw rgba fallbacks for hero variant in body rules (not token block), raw `0.025em` letter-spacing, raw `0.6875rem` font size. Web-components-ui §3.1 auto-rejects this.
**Fix:** Move all defaults to the `:host` token block (`--landi-vcb-chip-surface`, `--landi-vcb-cta-bg`, `--landi-vcb-cta-bg-hover`, `--landi-vcb-cta-border`, `--landi-vcb-chip-font-size`, `--landi-vcb-chip-tracking`).

### C3 — Hero variant two-yellow color collision
**Reviewer:** chief-ux-ui-design-officer
**File:** `src/embed/landi-voice-call-button.ts:119-120, 124, 142`
**What:** Hero default bg `rgba(212, 165, 116, 0.8)` (tan) + icon color `var(--landi-vcb-color-accent)` defaulting to `#c9a227` (gold) = two competing warm yellows. Brand voice doc §"Color & Visual Tone": "depth through restraint — use the brand blue and gold sparingly".
**Fix:** Switch hero default bg to brand primary `#0d7377` (gold-on-teal is the Sandals signature pairing per `brand-voice-guidelines.md:108-109`).

### C4 — Idle perpetual halo animation
**Reviewer:** chief-ux-ui-design-officer
**File:** `src/embed/landi-voice-call-button.ts:158-161`
**What:** `.halo.idle { animation: halo-ping 2s ... infinite }` — pulses forever once mounted. On marketing nav this runs 24/7, contradicting "Premium, calm" brand identity, burning battery, distracting users from page content.
**Fix:** Remove `.halo.idle` rule entirely. Idle = static (no halo). Reserve halo motion for `listening`/`speaking`/`connecting`. Optional: subtle `transform: scale(1.02)` on `:hover` only.

### C5 — `_publish` errorMessage semantics gap
**Reviewer:** superpowers:code-reviewer
**File:** `src/shared/landiKernel.ts:130-133` + `useGeminiLive.ts:111`
**What:** `_publish({ errorMessage: undefined })` writes the key with `undefined` rather than deleting it. Stale errorMessage from a previous error can leak through. There's no `_publish` site that clears `errorMessage` at idle transition.
**Fix:** Either treat `undefined` as delete in `_publish`, or add a `clearError()` method called on idle transitions in `onState`.

### C6 — `_setImpl` cleanup installs warn-stub that defeats `if (!impl)` guard
**Reviewer:** superpowers:code-reviewer + architect-reviewer
**File:** `useGeminiLive.ts:135-145`
**What:** On unmount, `_setImpl` is replaced with `{ async start() { console.warn(...); }, async stop() { /* noop */ } }`. The kernel's `start()` only guards `if (!impl)` — but the stub is truthy, so kernel proceeds, calls stub, returns, with state still 'idle'. Button user gets no feedback. Critically, this masks a real failure as silent no-op.
**Fix:** Add `_clearImpl()` to kernel API; call it on cleanup. Kernel's `start()` then properly hits the no-impl warn path AND publishes `state: 'error'` with a clear message.

### C7 — RAF publishes `level: 0` at 60Hz while idle
**Reviewer:** superpowers:code-reviewer + architect-reviewer
**File:** `useGeminiLive.ts:150-168`
**What:** RAF loop runs from mount to unmount. When inactive, calls `_publish({ level: 0 })` 60×/sec, iterating all subscribers and cloning the snapshot. Unbounded waste while button sits idle.
**Fix:** Track `prevLevel` ref; only `_publish` when level changed. Or stop the RAF when transitioning to idle, restart on `connecting`/`listening`.

### C8 — RAF effect doesn't gate on `available`
**Reviewer:** superpowers:code-reviewer
**File:** `useGeminiLive.ts:148-168`
**What:** When no API key (`available === false`), RAF still polls 60×/sec. Pure waste.
**Fix:** `if (!available) return;` at top of effect, or include `available` in deps.

### C9 — React StrictMode leaves stub impl as final
**Reviewer:** architect-reviewer
**File:** `useGeminiLive.ts:132-146`
**What:** StrictMode double-invokes effects. Cleanup → re-mount → cleanup → re-mount. Final cleanup installs the warn-stub permanently. Subsequent button clicks silently no-op.
**Fix:** Same fix as C6 — `_clearImpl(null)` lets kernel detect "no impl" and surface `'error'` properly.

### C10 — Subscriber set grows unbounded on element reparenting
**Reviewer:** architect-reviewer
**File:** `landi-voice-call-button.ts:274` + `landiKernel.ts:58`
**What:** If host page moves the element in the DOM (portal, drawer, framework reparent), `connectedCallback` fires again while `_unsubscribe` still holds the prior handle. Old subscription never cancelled before new one added; `listeners` Set accumulates entries.
**Fix:** At top of `connectedCallback`, call `this._unsubscribe?.()` before re-subscribing.

## High-priority WARNINGs (target this session)

- **W1** — Hardcoded chip duration tokens (`2s`, `1.4s`, `0.9s`) — extract to `--landi-vcb-halo-duration-{idle,listening,speaking}` (`landi-voice-call-button.ts:160, 166, 171`)
- **W2** — Border-radius `9999px` literal × 4 — use `var(--landi-vcb-radius)` (`:151, :206, :232, :251`)
- **W3** — Magic threshold `0.05` for level-dot visibility — hoist to named const (`:409`)
- **W4** — Magic level-dot scale formula — extract to `_levelToScale(level)` private method (`:413`)
- **W5** — `useEffect` deps `[start, stop]` re-fires on identity change, briefly installs warn-stub mid-session if `start`/`stop` identity churns (`useGeminiLive.ts:132-146`) — fix with stable refs reading latest callbacks
- **W6** — `_setImpl` and `_publish` exposed on the public `VoiceKernel` type; any host-page script can hijack state. Split into `VoiceKernelPublic` + `VoiceKernelInternal`.
- **W7** — `agentable-canvas` stale comment about `createRenderRoot` light-DOM that doesn't exist (`agentable-canvas.ts:64-71`) — delete misleading block
- **W8** — `_mount` field assigned but never read (`agentable-canvas.ts:90, 165`) — delete
- **W9** — Duplicated `VoiceState` type in `landiKernel.ts:18` and `geminiLiveClient.ts:23` — `geminiLiveClient` should import from kernel
- **W10** — Legacy `landi:voice-start-requested` window-event bridge mislabeled "for one release" but is the canvas's primary public command API — either reroute `agentable-canvas.ts:139-155` to kernel directly or update comment
- **W11** — `start()` race window between idle-guard pass and impl publishing 'connecting' (`landiKernel.ts:94-101`) — publish `'connecting'` synchronously before awaiting impl
- **W12** — Initial subscribe call's swallowed throw spams console.error every state change forever (`landiKernel.ts:118-122`) — remove listener if initial throws
- **W13** — Custom-element duplicate `define` collision risk if both bundles include `landi-voice-call-button.ts` — guard with `if (!customElements.get(...))` or mark as external
- **W14** — `<button>` with `role="status" aria-live="polite"` chip nested inside + visually-hidden `aria-live` region = double announcement
- **W15** — `aria-pressed` semantics wrong for start/stop (different actions, not toggle of same action) — drop, rely on dynamic aria-label
- **W16** — `nav` variant 36px height fails 44px touch-target guideline — bump padding to 0.75rem 1rem
- **W17** — Focus ring gold-on-gold on hero variant fails WCAG 2.4.7 contrast — variant-specific outline color or two-tone focus shadow
- **W18** — `chip` and visually-hidden region both `aria-live` polite — remove from chip, keep only on hidden region; promote error region to `role="alert"` / assertive
- **W19** — `inlineDynamicImports: true` + duplicated `define` block across embed configs — extract shared config helper
- **W20** — `style="transform: scale(...)"` string concat — use `styleMap` directive per CLAUDE.md §15.5

## Test scaffolding plan (test-automator)

Full plan delivered. Action items:
- Install dev deps: `vitest@^3.2.0`, `@vitest/coverage-v8`, `@web/test-runner@^0.19.0`, `@web/test-runner-playwright`, `@open-wc/testing@^4.0.0`, `@open-wc/testing-helpers`, `axe-core`, `@axe-core/playwright`, `@testing-library/{react,user-event,jest-dom}`, `playwright`, `@playwright/test`, `jsdom`, `happy-dom`
- Configs: `vitest.config.ts`, `web-test-runner.config.js`, `playwright.config.ts`, `tests/setup.ts` — full content provided in test-automator's report
- Priority test files (full content provided): `tests/unit/landiKernel.test.ts`, `tests/component/landi-voice-call-button.test.ts`
- Outlines provided for: `tests/component/agentable-canvas.test.ts`, `tests/unit/VoiceWidget.test.tsx`, `tests/interop/{react,plain-html}-host.spec.ts`, `tests/visual/landi-voice-call-button.spec.ts`, `tests/a11y/voice-call-button.spec.ts`

Acceptable M1 coverage gaps: real Gemini WebSocket, real audio level RAF timing, full canvas React subtree integration.

## Decisions

- All 10 CRITICALs to be fixed in this session before declaring the chunk done.
- W1–W10 to be fixed in same session if time permits; W11–W20 acceptable as filed follow-ups if time-pressed.
- Test scaffolding to land alongside the CRITICAL fixes, not as a separate phase.
