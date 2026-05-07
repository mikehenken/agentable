# Track A.7 + Architecture Refactor — Agent-to-Agent Review (2026-04-25)

Four parallel reviewers, no self-review.

## Surface reviewed
- `agentable-canvas/src/canvas/CanvasContext.tsx` (new)
- `agentable-canvas/src/canvas/CanvasShell.tsx` (wrapped with provider, accepts `config` prop)
- `agentable-canvas/src/canvas/VoiceWidget.tsx` (consumes context, no more cross-import)
- `agentable-canvas/src/react-canvas/index.tsx` (new pure-React entry, mode C)
- `agentable-canvas/src/embed/agentable-canvas.ts` (Lit shell reads `system-prompt` + `voice-greeting` attrs)
- `sandals/career-canvas/react/index.tsx` (new `<CareerCanvas>` Sandals wrapper)
- `sandals/website/src/pages/CareerCanvasPage.tsx` (consumer)
- `sandals/website/src/sections/CareerConciergeCanvasSection.tsx` (consumer)

## Findings summary

### CRITICAL (3 — all addressed)
| # | Finding | Reviewer | Resolution |
|---|---------|----------|------------|
| C1 | `CanvasProvider` rebuilds value on every render → `useGeminiLive` could reconnect voice on unrelated attr changes | architect | Wrapped `merged` in `useMemo` keyed on tenant + persona primitives |
| C2 | TopBar logo/title overlap (text rendering as white on light bg) | UX | ROOT CAUSE: website's `tailwind.config.js` content paths didn't include canvas source — `text-gray-900` not generated, color cascade leaked white. Fixed by adding `../../agentable-canvas/src/**/*.{ts,tsx}` + `../career-canvas/**/*.{ts,tsx}` to content paths. |
| C3 | Marketing-section sticky-nav overlay clipping canvas TopBar | UX | Added `scroll-mt-24` to `#agent` section so anchor jumps land below sticky nav |

### WARNING (resolved)
| # | Finding | Reviewer | Resolution |
|---|---------|----------|------------|
| W1 | OSS canvas defaults still Sandals-flavored (`#0D7377`, "Career Concierge") | architect | Defaults changed to neutral: `primaryColor: '#3B82F6'`, `welcomeMessage: 'Hi! How can I help?'` |
| W2 | `_renderReact` persona type cast lies (`Record<string, string>` → `{ systemPrompt: string; voiceGreeting?: string }`) | code-reviewer + architect | Refactored to `Partial<CanvasPersona>`-typed object, no casts |
| W3 | VoiceWidget hardcodes "Sandy" — Tier-3 leak in Tier-1 | code-reviewer | Added `assistantName?: string` to `CanvasPersona`; VoiceWidget reads from context. `@sandals/career-canvas` supplies `'Sandy'`. |
| W4 | `JSX.Element` vs `ReactElement` inconsistency | code-reviewer | Switched website pages to `ReactElement` |
| W5 | `CanvasProviderProps.config: Partial<CanvasTenantConfig>` not deep enough — caller can't pass partial persona | (proactive) | Added `PartialCanvasTenantConfig` deep-partial type |

### WARNING (deferred)
| # | Finding | Reviewer | Reason for defer |
|---|---------|----------|-----------------|
| W6 | `updated()` ignores 4 declared reactive attrs (`voiceEnabled`, `snapGrid`, `welcomeMessage`, `apiEndpoint`) — silently no-op after first render | code-reviewer | Wire-up requires propagating through CanvasShell config + CanvasContext. Plan-tracked under Track A.1. |
| W7 | Hoist `'agentable-canvas/styles.css'` import to entry | code-reviewer | Cosmetic — both surfaces work fine with redundant imports (Vite dedupes). |
| W8 | Pre-built `dist/styles.css` instead of raw `src/index.css` | architect | Build infra change; defer to Track A.3 (bundle work) |
| W9 | Verify `ensureVoiceKernel()` idempotency under StrictMode + Lit dual-call | architect | Idempotency holds (singleton check on `window.__voiceKernel__`). Test coverage to be added Track A.2. |
| W10 | 9 brand hexes hardcoded across canvas + section | UX | Token extraction tracked separately as a session-spanning refactor |
| W11 | Brand voice on suggestion prompts ("What does growth look like in F&B?" feels corporate) | UX | Copy lives in `agentable-canvas/src/canvas/ChatPanel.tsx` — another Tier-3 leak that needs to be hoisted to context. Track A.7 follow-up. |
| W12 | "Mock concierge — responses are simulated" disclaimer placement | UX | Awaits real CopilotKit runtime (M3) to remove the mock entirely |

### NIT (deferred)
- 22-line file header for 50-line module (CanvasContext.tsx) — verbose
- 7-line `declare` rationale comment in agentable-canvas.ts — could be one line + link
- Magic numbers in VoiceWidget (`Math.pow(rawLevel, 0.6) * 3`, `0.35`, `0.65`)
- `agentable-canvas: "*"` peer dep version too loose for published consumption
- `startVoiceCall`/`endVoiceCall` public API has no listener wired

## Verification

- `localhost:5180/career-canvas` — renders correctly. TopBar dark text, full Tailwind layout, no console errors. Voice kernel installed.
- `localhost:5180/` (marketing section) — renders correctly. Section anchor lands below sticky nav, canvas card fully visible.
- All Tailwind utilities resolve (no Shadow-DOM-pierce issue — pure-React mode = single React tree, classes scanned by website's Tailwind from canvas source via the new content paths).

## Test plan (from test-automator review)
Prioritized for Track A.2:
1. Persona end-to-end integration test (`<CareerCanvas>` → `<CanvasShell>` → `<VoiceWidget>` → `useGeminiLive` → mock client config assertion)
2. `_renderReact` no-double-mount + voiceKernel state preserved across attr change
3. `CanvasContext` merge corner cases (undefined/null/empty-string)
4. Sandals three-layer merge precedence (OSS default → Sandals default → caller)
5. Visual regression snapshots (canvas idle, voice active, with artifact, mobile, sandals-branded)
6. Interop (React 18/19, plain HTML host)

## Status
DONE_WITH_CONCERNS — 3 CRITICAL + 5 WARNINGS resolved; 7 follow-up items tracked under existing tracks.
