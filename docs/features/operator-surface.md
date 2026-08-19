---
lrn: lrn::en:platform:agentable-canvas.feature.operator-surface::doc
related_docs:
  - docs/features/a2ui-ingestion-adapter.md
  - docs/features/embed-widgets-family.md
changelog:
  - date: 2026-07-24
    summary: — gallery resizable chrome keeps whiteboard/placement nodes connected during reparent; whiteboard reconnect remount; draw fail-closed when whenReady false or shape count unchanged; offline draw fallback when live chat enabled but whiteboard not ready.
  - date: 2026-07-23
    summary: gallery example `13-canvas-wide-agent` — Meridian Labs open canvas with dock-inside + floating operator placements; embed bundles `agentable-operator-surface.js` and `agentable-operator-surface-placement.js`.
  - date: 2026-07-23
    summary: voice off-by-default — `<agentable-whiteboard>` and `<agentable-panel>` embed surfaces default `voiceEnabled` to false; hosts opt in via `voice-enabled` attribute or config JSON.
  - date: 2026-07-23
    summary: multi-agent registration — operator registers alongside scoped agents with canvas-wide lease, agent-scoped mode enforcement, and per-agent HITL/activity attribution.
  - date: 2026-07-23
    summary: four operator surface placements — dock-inside, dock-outside, slot, floating via shared page session; typed mount/interaction events.
  - date: 2026-07-22
    summary: model switcher rebind — operator surface binds session via operatorModelBridge; capability-aware disabled options; server-side rebind on switch.
  - date: 2026-07-22
    summary: iteration 2 — chat/voice `canvasTools.executeTool` and model tool offers respect operator mode when bridge bound; build mode deny-by-default for unknown host tools.
  - date: 2026-07-22
    summary: operator mode tool-scope enforcement — Ask/Build/Draw presets enforced at runtime via tool executor.
  - date: 2026-07-22
    summary: operator Lit surface — tabbed threads, mode/model shells, A2UI transcript blocks.
---

# Canvas-wide operator surface 

Optional canvas-wide operator agent UI. A Lit web component with tabbed conversation threads, Ask/Build/Draw mode selector with **runtime-enforced** tool-scope presets, ** model switcher with server-side rebind**, and A2UI-rich transcript messages rendered through the P10 ingestion adapter.

## Element

```html
<script type="module" src="/path/to/agentable-operator-surface.js"></script>
<agentable-operator-surface
  mode="ask"
  model="default"
  active-thread-id="thread-main"
></agentable-operator-surface>
```

Import for in-repo hosts and tests:

```ts
import 'agentable-canvas/src/agents/surface/operator-surface';
```

## API

| Attribute property | Description |
|---------------------|-------------|
| `mode` | `ask` \| `build` \| `draw` — tool-scope preset; enforced at runtime when the surface is mounted |
| `model` | Opaque model alias for the switcher; rebinds the operator session when a host resolver is registered |
| `model-options` | JSON array of `{ alias, label }` options; ineligible aliases render `disabled` per session `requiredCaps` |
| `active-thread-id` | Id of the visible thread tab |
| `threads` | Host-controlled thread list (property, not reflected) |
| `setThreads(threads)` | Imperative thread replacement |

## Events

| Event | Detail |
|-------|--------|
| `landi:operator-thread-changed` | `{ threadId, previousThreadId }` |
| `landi:operator-mode-changed` | `{ mode, previousMode }` |
| `landi:operator-model-changed` | `{ modelAlias, previousModelAlias, resolvedAlias?, fallbackUsed? }` |

All events bubble and are `composed: true`. Mode changes sync to the runtime enforcement layer (`operatorModeBridge`) while the surface is connected. Model changes rebind the operator session through `operatorModelBridge` when `host.agents.registerModelResolver` is active — aliases stay opaque; provider ids resolve only server-side.

## Mode tool-scope 

| Mode | Allowed | Blocked |
|------|---------|---------|
| **Ask** | Read Q&A tools (`list_panels`, drill-downs, `read_canvas`, `knowledge_search`, …) | Panel mutations, draw, walkthrough |
| **Build** | Ask tools + structural/build tools (`fill_panel`, `patch_panel`, authoring toolkit, …) | Draw-only tools (`draw_shapes`, `present_walkthrough`, …) |
| **Draw** | All tools at operator scope | — (engine `capabilities.draw` gate still applies) |

Enforcement runs in `createAgentToolExecutor` and in `canvasTools.executeTool` when the **acting agent id is `operator`** (`OPERATOR_AGENT_ID`). Scoped page agents on the same session are not gated by operator Ask/Build/Draw mode. Denied operator calls return `SCOPE_DENIED` and log `operator_mode_scope_denied` activity on the executor path.

Gallery scripted demos (`galleryScriptedDemo.ts`) invoke tool handlers directly for offline northstar fixtures; that path is documented and does not participate in operator-mode enforcement.

## Model switcher 

When a host registers `registerModelResolver`, the operator surface binds an operator agent session (`OPERATOR_AGENT_ID`) on connect via `operatorModelBridge`. Selecting a model:

1. Calls `AgentSession.rebindModel(alias)` through the registered resolver (host boundary — no client API keys).
2. Dispatches `landi:operator-model-changed` with `resolvedAlias` and `fallbackUsed` when resolution succeeds.
3. Disables switcher options that cannot satisfy `DEFAULT_OPERATOR_REQUIRED_CAPS` (`tools: true`).

