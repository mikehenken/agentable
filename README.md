# agentable-canvas

> An embeddable AI canvas: chat panel, draggable workspace, voice transport (Gemini Live), and a Lit web component shell.
>
> Drop one tag into any page. Works in React 18/19, Vue, Angular, plain HTML, WordPress.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 1. Quick start

### 1a. Lit web component (any framework, ~10 lines)

```html
<agentable-canvas
  tenant="my-co"
  primary-color="#3B82F6"
  welcome-message="Hi! How can I help?"
  voice-enabled
  snap-grid
></agentable-canvas>
<script src="https://cdn.example.com/agentable-canvas/v1/agentable-canvas.js"></script>
```

### 1b. Pure React (single React copy, no Shadow DOM, smaller bundle)

```tsx
import { CanvasShell } from 'agentable-canvas/react-canvas';
import 'agentable-canvas/styles.css';

export default function Page() {
  return (
    <CanvasShell
      config={{
        tenant: 'my-co',
        persona: {
          systemPrompt: 'You are a helpful assistant.',
          voiceGreeting: 'Hi! How can I help?',
          assistantName: 'Riley',
          tenantTitle: 'Concierge',
        },
      }}
    />
  );
}
```

### 1c. React wrapper (camelCase props + typed events, double React tax)

```tsx
import { AgentableCanvas } from 'agentable-canvas/react';

<AgentableCanvas
  tenant="my-co"
  primaryColor="#3B82F6"
  welcomeMessage="Hi! How can I help?"
  voiceEnabled
  snapGrid
/>
```

## 2. Full config schema

### Lit element attributes / React `<AgentableCanvas>` props

| Attribute | Prop (React) | Type | Default | Status | Description |
|---|---|---|---|---|---|
| `tenant` | `tenant` | string | `"default"` | wired | Tenant identifier surfaced in telemetry. Forwarded to React via context. |
| `primary-color` | `primaryColor` | string | `"#3B82F6"` | wired | Sets `--landi-color-primary` AND `--landi-color-primary-hsl` on the host (dual-form sync via `hexToHslComponents`, M2.5/M2.6). Falls back to `console.warn` if value is not a valid `#RGB`/`#RRGGBB` hex. |
| `system-prompt` | (via React props) | string | `""` (= context default) | wired | Voice model system instruction. Empty = use library default persona. |
| `voice-greeting` | (via React props) | string | `""` (= context default) | wired | Optional opening line on call start. |
| `welcome-message` | `welcomeMessage` | string | `"Hi! How can I help?"` | reserved (M2) | Will drive ChatPanel empty-state heading. Currently the heading is derived from `assistantName` instead. |
| `api-endpoint` | `apiEndpoint` | string | `"/api"` | reserved (M3) | Backend base URL for CopilotKit runtime + file uploads. |
| `voice-enabled` | `voiceEnabled` | boolean | `true` | reserved (M2) | Will gate voice UI render. Today voice is always shown. |
| `snap-grid` | `snapGrid` | boolean | `true` | reserved (M2) | Will toggle 8px grid snap on dragged panels. Today snap is fixed-on. |

### Pure-React `<CanvasShell>` config

`config?: PartialCanvasTenantConfig` — deeply partial, all fields optional. Defaults shown:

```ts
{
  tenant: 'default',
  persona: {
    systemPrompt: 'You are a friendly, helpful assistant. ...',
    voiceGreeting: undefined,
    assistantName: 'Assistant',
    tenantTitle: 'AI Assistant',
    starterPrompts: [],
    mockScenario: undefined,
  },
}
```

## 3. Events

All events are `CustomEvent`s with `bubbles: true, composed: true` so they cross the Shadow DOM boundary.

| Event | Payload | Trigger |
|---|---|---|
| `landi:voice-start-requested` | (no `detail`) | `element.startVoiceCall()` invoked |
| `landi:voice-end-requested` | (no `detail`) | `element.endVoiceCall()` invoked |
| `landi:voice-started` (window) | `{ sessionId: string, timestamp: string }` | First time kernel transitions to `listening` after `connecting` |
| `landi:voice-ended` (window) | `{ sessionId: string, durationMs: number, transcript: string, timestamp: string }` | Kernel returns to `idle` after a session |
| `landi:call-started` (`<voice-call-button>`) | `{ timestamp: string }` | Kernel transitions `connecting → listening` |
| `landi:call-ended` (`<voice-call-button>`) | `{ timestamp: string }` | Kernel transitions any non-idle → `idle` |
| `landi:call-state-changed` (`<voice-call-button>`) | `{ state: VoiceState, level: number, timestamp: string }` | Any kernel snapshot change (state OR level) |
| `landi:call-error` (`<voice-call-button>`) | `{ message: string, timestamp: string }` | Kernel transitions to `error` |

> Voice transport state also lives on `window.__voiceKernel__.voice` — see §4.

## 4. JS API

### `<agentable-canvas>` Lit element methods

```ts
element.startVoiceCall(): void   // dispatches landi:voice-start-requested
element.endVoiceCall(): void     // dispatches landi:voice-end-requested
```

### `window.__voiceKernel__.voice` (singleton; installed by canvas mount)

```ts
interface VoiceController {
  state: VoiceState;             // 'idle' | 'connecting' | 'listening' | 'speaking' | 'error'
  level: number;                 // 0..1, current input/output amplitude
  lastTranscript: string;
  errorMessage: string | undefined;
  start(): Promise<void>;
  stop(): Promise<void>;
  toggle(): Promise<void>;
  getSnapshot(): VoiceKernelSnapshot;  // referentially-stable; safe for useSyncExternalStore
  subscribe(fn: (snap: VoiceKernelSnapshot) => void): () => void;
}
```

### React hook

