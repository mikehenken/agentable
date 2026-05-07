# Track B.3 Polish + B.4 E2E QA Sweep (2026-04-25)

Single chief-ux-ui-design-officer reviewer. NO SELF-REVIEW.

## Surface reviewed
- `agentable-canvas/src/canvas/VoiceWidget.tsx` — error styling, aria-live, reduced-motion (this loop's earlier batch)
- `agentable-canvas/src/canvas/ArtifactsPanel.tsx` — aria-labels, focus rings, "Share with Sandals" → "Share"
- B.4 e2e QA results (verified via headless Chromium at /career-canvas + home + voice lifecycle)

## Reviewer's verdict: **PARTIAL pass — 3 blockers**, then resolved this iteration.

## Findings + resolution

### CRITICAL (resolved)
| # | Finding | Resolution |
|---|---|---|
| C1 | Hardcoded demo artifacts in ArtifactsPanel (`resume.pdf 2.4 MB`, `career-path-front-office.png`, `improved-resume.pdf`) — Tier-3 leak in OSS Tier 1, same category as the "Share with Sandals" copy that just got fixed | **Stripped all hardcoded demo content.** ArtifactsPanel now ships an empty-state by default with a teal-tinted FileText icon, "No artifacts yet" headline, and "Conversation artifacts will appear here as the assistant generates them or you upload files" sub-copy. M2 wires the real artifacts store. Demo fixtures move to `examples/` per the web-components rule §7 when needed for marketing. |

### WARNING (resolved)
| # | Finding | Resolution |
|---|---|---|
| W1 | VoiceWidget error state has no retry affordance — only recovery is page refresh (Krug-tier failure) | Added "Try again" text button below the visualizer that calls `live.start()` directly. Inline `AlertCircle` icon (lucide, 14px, same red) converts the red color from "noise" to semantic alert signal. |
| W2 | `aria-live="polite"` is wrong for errors — gets queued behind in-flight speech | Split: errors now use `role="alert" aria-live="assertive"` (interrupt). Non-error transitions stay `role="status" aria-live="polite"`. |
| W3 | Hardcoded `#0D7377` focus ring (Sandals teal) inside Tier-1 OSS — not tokenized, brand-tied | Tokenized: focus ring + retry button text use `var(--landi-color-primary, #0D7377)` cascade. Sandals supplies the teal via brand token; non-Sandals embeds pick up their own accent without forking. ArtifactsPanel empty-state icon uses the same cascade with `color-mix(in srgb, var(--landi-color-primary) 8%, transparent)` for the tinted background. |

### NIT (deferred)
| # | Finding | Reason |
|---|---|---|
| N1 | "Share" label still ambiguous (could read as "social share") — recommend "Send to recruiter" + label config | Tracked. Requires a `labels` config object on `CanvasPersona` — meaningful surface, defer to a dedicated copy-tokens iteration. |
| N2 | One corporate-speak line in greeting: "I'm grounded in real Sandals career data" | Voice copy lives in `sandals/career-canvas/voice/systemPrompt.ts`. Tracked for Sandals brand-voice copy review. |
| N3 | VoiceWidget visualizer bars still use hardcoded `bg-[#0D7377]` / `bg-[#C9A227]` / `bg-[#EF4444]` | Tokenize alongside the broader 9-hex sweep in M2. |

## B.4 E2E QA — PASSED
| Criterion | Result |
|---|---|
| /career-canvas full-page mount | ✅ Title set, canvas root, kernel installed, snapshot stable, Sandy header + 4 prompts |
| Voice mock lifecycle | ✅ idle → speaking (Sandals greeting from scenario) → mid-call (levels animating, 0.64 → 0.36) → stop → idle |
| Home page scroll | ✅ overflow visible, scrollHeight 11938, agent section anchored |
| Hero button → kernel | ✅ Click → kernel `speaking` + page scrolls to canvas (scrollY 9997) |
| Console errors | ✅ Zero across all flows |
| Tests | ✅ 40/40 passing across 6 suites |

## Brand-voice grade
**PASS with NIT.** Sandy's greeting reads as voice ("What pulled you toward working with Sandals today?") not slop. One corporate-speak seam noted (above N2).

## Verification post-fix
- Tests: 40/40 passing
- Browser: kernel installed, idle state, zero console errors, ArtifactsPanel renders empty state

## Status
DONE — 1 CRITICAL + 3 WARNINGs resolved. 3 NITs deferred with rationale (label-config refactor, brand-voice copy review, broader token sweep).

## M1 acceptance: PASS
All 3 reviewer-flagged blockers resolved this iteration. M1 ready to ship.