Without a registered resolver the switcher remains a UI shell (events only) for offline demos.

**Security:** `operatorModelBridge` and the Lit surface import no provider SDKs or key env vars. G3 proof: `tests/unit/operatorModelG3Boundary.test.ts` plus embed bundle grep when `dist/embed/*` is built.

## A2UI transcript

Messages with `kind: 'a2ui'` carry ordered `A2UIEnvelope[]` payloads. The Lit surface ingests them through the pipeline (`a2uiTranscriptLite.ts`) and renders header/list blocks in the transcript. React hosts may use `OperatorA2UITranscript` for full `SpecRenderer` output.

## Session

On connect the element joins `window.__agentablePageSession__` and registers as a chat surface participant, matching other embed surfaces. It also registers the canvas-wide operator agent in `host.agents.registry` via `operatorRegistrationBridge`: stable id `operator`, scope `canvas:operator`, mode-derived tool allow-list, and an advisory canvas-wide lease while connected.

## Multi-agent registration 

The operator agent coexists with scoped page agents (Meridian, multi-agent editor/concierge, etc.) on one page session:

| Concern | Operator (`operator`) | Scoped agents (e.g. `editor`, `meridian`) |
|---------|----------------------|-------------------------------------------|
| Registry scope | `canvas:operator` | Panel/slot allow-lists |
| Mode enforcement | Ask/Build/Draw allow-lists | Role allow-lists only |
| HITL queue | `getPendingForAgent('operator')` | Per-agent slices unchanged |
| Activity attribution | `actor: agent:operator` | `actor: agent:<id>` |
| Lease | Advisory `canvas:operator` TTL | Panel/source scopes |

`createCanvasHost` wires `setOperatorRegistrationRuntime(host.agents)` so the Lit surface can register/unregister without breaking scoped agents on disconnect.

## Placements 

Four host placements mount `<agentable-operator-surface>` through the placement wrapper. All instances join the shared page session (`window.__agentablePageSession__`).

| Placement | Host pattern | CSS anchor |
|-----------|--------------|------------|
| `dock-inside` | Panel docked inside canvas chrome | Fills parent flex region inside canvas boundary |
| `dock-outside` | Side rail outside canvas viewport | Fixed-width column with left border |
| `slot` | Named page slot (`slot-name`) | Fills registered slot mount element |
| `floating` | Overlay CTA drawer | Fixed bottom-right panel with shadow |

```html
<script type="module" src="/path/to/agentable-operator-surface-placement.js"></script>

<agentable-operator-surface-placement
  placement="dock-inside"
  placement-id="operator-main"
></agentable-operator-surface-placement>

<agentable-operator-surface-placement
  placement="slot"
  slot-name="operator-sidebar"
></agentable-operator-surface-placement>

<agentable-operator-surface-placement placement="floating"></agentable-operator-surface-placement>
```

Import for in-repo hosts and tests:

```ts
import 'agentable-canvas/src/agents/surface/operator-surface-placement';
```

### Placement events

| Event | Detail |
|-------|--------|
| `landi:operator-placement-mounted` | `{ placement, placementId, pageSessionId, slotName? }` |
| `landi:operator-placement-interacted` | `{ placement, placementId, pageSessionId, interactionKind, slotName? }` |

`interactionKind` is `focus` or `pointerdown`. Events bubble and are `composed: true`.

## Scope notes
- Mode tool-scope enforcement — ** (done)**
- Model resolver rebind — ** (iteration 1, pending security review)**
- Placement (`dock-inside`, `dock-outside`, `slot`, `floating`) — ** (iteration 1, pending review)**
- Multi-agent registration — ** (iteration 1, pending review)**
- Gallery example `13-canvas-wide-agent` — ** (iteration 1)**
- Voice off-by-default on embed surfaces — ** (iteration 1, pending review)**

## Voice default 

Embed surfaces (`<agentable-whiteboard>`, `<agentable-panel>`) ship with **`voiceEnabled: false`** in `DEFAULT_CONFIG`. Voice widgets and Gemini Live tooling activate only when a host opts in:

```html
<agentable-whiteboard voice-enabled config-url="/config/with-voice.json"></agentable-whiteboard>
```

```json
{ "voiceEnabled": true }
```

Tenant packs and gallery configs that set `"voiceEnabled": true` explicitly are unchanged. `<agentable-canvas>` retains its prior default (`true`) for full-canvas hosts that expect voice on first paint.

## Tests

- `tests/component/operator-surface-placement.test.ts` — four placements mount + typed events + shared session
- `tests/component/agentable-operator-surface.test.ts` — tab switching, A2UI render, mode/model events, Ask-mode mutation denial, rebind + disabled options
- `tests/unit/operatorModeScope.test.ts` — scope classification and executor integration
- `tests/unit/operatorModelBridge.test.ts` — bind/rebind and capability gating
- `tests/unit/operatorModelG3Boundary.test.ts` — no client keys in bridge modules embed bundles
- `tests/integration/operatorModelRebind.test.ts` — bind + rebind sequence
- `tests/integration/operatorMultiAgentRegistration.test.tsx` — operator + scoped agent coexistence, attribution, leases, HITL
- `tests/integration/operatorModeChatPath.test.ts` — agent-scoped chat path coexistence
