---
lrn: lrn::en:platform:agentable-canvas.feature.canvas-policy-merge::doc
related_docs:
  - docs/features/authoring-toolkit.md
  - docs/features/document-block-model.md
  - docs/development/agentable-panels/01-DECISIONS.md
changelog:
  - date: 2026-07-21
    summary: canvasPolicy merge module, open-canvas indicator, studio host open config.
---

# Canvas policy merge + open indicator 

Authoring policy knob for the open agent canvas. The framework default stays **`guarded`**; hosts opt into **`open`** through config (: landi-canvas-studio ships `open`).

## Policy shape

| Field | `guarded` default | `open` default |
|-------|-------------------|----------------|
| `preset` | `guarded` | `open` |
| `hitlOnCompose` | `true` | `false` |
| `autoPin` | `false` | `true` |
| `region` | `frame` | `unbounded` |
| `allowDelete` | `false` | `true` (agent-owned content only) |
| `toolset` | `draw` | `authoring-full` |
| `allowCodePreview` | `false` | `false` (P14 gate) |

Individual gates override the active preset after merge.

## Merge module 

Single entry: `src/config/merge.ts`

Precedence (later wins):

1. platform (framework `guarded`)
2. tenant (React host config-url)
3. agent (per-agent registry)
4. embed (element attributes)
5. runtime (`updateConfig`, model switcher, etc.)

React hosts pass tenant partials on `<CanvasProvider config={{ canvasPolicy: … }}>`.

## Open-canvas indicator

`OpenCanvasIndicator` renders a persistent badge when `canvasPolicy.preset === 'open'`. Mounted on `WhiteboardShell` (works when `hideTopBar` is true). Test id: `open-canvas-indicator`.

Hard boundaries unchanged under `open`: no untrusted code execution, no inline LLM markup, HITL on host-data mutations.

## Host defaults 

| Surface | `canvasPolicy` |
|---------|----------------|
| Framework helios archipelago | `guarded` (default) |
| landi-canvas-studio | `{ preset: 'open' }` via `src/lib/studio-canvas-policy.ts` → `CanvasHost` |

Studio e2e: `e2e/p12-open-canvas-indicator.spec.ts` (`@mock` path).

## Verification

```bash
npm run test -- --run tests/unit/canvasPolicyMerge.test.ts tests/unit/openCanvasIndicator.test.tsx
npm run lint
```
