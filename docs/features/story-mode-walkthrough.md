---
lrn: lrn::en:platform:agentable-canvas.feature.story-mode-walkthrough::doc
related_docs:
  - docs/features/drawing-tools-provenance.md
  - docs/features/communicative-visuals-auto-layout.md
changelog:
  - date: 2026-07-21
    summary: present_walkthrough tool, camera queue runner, narration emit, user cancel.
---

# Story mode walkthrough 

Agents narrate multi-scene stories with `present_walkthrough`. Each step targets a panel id, frame or shape id, or an array of shape ids. Camera moves queue through the P6 politeness queue (`src/agents/camera.ts`). User camera input cancels instantly; the camera is never locked.

## Tool contract

`present_walkthrough({ steps: [{ target, say?, dwellMs? }] })`

| Field | Description |
|-------|-------------|
| `target` | Panel id string, frame or shape id string, or array of shape ids |
| `say` | Optional narration emitted to chat or voice via AG-UI state patch |
| `dwellMs` | Optional pause before the next scene (default 1500 ms) |

## Module map

- `src/agents/walkthroughRunner.ts` step runner and cancellation
- `src/agents/walkthroughBridge.ts` runtime binding for tools
- `src/agents/tools/walkthroughTools.ts` `present_walkthrough` handler
- `src/engines/tldraw/walkthrough/walkthroughCameraApi.ts` tldraw target resolution and camera apply
- `src/engines/tldraw/WhiteboardShell.tsx` binds walkthrough when a host camera queue is present

## Tests

`tests/unit/storyModeWalkthrough.test.ts` covers camera queue integration, narration emit, user-input cancellation, capability gating, and tool registration.