```tsx
import { useVoiceCall, defaultVoiceLabel } from 'agentable-canvas/react-canvas';

function MyCTA() {
  const voice = useVoiceCall();
  return (
    <button onClick={voice.toggle} disabled={!voice.available}>
      {defaultVoiceLabel(voice.state, 'Talk')}
    </button>
  );
}
```

## 5. Brand tokens

CSS custom properties on the host element. Override at any level (host page, `<agentable-canvas>` element style, stylesheet).

Brand colors ship in TWO forms: a hex (`--landi-color-X`) for legacy/non-Tailwind consumers, and an HSL component triplet (`--landi-color-X-hsl`, format `H S% L%` with no `hsl(...)` wrapper) for Tailwind alpha-modified utilities like `bg-canvas-primary/30`. See `EMBEDDING.md` Theming section for the full rationale + override pattern.

```css
agentable-canvas, .agentable-canvas-root {
  /* Brand (alpha-aware via HSL companion) */
  --landi-color-primary: #0D7377;
  --landi-color-primary-hsl: 182 80% 26%;
  --landi-color-primary-hover: #095C5F;
  --landi-color-primary-hover-hsl: 182 83% 20%;
  --landi-color-primary-light: #14B8A6;
  --landi-color-primary-light-hsl: 173 80% 40%;
  --landi-color-primary-soft: #2DD4BF;
  --landi-color-primary-soft-hsl: 172 66% 50%;
  --landi-color-primary-tint: #E6F4F1;
  --landi-color-primary-tint-hsl: 169 39% 92%;
  --landi-color-accent: #C9A227;
  --landi-color-accent-hsl: 45 70% 47%;

  /* Surfaces */
  --landi-color-surface: #FFFFFF;
  --landi-color-surface-subtle: #F7F9F9;
  --landi-color-background: #F0F0EC;
  --landi-color-workspace-bg: #F5F5F2;
  --landi-color-workspace-dot: #D0D0CC;
  --landi-color-border: #E5E5E5;

  /* Text */
  --landi-color-text: #1A1A1A;
  --landi-color-text-secondary: #4B5563;
  --landi-color-text-muted: #9CA3AF;

  /* Status */
  --landi-color-success: #10B981;
  --landi-color-warning: #F59E0B;
  --landi-color-error: #EF4444;

  --landi-radius-sm: 8px;
  --landi-radius-md: 12px;
  --landi-radius-lg: 16px;
  --landi-radius-xl: 20px;

  --landi-shadow-sm: 0 1px 3px rgba(0,0,0,0.04);
  --landi-shadow-md: 0 4px 12px rgba(0,0,0,0.06);
  --landi-shadow-lg: 0 12px 40px rgba(0,0,0,0.08);

  --landi-space-unit: 8px;
  --landi-font-family: 'Inter', system-ui, sans-serif;
}
```

## 6. Parts

Exposed `::part()` selectors (Lit shell — none yet on the React canvas).

> M1 ships zero parts; the canvas's React internals are styled via the brand-token cascade. Parts will be added in M2 when consumers need to override specific subcomponents (e.g. ChatPanel header).

## 7. Slots

The Lit shell has no named slots in M1. All content is data-driven via attributes / React props.

## 8. Backend contract

### Voice transport — Gemini Live (real)

- **Model:** `gemini-3.1-flash-live-preview`
- **SDK:** `@google/genai` v1.50.1
- **Auth:** `import.meta.env.VITE_GEMINI_API_KEY` (dev). **Production must mint ephemeral tokens server-side** — raw keys in browser bundles are dev-only. See `src/canvas/voice/geminiLiveClient.ts:113`.

### Voice transport — Mock (offline / CI / no-key dev)

- Drops in automatically when no API key is set in dev (`MODE !== 'production'`).
- In production with no key: a `console.error` fires; the CTA disables. Set `VITE_LANDI_MOCK=1` to opt into mock prod-side.
- Custom scenarios via `persona.mockScenario` — see `src/canvas/voice/mockGeminiLiveClient.ts`.

### Chat — `aimock` (M1 placeholder)

ChatPanel currently selects from a small array of generic mock responses. M3 wires CopilotKit runtime — see [MILESTONES.md](docs/MILESTONES.md).

## 9. Browser support

- **Modern evergreens** — Chrome / Edge / Safari / Firefox latest 2 versions.
- **No IE / no legacy polyfills.**
- Uses: Web Components, Shadow DOM, `WebSocket`, `MediaStream`, `AudioWorklet`, `requestAnimationFrame`, `useSyncExternalStore` (React ≥18).
- Mobile: layout tested on viewports down to 375px. Voice requires HTTPS for `getUserMedia`.

## 10. Changelog

See [CHANGELOG.md](CHANGELOG.md) for the release history.

---

## Architecture

Three surfaces ship from this package:

```
agentable-canvas/
  ├── /react-canvas     ← <CanvasShell> + useVoiceCall (pure React)
  ├── /react            ← <AgentableCanvas> + <VoiceCallButton> wrapper (React over Lit)
  └── /embed            ← Lit web components (non-React hosts)
```

Tenant brand voice (system prompt, persona, scenarios, panel data) is **never** baked into the OSS core. Hosts inject via React context (`<CanvasProvider config={...}>`) or via attributes on the Lit element.

## License

MIT — see [LICENSE](LICENSE).

## Contributing

Issues and pull requests are welcome at https://github.com/mikehenken/agentable.

When contributing code, please:

- Match existing TypeScript / React / Lit patterns.
- Cover behavior changes with tests (`npm run test` for unit/integration, `npm run test:component` for the Lit shell, `npm run test:e2e` for end-to-end).
- Avoid baking tenant-specific content into the OSS core — keep example data generic.
