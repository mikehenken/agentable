# Track D — Mock Voice Mode (2026-04-25)

Two parallel reviewers (architect + code-reviewer). NO SELF-REVIEW.

## Surface reviewed
- `agentable-canvas/src/canvas/voice/mockGeminiLiveClient.ts` (new)
- `agentable-canvas/src/canvas/voice/useGeminiLive.ts` (mock-aware client selection)

## Findings + resolution

### CRITICAL (resolved)
| # | Finding | Reviewer | Resolution |
|---|---------|----------|------------|
| C1 | `stop()` lifecycle asymmetry: greeting goes `connecting → speaking` without passing through `listening`, so `landi:voice-started` never fires (gated on `s === 'listening' && sessionStartRef === 0`). `landi:voice-ended` then suppressed too. | code-reviewer | Mock now transitions `connecting → listening → speaking` on session open, even when a greeting is queued. Comment added explaining why the listening beat is mandatory. |

### HIGH (resolved)
| # | Finding | Reviewer | Resolution |
|---|---------|----------|------------|
| H1 | Silent mock fallback in production is treacherous — a forgotten `VITE_GEMINI_API_KEY` in prod silently routes users to a fake assistant | architect | Selection now: `forceMock || envMock || (!apiKey && !isProd)`. In prod with no key, mock is NOT auto-selected and a `console.error` fires explaining the misconfiguration. Devs still get zero-config offline. |

### WARNING (resolved)
| # | Finding | Reviewer | Resolution |
|---|---------|----------|------------|
| W1 | Persona greeting always overrides scenario greeting (test authors get surprised) | code-reviewer | Inverted precedence: explicit `scenario.greeting` wins, persona is fallback. |
| W2 | 60Hz `setInterval` doesn't pause on hidden tabs (real client uses RAF) | code-reviewer | Switched to `requestAnimationFrame` self-scheduling loop. |
| W3 | One scenario JSON file should ship to prove the loader path | architect | Created `sandals/career-canvas/scenarios/sandals-conversation.json` (Sandals brand-voice, 4 turns). Wired into `<CareerCanvas>` via `persona.mockScenario`. Added `mockScenario` to `CanvasPersona` type and the `CanvasProvider` merge. |
| W4 | `window.setTimeout` etc — bare functions are Worker-context safe | code-reviewer | Removed `window.` prefix. |

### WARNING (deferred)
| # | Finding | Reviewer | Reason |
|---|---------|----------|--------|
| W5 | Chat mock unification — ChatPanel uses inline response array, voice uses typed scenario | architect | Track D follow-up. ChatPanel mock comment to be added Track A.2 alongside test fixtures. |
| W6 | `MockVoiceController` test seam — `forceMock: true` not enough for deterministic tests with fake timers | architect | Track A.2 — natural addition when test infra lands. |
| W7 | `clientRef` not rebuilt when `mockScenario` identity changes mid-session | code-reviewer | Documented constraint: scenario captured at first session start. Acceptable until config-update-mid-session is a real use case. |
| W8 | Error message misleading when mock disabled in prod | code-reviewer | Effectively addressed by H1's loud `console.error` — gives users the recovery path. |

### NIT (deferred)
- `envelope()` dead zone could be smoothstep — cosmetic
- `DEFAULT_SCENARIO` discoverability — README will document Track A.4
- Comment added explaining "envelope is a visualizer placeholder, not derived from any audio analysis or DSP routine" (architect's MIT publishability nit)

## Verification
- Browser: `localhost:5180/career-canvas`
- `kernel.voice.start()` → `state: connecting → listening → speaking` (Sandals greeting from scenario file: "Hi there — I'm Sandy, your Career Concierge at Sandals...")
- After 8s: `state: listening`, transcript still showing greeting (turn-1 listening window)
- `kernel.voice.stop()` → clean idle, no console errors

## Status
DONE — 1 CRITICAL + 1 HIGH + 4 WARNINGS resolved this iteration. 4 WARNINGs + 2 NITs deferred to Track A.2 / Track D follow-ups with rationale.
