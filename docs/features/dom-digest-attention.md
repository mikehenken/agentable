---
lrn: lrn::en:platform:agentable-canvas.feature.dom-digest-attention::doc
related_docs:
  - docs/features/dom-workspace-engine.md
  - docs/features/digest-drawing-integration.md
changelog:
  - date: 2026-07-21
    summary: Digest attention mapped from DOM tab/region visibility, capped by live browser tab-focus and document-visibility signals.
---

# DOM digest attention visibility

Maps DOM workspace tab and region visibility into the three-tier workspace digest attention model (`focused`, `visible`, `background`).

## Visibility ladder

| DOM state | Digest tier |
|-----------|-------------|
| Active tab in `main` region | `focused` |
| Selected panel (selection changed) | `focused` |
| Active tab in open `sidebar` drawer | `visible` |
| Inactive tab in a visible region | `background` (tabbed-hidden) |
| Panel in collapsed sidebar drawer | `background` (closed) |

## Browser signal capping

The DOM-derived tier above is not the final tier. Live browser tab-focus and document-visibility signals cap it before it reaches the digest. Ordering, highest to lowest: `focused` > `visible` > `background`.

| Browser signal | Effect on tier |
|-----------------|----------------|
| `documentVisibility: 'hidden'` (tab switched away or minimized) | Caps every panel at `background`, regardless of DOM state |
| `windowFocused: false` with the document still visible (OS focus moved to another application) | Caps `focused` down to `visible` |
| Document visible and window focused | DOM-derived tier passes through unchanged |

These signals come from `BrowserAttentionSignalController`, a Lit `ReactiveController` that tracks `document.visibilitychange` and window `focus`/`blur` and requests a host update whenever the composited signals change.

## Module map

- `src/engines/dom/digestAttention.ts` - classification, tier mapping, digest context builder, browser-signal capping
- `src/engines/dom/browserAttentionSignalController.ts` - `BrowserAttentionSignalController`, a Lit `ReactiveController` tracking window focus/blur and document visibility
- `src/engines/dom/engine.ts` - `getDigestCompilerInput`, `getSelectedPanelIds`, viewport visibility ratios

## Host integration

DOM engine handles expose:

```typescript
engine.getDigestCompilerInput({ id: userId, name });
engine.getSelectedPanelIds;
engine.getViewportInfo; panelVisibility 1 = active tab in visible region
```

Hosts wire `resolveDigestInput` on `createAgentRuntime` by merging agents/activity with `engine.getDigestCompilerInput(...)`.

## Tests

- `tests/unit/domDigestAttention.test.ts` - tier derivation, context aggregation, engine alignment, browser-signal capping
- `tests/unit/browserAttentionSignalController.test.ts` - controller lifecycle, initial signal read, focus/blur and visibilitychange handling, host update requests
