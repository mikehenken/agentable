# Track A.2 Follow-ups — 3-Layer Merge + useGeminiLive Lifecycle (2026-04-25)

Single code-reviewer. NO SELF-REVIEW.

## Surface reviewed
- `tests/integration/threeLayerMerge.test.tsx` (5 tests at first, 4 after no-op removal)
- `tests/integration/useGeminiLiveLifecycle.test.tsx` (4 tests)
- 9 new tests, brought total from 32 → 40 passing across 6 suites

## Findings + resolution

### CRITICAL (resolved)
| # | Finding | Resolution |
|---|---|---|
| C1 | `<CareerCanvasUnderTest>` re-implementation diverged from real `<CareerCanvas>` — test would silently pass when production constants change | Test now imports `CAREER_CONCIERGE_SYSTEM_PROMPT` and `VOICE_GREETING` directly from `@sandals/career-canvas/voice/systemPrompt` via relative path. If anyone changes the canonical prompt, this test fails. Comment updated to note the inline wrapper exists only to dodge the peer-dep tree, not to fork the merge logic. |
| C2 | StrictMode test couldn't distinguish "1 impl registered cleanly" from "2 impls, second clobbered first" — exactly the leak it was supposed to catch | Replaced `expect(consoleSpy).not.toHaveBeenCalled()` with `vi.spyOn(_setImpl)` + `vi.spyOn(_clearImpl)`. New invariant: `setCalls - clearCalls === 1` at end of mount. The leak case (both mounts register without clearing) would show difference of 2 and fail. |

### WARNING (resolved or accepted)
| # | Finding | Resolution |
|---|---|---|
| W3 | "no warn fired" was implementation-detail-coupled to the kernel's synchronous warn-before-async-impl ordering | Resolved by C2 fix — now we spy on the registration methods directly, not on the warn side-effect. |
| W5 | `expect(true).toBe(true)` no-op test on CanvasShell config={} | Removed. `void MemoryRouter; void CanvasShell` placed instead so future expansion has the imports ready, with a comment explaining why the test was deleted. |

### WARNING (deferred)
| # | Finding | Reason |
|---|---|---|
| W4 | Persona-swap test only asserts "doesn't crash" — should assert exactly one teardown + one reconnect | Track A.2 follow-up. Requires spying on `createMockVoiceClient` from outside its module — needs a vi.mock or factory injection at the useGeminiLive level, which is itself a deeper refactor (W6 from architect-reviewer's earlier mock review). |
| W7 | `act()` warnings emitted from React but assertions still pass | Cosmetic — assertions are correct in spite of the warnings (state has settled by the time we check). To fix, wrap the kernel-driven calls in `await act(async () => {...})`. Tracked. |
| W8 | Shared kernel singleton across tests — defensive `_clearImpl()` in afterEach would help | The setup already calls `__resetKernelForTests__()` in afterEach (added in the earlier A.2 review iteration). This drops the entire kernel from window, which transitively drops the impl registration. Sufficient. |

### NIT (resolved)
| # | Finding | Resolution |
|---|---|---|
| N6 | Dead `started` variable + `started; // suppress unused` | Removed. |

### Verification
```
✓ tests/unit/voiceKernel.test.ts           14 tests
✓ tests/unit/canvasContext.test.tsx         7 tests
✓ tests/unit/defaultVoiceLabel.test.ts      6 tests
✓ tests/integration/threeLayerMerge.test.tsx       4 tests
✓ tests/integration/useGeminiLiveLifecycle.test.tsx 4 tests
✓ tests/integration/personaEndToEnd.test.tsx       5 tests

Test Files  6 passed (6)
     Tests  40 passed (40)
```

## Status
DONE — 2 CRITICAL + 2 WARNING + 1 NIT resolved. 3 deferred with rationale (one duplicates a known mock-refactor task tracked elsewhere; the others are cosmetic test-runtime artifacts).

## Reviewer's verdict
"Production code is sound." Tests now genuinely pin the contracts they claimed to:
- 3-layer merge precedence — pinned against the real `CAREER_CONCIERGE_SYSTEM_PROMPT` constant
- StrictMode impl registration — counts set/clear directly, can't pass when leaking
