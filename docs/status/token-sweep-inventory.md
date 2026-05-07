# Token-Sweep Inventory (M2 follow-up)

Architect-reviewer 2026-04-25: *"the unfinished ~60 hex literals and ChatPanel internal hexes are debt that needs an explicit M3 ticket with an inventory — without that, this becomes a 'perpetual partial.'"*

This is the inventory.

## Already extracted (M2 wave 1)

These tokens are declared on `:root, :host` in `src/index.css` and consumed via `var(--token, #fallback)`:

| Token | Default | Where consumed |
|---|---|---|
| `--landi-color-primary` | `#0D7377` | VoiceWidget bars (listening), ArtifactsPanel empty-icon, focus rings throughout |
| `--landi-color-primary-hover` | `#095C5F` | Primary hover states |
| `--landi-color-accent` | `#C9A227` | VoiceWidget bars (speaking) |
| `--landi-color-surface` | `#FFFFFF` | Panel backgrounds |
| `--landi-color-background` | `#F0F0EC` | Page surrounding the canvas |
| `--landi-color-workspace-bg` | `#F5F5F2` | CanvasShell working surface |
| `--landi-color-workspace-dot` | `#D0D0CC` | CanvasShell dot grid |
| `--landi-color-border` | `#E5E5E5` | Panel borders |
| `--landi-color-text` | `#1A1A1A` | Primary text |
| `--landi-color-text-secondary` | `#757575` | Sub-text |
| `--landi-color-text-muted` | `#9CA3AF` | Hints, timestamps |
| `--landi-color-success` | `#10B981` | Success states |
| `--landi-color-warning` | `#F59E0B` | Caution states |
| `--landi-color-error` | `#EF4444` | Error text + visualizer + destructive |

## Remaining hex literals (priority-ranked)

### Tier A — brand-tied, MUST extract before OSS publishing

These literal hexes carry brand meaning and are used in user-facing chrome. Any embedder who wants to retheme will need these tokenized.

| Hex | Usage | Files | Recommended token |
|---|---|---|---|
| `#1A1A1A` | Primary text in headings + chips | ChatPanel (lines 102, 122), CanvasShell, multiple panels (~14 occurrences) | `--landi-color-text` (already declared — just migrate usages) |
| `#0D7377` (raw, not in `var()`) | Stray gradient stops, ring colors not yet wrapped | ChatPanel:32 (avatar gradient stop), various hover states | `--landi-color-primary` |
| `#14B8A6` | Avatar gradient mid-stop (teal-light) | ChatPanel:32 (`linear-gradient`) | `--landi-color-primary-light` (NEW token) |
| `#2DD4BF` | Avatar gradient end-stop (mint) | ChatPanel:32 | `--landi-color-primary-soft` (NEW token) |
| `#E6F4F1` | Active-state pill backgrounds in TopBar | TopBar, multiple panel chrome (~10 occurrences) | `--landi-color-primary-tint` (NEW token) |
| `#F0F7F7` / `#F7F9F9` | Hover backgrounds, subtle surface tints | ChatPanel, panels | `--landi-color-surface-subtle` (NEW token) |

### Tier B — neutral grayscale, OK to leave as Tailwind utilities

These appear only inside Tailwind utility classes (`text-gray-700`, `bg-gray-100`) where Tailwind's own theme handles them. **Do not extract** — the gray scale is not a brand property; it's a system that Tailwind already manages and embedders override via Tailwind config if needed.

| Hex | Source |
|---|---|
| `#9CA3AF` (4 raw) | `text-[#9CA3AF]` arbitrary values — replace with `text-gray-400` (Tailwind built-in) |
| `#6B7280` (5 raw) | `text-[#6B7280]` — replace with `text-gray-500` |
| `#FAFAF8` (5 raw) | Subtle surface — defensible as `--landi-color-surface-faint` if needed |
| `#D1D5DB` (1 raw) | `border-[#D1D5DB]` — replace with `border-gray-300` |

### Tier C — Sandals-tenant-specific, should LEAVE Tier 1

These were originally in OSS canvas core but represent Sandals brand assets. Already audited:
- `#C9A227` (Sandals gold) — extracted to `--landi-color-accent`. Sandals supplies override; non-Sandals embeds get a generic accent.

### Tier D — semantic/error palette, already tokenized

| Hex | Token | Status |
|---|---|---|
| `#EF4444` | `--landi-color-error` | ✅ Mostly migrated; 2 raw occurrences remain in panels' destructive button hovers |
| `#10B981` | `--landi-color-success` | ✅ Tokenized; raw occurrences are inside Tailwind utilities like `text-green-500` (acceptable) |
| `#F59E0B` | `--landi-color-warning` | ✅ Tokenized; 4 raw occurrences in PDF icon SVGs (file-type icons — leave) |
| `#D97706` | (file-type icon stroke) | LEAVE — semantic file-icon coloring, not brand |
| `#6366F1` / `#4F46E5` (4+4) | (purple file icon for "AI-generated") | Tier C — only used in pre-rewrite ArtifactsPanel which has been deleted. Stale references in NavSidebar/etc. — verify removal |
| `#F43F5E` / `#E11D48` / `#BE185D` (2+2+1) | (red/pink semantic gradients) | Per-panel chrome decoration — Tier B |

## Recommended next iteration (M2.1)

1. **Migrate Tier-A occurrences** — replace `#1A1A1A` with `var(--landi-color-text, #1A1A1A)` everywhere (+14 sites)
2. **Add 4 new tokens for gradient stops + tints**: `--landi-color-primary-light` (#14B8A6), `--landi-color-primary-soft` (#2DD4BF), `--landi-color-primary-tint` (#E6F4F1), `--landi-color-surface-subtle` (#F0F7F7 / #F7F9F9)
3. **Replace Tier-B Tailwind-arbitrary-value hexes** with Tailwind utility classes (`text-gray-400` etc.). 14 sites, mechanical.
4. **Audit stale Tier-C purples** in NavSidebar / chrome panels — likely from the deleted ArtifactsPanel demo content references. ~8 sites.

**Estimated effort:** half-day mechanical sweep. **Outcome:** Tier 1 OSS canvas reaches 0 brand-tied hex literals outside `var(--token, ...)` calls.

## Won't extract

- Tailwind utility classes (`text-gray-700`, `bg-white`) that don't carry tenant brand
- File-type icon colors (PDF amber, image purple) — semantic, not brand
- Shadow values (`rgba(13,115,119,0.08)` etc. — would tokenize separately as `--landi-shadow-*` but defer to a focused shadow-token pass)
- One-off SVG path fills inside icon components

## Status

Documenting now (per architect-reviewer's M3 ticket request) so the work is bounded. Inventory will rebase when M2.1 lands.
