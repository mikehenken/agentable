# Track B.2 — useVoiceCall Hook + Button Wiring (2026-04-25)

Two parallel reviewers (architect + code-reviewer). UX/test-automator deferred for this small surface.

## Surface reviewed
- `sandals/website/src/hooks/useVoiceCall.ts` (new)
- `sandals/website/src/sections/Navigation.tsx` (button wiring)
- `sandals/website/src/sections/HeroSection.tsx` (button wiring)
- `agentable-canvas/src/react-canvas/index.tsx` (kernel re-exports added)

## Findings + resolution

### CRITICAL (resolved)
| # | Finding | Reviewer | Resolution |
|---|---------|----------|------------|
| C1 | Module-scoped `cached`/`initialised` unsafe across StrictMode + HMR; stale snapshots possible | code-reviewer | ROOT CAUSE addressed at the kernel layer: added `voice.getSnapshot()` returning a referentially-stable frozen reference replaced (not mutated) on every `_publish`. Hook simplified to just `getSnapshot: () => ensureVoiceKernel().voice.getSnapshot()` — no module cache. |
| C2 | `subscribe()` doesn't seed `cached` synchronously | code-reviewer | Resolved by C1 — kernel owns snapshot stability now. |

### HIGH (resolved)
| # | Finding | Reviewer | Resolution |
|---|---------|----------|------------|
| H1 | `useVoiceCall` lives in Sandals — every React consumer of OSS canvas will reinvent it | architect | Promoted hook into `agentable-canvas/src/react-canvas/useVoiceCall.ts`. Re-exported from `agentable-canvas/react-canvas`. Sandals' local `hooks/useVoiceCall.ts` is now a 1-line re-export. |

### WARNING (resolved)
| # | Finding | Reviewer | Resolution |
|---|---------|----------|------------|
| W1 | No `available` gating — clicking with no API key loops error forever | code-reviewer | `useVoiceCall` exposes `available: boolean`. Both buttons have `disabled={!voice.available}`. |
| W2 | HeroSection missing `'error'` label branch | code-reviewer | Both buttons now use `defaultVoiceLabel()` exhaustive switch — typed `never` default catches future state additions. |
| W3 | No `aria-live` for error / state announcements | code-reviewer | Added `<div role="status" aria-live="polite" className="sr-only">` in Navigation that announces error/connecting/listening/speaking transitions. |
| W4 | `aria-pressed` muddy on a button that toggles AND scrolls | code-reviewer | Replaced with explicit `aria-label` that names the action ("Start voice call with our AI" / "End voice call with our AI"). |

### WARNING (deferred)
| # | Finding | Reviewer | Reason |
|---|---------|----------|--------|
| W5 | Mic icon doesn't pulse with audio level | architect | Cosmetic UX polish; tracked under Track B.3 |
| W6 | Add `agentable-canvas/voice` subpath dedicated to kernel access | architect | Acceptable to ship voice surfaces under `react-canvas` initially; subpath split when surface stabilizes |

### NIT (deferred)
- `LANDI_VOICE_KERNEL_VERSION` constant for cross-bundle version detection — kernel already has `version` field; expose as constant when needed
- W9 (geminiLiveClient.ts duplicate `VoiceState`) — addressed inline; `geminiLiveClient.ts` now imports `VoiceState` from kernel

## Verification
- Browser: `localhost:5180/` — kernel installed, `getSnapshot()` returns referentially-stable reference (`a === b` check passes), no console errors, no React infinite-loop warning.
- Click flow: nav button click → `voice.toggle()` → kernel routes to `useGeminiLive` impl → no API key in dev → kernel transitions to `error` → button gracefully disables (instead of looping).
- Both buttons synchronized: same kernel state drives both labels via the same `defaultVoiceLabel()` resolver.

## Status
DONE — 2 CRITICAL + 1 HIGH + 4 WARNING resolved. 2 WARNINGs + 1 NIT deferred to follow-up tracks with rationale.
