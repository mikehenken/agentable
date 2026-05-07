# M2 Wave 2 — Labels Wiring + Theming Docs (2026-04-25)

Single code-reviewer. NO SELF-REVIEW.

## Surface reviewed
- `CanvasContext.tsx` — labels merge added (4 deps, total now 11)
- `ArtifactsPanel.tsx` — empty state reads from `labels.emptyArtifacts/Hint`
- `ChatPanel.tsx` — send button `aria-label` reads from `labels.sendMessage`
- `index.css` — token grouping comments (Brand / Surfaces / Text / Status)
- `EMBEDDING.md` — full Theming section appended (13-token reference, override examples, labels config example)
- `docs/status/token-sweep-inventory.md` — bounded inventory of remaining hex literals (parallel work this iteration)

## Findings + resolution

### CRITICAL (resolved)
| # | Finding | Resolution |
|---|---|---|
| C1 | EMBEDDING.md "Acme Corp dark-theme" example would silently break — 162 hardcoded Tailwind gray classes inside panels don't consume the canvas's text/surface tokens | Replaced with a LIGHT-theme Acme example (purple primary, orange accent, light workspace). Added an explicit ⚠️ block explaining the dark-theme limitation, pointing to `token-sweep-inventory.md` for the M3 follow-up. Honest now: embedders can override brand + workspace tokens; full dark-theme requires the panel-level token migration tracked under M3. |

### CRITICAL (false alarm)
| # | Finding | Verdict |
|---|---|---|
| C2 | `<CanvasShell config={...}>` API doesn't match — prop "lives on `<CanvasProvider>`" | Reviewer misread. `CanvasShell.tsx` exports `CanvasShellProps` with `config?: PartialCanvasTenantConfig`; the implementation wraps `<CanvasProvider>` internally. Docs are correct. |

### WARNING (resolved)
| # | Finding | Resolution |
|---|---|---|
| W3 | ArtifactsPanel duplicate announcement: `aria-label={labels.emptyArtifacts}` + visible `<p>` with same text → screen readers announce "No artifacts yet" twice | Dropped the `aria-label` from the container. `role="status"` reads the visible `<p>` as a live region; one announcement source. Comment added explaining why. |
| W5 | `DEFAULT_TENANT_CONFIG.labels` is `Required<CanvasLabels>` only by accident of the merge filling all fields. Future field additions wouldn't fail at the merge site | Added `satisfies Required<CanvasLabels>` to the inline labels object so missed fields fail at compile time at the merge site, not at runtime. |

### WARNING (deferred)
| # | Finding | Reason |
|---|---|---|
| W4 | 11-dep memo + `mockScenario` is an object reference (could thrash if tenant inlines the scenario object on every render) | Tracked. Today Sandals' `<CareerCanvas>` imports `sandalsConversationScenario` once at module top-level — reference is stable. A doc-warn comment + section-nested memos for >13 deps would be the cleanup. |

### NIT (resolved)
| # | Finding | Resolution |
|---|---|---|
| N6 | index.css half-grouped (Brand/Surfaces/Text/Status grouped; Radii/Shadows/Spacing/Typography ungrouped) | Added `/* --- Radii --- */`, `/* --- Shadows --- */`, `/* --- Spacing --- */`, `/* --- Typography --- */` headers for parity. |

### NIT (false alarm)
| # | Finding | Verdict |
|---|---|---|
| N7 | EMBEDDING.md selector `.agentable-canvas-root` not applied anywhere | Class IS applied in `CanvasShell.tsx:67` on the root div. Documented selector is valid. |

### Parallel work landed this iteration
- **`docs/status/token-sweep-inventory.md`** — bounded inventory of the remaining ~40 hex literals across canvas source. Tier-A (must extract before OSS publish), Tier-B (Tailwind grayscale, leave), Tier-C (Sandals-specific, audit), Tier-D (already tokenized). Adds a clear M3 work plan: ~half-day mechanical sweep to reach 0 brand-tied raw hexes outside `var(...)` calls.

## Verification
- 41/41 tests passing
- Browser: kernel installed, ChatPanel renders, 4 prompts visible, send button `aria-label="Send message"` reads from labels, zero console errors
- `dist/styles.css` rebuilt; tokens cascade correctly

## Status
DONE — 1 CRITICAL + 2 WARNINGs + 1 NIT resolved. 1 WARNING deferred (memo dep churn — speculative). 2 false alarms documented.
