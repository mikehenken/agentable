# Track A.2 — Test Infrastructure Foundation (2026-04-25)

Single test-automator reviewer. NO SELF-REVIEW.

## Surface reviewed
- `vitest.config.ts` (Vitest + happy-dom + coverage scoping)
- `tests/setup.ts` (jest-dom matchers, kernel reset, browser-API stubs)
- `tests/unit/voiceKernel.test.ts` (14 tests)
- `tests/unit/canvasContext.test.tsx` (7 tests)
- `tests/unit/defaultVoiceLabel.test.ts` (6 tests)
- `tests/integration/personaEndToEnd.test.tsx` (5 tests)
- 32/32 passing

## Reviewer's grade: **B**
"Solid foundation: real bug caught, kernel reset, sensible scope. Held back from A by timer-coupling fragility, module-level singleton risk, missing direct `useGeminiLive` lifecycle test."

## Findings + resolution

### MED (resolved)
| # | Finding | Resolution |
|---|---|---|
| M1 | `delete window.__voiceKernel__` is necessary but not sufficient — module-level state (subscribers, timers, in-flight promises) survives. Need an explicit `__resetKernelForTests__()` hook. | Added `__resetKernelForTests__()` exported from `voiceKernel.ts` with a comment explaining why window-only deletion is insufficient + that the function is contractual for tests. `tests/setup.ts` now calls this via the module hook instead of `delete window.*`. |

### HIGH (deferred — substantial refactor)
| # | Finding | Reason for defer |
|---|---|---|
| H1 | Mock client should expose deterministic step API (`__advance('connected')` etc.) instead of tests using `advanceTimersByTimeAsync(400)` which couples to a 350ms magic number | Substantial mock refactor; tracked as a Track D follow-up. The current 32 tests work and lock down the persona chain — the fragility is "future change in connecting beat breaks 5 tests" which is acceptable while the mock pacing is stable. |
| H2 | `useGeminiLive` not tested directly. Best single test: persona prop change mid-session → exactly one teardown + one reconnect, no overlapping client instances | Track A.2 follow-up. Hook-level coverage is the highest-value next test. |

### LOW (correctly deferred)
| # | Finding | Resolution |
|---|---|---|
| L1 | `_renderReact` no-double-mount on Lit attribute change requires `@open-wc/testing` + `@web/test-runner`; happy-dom's custom-element lifecycle silently diverges from Chromium | Confirmed — DON'T fake it in Vitest. Defer to M2 alongside the rest of Lit component testing. |

## Missing-test priority ranking (per reviewer)
1. **Sandals three-layer merge precedence** (`<CareerCanvas>` → `<CanvasShell>` → `<CanvasProvider>`) — highest, cheap, catches contract regressions
2. **Lit component tests via `@open-wc/testing`** — second, mandatory per `web-components-ui` rule §9.2
3. **Interop tests (React 18/19, plain HTML)** — third, mandatory per §9.4
4. **Visual regression** — last, encouraged not blocking

## CI gating
Reviewer recommends: run on every PR, gate the merge. 6.4s integration suite is well under the 30min suite budget. Treating fast suites as optional erodes the contract within two sprints. Add to `package.json` CI workflow when GitHub Actions is wired.

## Verification
```
✓ tests/unit/voiceKernel.test.ts (14 tests) 15ms
✓ tests/unit/defaultVoiceLabel.test.ts (6 tests) 9ms
✓ tests/unit/canvasContext.test.tsx (7 tests) 52ms
✓ tests/integration/personaEndToEnd.test.tsx (5 tests) 6387ms
Test Files: 4 passed
Tests: 32 passed
```

## Status
DONE — 1 MED resolved this iteration. 2 HIGH + 1 LOW correctly deferred to Track A.2 follow-up + M2 with explicit rationale. Reviewer's grade B (path to A documented).
