---
lrn: lrn::en:platform:agentable-canvas.embed.widgets-family::feature
related_docs:
  - docs/features/agentable-panel-single-element.md
  - docs/features/auto-mount-scan.md
  - docs/setup/whiteboard-embed.md
changelog:
  - date: 2026-07-21
    summary: widgets family — voice button, starter chip, ask-about-this, agent status pill; separate budgeted bundles.
---

# Embed widgets family 

 **widgets family**: small Lit embeds that join the shared page session and integrate with existing choreography buses (`voiceKernel`, `agentStatusKernel`, chat prompt dispatch).

## Members

| Element | Bundle (ESM) | Role |
|---------|--------------|------|
| `<voice-call-button>` | `dist/embed/voice-call-button.js` | Voice CTA; commands `window.__voiceKernel__` |
| `<agentable-starter-chip>` | `dist/embed/agentable-starter-chip.js` | Single starter prompt chip → chat handback |
| `<ask-about-this-button>` | `dist/embed/ask-about-this-button.js` | Contextual “ask about this” CTA |
| `<agent-status-pill>` | `dist/embed/agent-status-pill.js` | Read-only agent status badge |

Each widget is a **separate Vite library build** with declared gzip budgets enforced by `npm run check:bundle`.

## Shared session

All widgets call `bindWidgetPageSession` in `connectedCallback`, joining `window.__agentablePageSession__` with a unique `widget-*` participant id (same contract as `<agentable-panel>` `<agentable-whiteboard>`).

## Usage

```html
<script type="module" src="/embed/agentable-starter-chip.js"></script>
<agentable-starter-chip
  emoji="✨"
  label="Open roles"
  prompt="What roles are open right now?"
></agentable-starter-chip>

<script type="module" src="/embed/ask-about-this-button.js"></script>
<ask-about-this-button context="Royal Bahamian">Ask about this resort</ask-about-this-button>

<script type="module" src="/embed/agent-status-pill.js"></script>
<agent-status-pill agent-id="concierge"></agent-status-pill>

<script type="module" src="/embed/voice-call-button.js"></script>
<voice-call-button variant="nav">Talk with our AI</voice-call-button>
```

## Build

```bash
npm run build:embed:widgets # all four widget bundles
npm run check:bundle # gzip budget gate (when dist/embed exists)
```

## Source map

| Path | Purpose |
|------|---------|
| `src/embed/widgets/` | Lit widget implementations |
| `src/shared/agentStatusKernel.ts` | Agent status pub/sub for pills |
| `src/embed/widgets/widgetPageSession.ts` | Page session join helper |
| `src/embed/widgets/bundleBudgets.ts` | Declared budgets (mirrors CI script) |
| `vite.embed-widget-shared.ts` | Shared Vite lib config factory |

## Events

| Widget | Event |
|--------|-------|
| Starter chip | `landi:starter-chip-selected` |
| Ask-about | `landi:ask-about-selected` |
| Agent status pill | `landi:agent-status-changed` |
| Voice button | `landi:call-*` (existing) |

Chat-activating widgets dispatch `dispatchChatPrompt` (opens chat + inserts prompt).

## Bundle budgets (gzip)

| Artifact | Max |
|----------|-----|
| `voice-call-button.js` | 40 KB |
| `voice-call-button.umd.js` | 60 KB |
| `agentable-starter-chip.js` | 28 KB |
| `ask-about-this-button.js` | 28 KB |
| `agent-status-pill.js` | 28 KB |
| `*.umd.js` (non-voice) | 40 KB |
