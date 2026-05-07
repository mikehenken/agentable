# Session Checkpoint — Ralph-Loop Iteration 2026-04-25

> Snapshot of work shipped in a single Ralph loop pass. Use to resume.

## Headline

The OSS canvas (`agentable-canvas`) is now fully tenant-agnostic. Sandals brand voice (system prompt, voice greeting, "Sandy", "Career Concierge", starter prompts) lives in `@sandals/career-canvas`. The website mounts `<CareerCanvas>` in pure-React mode (no Shadow DOM). Tailwind utilities resolve correctly. Voice CTAs across nav + hero share kernel state. All phases agent-reviewed (no self-review) with iteration before completion.

## Phases shipped this session

1. **Track A.7 — Pure-React canvas (mode C)** — new `agentable-canvas/react-canvas` export with `<CanvasShell>`, `<CanvasProvider>`, `useCanvasConfig`. Persona injected via React context.
2. **Architecture refactor — `<CareerCanvas>` wrapper** — new `@sandals/career-canvas/react` export wraps `<CanvasShell>` with Sandals brand defaults. Tier-1 OSS no longer reaches into Tier-3 Sandals.
3. **Track B.1 v1** — website pages (`CareerCanvasPage`, `CareerConciergeCanvasSection`) consume `<CareerCanvas>` instead of the Lit shell. Killed Tailwind-in-Shadow-DOM problem entirely.
4. **Track B.2 — Voice-call buttons via `useVoiceCall`** — Sandals nav (desktop + mobile) and hero CTAs subscribe to the kernel. Hook PROMOTED into OSS canvas (`agentable-canvas/react-canvas`). Sandals' local hook is now a 1-line re-export.
5. **Kernel stability fix** — added `voice.getSnapshot()` returning a referentially-stable frozen reference, replaced (not mutated) on `_publish`. Required for `useSyncExternalStore` correctness.
6. **ChatPanel Tier-3 de-tenanting** — `assistantName`, `tenantTitle`, `starterPrompts` all injected via context. OSS canvas core has zero Sandals strings.
7. **Track A.1 W9** — `VoiceState` deduplicated; `geminiLiveClient.ts` imports from kernel.
8. **MILESTONES.md** — created at `agentable-canvas/docs/MILESTONES.md`.

## Agent-to-agent reviews (no self-review, iterated)

### Track A.7 + architecture refactor + B.1 v1
4 parallel reviewers (architect, code-reviewer, chief-ux-ui, test-automator).
- **3 CRITICAL resolved:** memo CanvasProvider value, TopBar logo/title overlap (Tailwind content path fix), marketing-section sticky-nav overlay (scroll-mt)
- **5 WARNINGs resolved:** de-Sandalsified OSS defaults, fixed `_renderReact` persona type cast, added `assistantName` to persona, `JSX.Element` → `ReactElement` consistency, `PartialCanvasTenantConfig` deep-partial type
- **Report:** `agentable-canvas/docs/reviews/2026-04-25-trackA7-careercanvas-review.md`

### Track B.2 — useVoiceCall hook
2 parallel reviewers (architect, code-reviewer).
- **2 CRITICAL resolved:** module-scoped cache → kernel-stable getSnapshot; subscribe-time seeding → kernel owns it
- **1 HIGH resolved:** hook promoted from Sandals → OSS so other consumers don't reinvent
- **4 WARNINGs resolved:** `available` gating, exhaustive `defaultVoiceLabel` switch, `aria-live` status region, drop muddy `aria-pressed` for explicit `aria-label`
- **Report:** `agentable-canvas/docs/reviews/2026-04-25-trackB2-voicecall-hook-review.md`

## Browser verification checkpoints

Captured during the loop:
- `localhost:5180/career-canvas` — full canvas renders, TopBar text dark gray, ChatPanel "Hi, I'm Sandy", 4 brand-voiced starter prompts, no console errors
- `localhost:5180/` (marketing section) — section anchor lands below sticky nav, embed canvas fully visible
- Kernel `getSnapshot()` returns referentially-stable refs (verified `a === b` in browser)
- Click flow: nav button → kernel → `useGeminiLive` impl → no API key → kernel `error` → button gracefully `disabled`

## What's next (priority order for next loop)

1. **Track A.2 — Test infrastructure** (Vitest + @open-wc/testing + Playwright). Top test from test-automator: persona end-to-end integration test (`<CareerCanvas>` → `<CanvasShell>` → `<VoiceWidget>` → `useGeminiLive` → mock client config assertion).
2. **Track D — Mock mode** (`MockGeminiLiveClient` + scenarios in `sandals/career-canvas/scenarios/`). Required for offline / no-API-key dev. Wires natural test seam.
3. **Track A.3 — Bundle budget + pre-built `dist/styles.css`**. Canvas embed bundle is 203KB, target 80KB. Code-splitting + UMD.
4. **Track A.4 — 10-section READMEs** for `<agentable-canvas>` and `<voice-call-button>`. Required per `web-components-ui.md` rule §13 for OSS publishing.
5. **Track A.1 — remaining cosmetic WARNINGs**: W5 (useGeminiLive stable refs), W6 (public/internal type split), W10 (legacy event comment).
6. **Cleanup orphans** — `sandals-canvas/app/` is the pre-migration backup; safe to delete now that A.7 + B.1 v1 are verified.
7. **Track C — OSS bridge library** — Opus Max architecture pass (HITM gate; awaits user model switch).

## Known follow-ups deferred (non-blocking)

- 9 brand hexes hardcoded across canvas + section — extract to CSS custom properties (full token sweep)
- "Mock concierge" disclaimer placement — lives until M3 wires real CopilotKit
- Pre-built `dist/styles.css` so non-Sandals hosts don't need matching Tailwind config
- Mic icon level reactivity (UX polish — currently only `animate-ping` on `isActive`)
- Add `agentable-canvas/voice` subpath for kernel-only access (decouple from `react-canvas`)

## File map

See `agentable-canvas/docs/MILESTONES.md` for the canonical file map.

## How to resume

```bash
# 1. Dev server
cd ~/Projects/landi/sandals/sandals/website && npm run dev -- --port 5180

# 2. Open
http://localhost:5180/career-canvas      # full-page canvas
http://localhost:5180/#agent             # embedded section

# 3. Verify nothing broke
B=~/.claude/skills/gstack/browse/dist/browse
$B goto http://localhost:5180/career-canvas
$B js "JSON.stringify({state: window.__voiceKernel__.voice.state, snapStable: window.__voiceKernel__.voice.getSnapshot() === window.__voiceKernel__.voice.getSnapshot()})"
# expected: {"state":"idle","snapStable":true}
```
