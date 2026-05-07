# `<voice-call-button>`

> Standalone Lit web component that drives a voice call via the shared kernel. Subscribes to `window.__voiceKernel__.voice` and renders an animated state chip. Works without `<agentable-canvas>` in the page (kernel installed by either side).

## 1. Quick start

```html
<voice-call-button variant="hero">Talk to AI</voice-call-button>
<script src="https://cdn.example.com/agentable-canvas/v1/voice-call-button.js"></script>
```

The button registers itself, finds (or installs) `window.__voiceKernel__`, and dispatches `voice-start-requested` on click. If `<agentable-canvas>` is mounted on the same page, that canvas's `useGeminiLive` is already registered as the kernel impl — clicking the button starts/stops a real session.

## 2. Full config schema

| Attribute | Type | Default | Description |
|---|---|---|---|
| `variant` | `"nav" \| "hero"` | `"nav"` | Visual style preset. |
| `disabled` | boolean | `false` | Render as disabled regardless of kernel state. |

Slot the button label as text content:

```html
<voice-call-button variant="hero">Talk to Career Concierge</voice-call-button>
```

If you don't slot a label, the default text `"Talk with our AI"` is used.

## 3. Events

All events are `CustomEvent` with `bubbles: true, composed: true`.

| Event | Payload | Trigger |
|---|---|---|
| `landi:call-started` | `{ timestamp: string }` | Kernel transitions from `connecting` → `listening` (session open). |
| `landi:call-ended` | `{ timestamp: string }` | Kernel transitions from any non-idle state to `idle`. |
| `landi:call-state-changed` | `{ state: VoiceState, level: number, timestamp: string }` | Any kernel snapshot change (state OR level). |
| `landi:call-error` | `{ message: string, timestamp: string }` | Kernel transitions to `error`. |

```ts
document.querySelector('voice-call-button')?.addEventListener(
  'landi:call-started',
  (e) => console.log('call open', e.detail)
);
```

## 4. JS API

The element exposes public methods that proxy to the kernel:

```ts
const btn = document.querySelector('voice-call-button')!;
await btn.start();
await btn.stop();
await btn.toggle();
```

You can also drive the kernel directly (button observes either way):

```ts
const kernel = window.__voiceKernel__;
await kernel.voice.start();
await kernel.voice.stop();
await kernel.voice.toggle();
```

Or via the React hook from the canvas package:

```tsx
import { useVoiceCall } from 'agentable-canvas/react-canvas';
const voice = useVoiceCall();
voice.toggle();
```

## 5. Brand tokens

The actual `--landi-vcb-*` tokens declared on `:host` (override at the host page or via `agentable-canvas { --landi-color-primary: #ff5722; }`):

```css
voice-call-button {
  /* Colors — fall through to canvas brand tokens by default */
  --landi-vcb-color-primary: var(--landi-color-primary, #0D7377);
  --landi-vcb-color-accent: var(--landi-color-accent, #C9A227);
  --landi-vcb-color-error: var(--landi-color-error, #EF4444);
  --landi-vcb-color-surface: var(--landi-color-surface, #FFFFFF);
  --landi-vcb-color-surface-hover: #F9FAFB;
  --landi-vcb-color-border: var(--landi-color-border, #E5E5E5);
  --landi-vcb-color-border-hover: #D1D5DB;
  --landi-vcb-color-text: var(--landi-color-text, #1A1A1A);

  /* Geometry + type */
  --landi-vcb-radius: 9999px;
  --landi-vcb-radius-hero: 9999px;
  --landi-vcb-font-family: var(--landi-font-family, 'Inter', system-ui, sans-serif);
  --landi-vcb-shadow-hero: 0 8px 24px rgba(13,115,119,0.18);

  /* Variant-specific tweaks */
  --landi-vcb-cta-bg: var(--landi-vcb-color-surface);
  --landi-vcb-cta-bg-hover: var(--landi-vcb-color-surface-hover);
  --landi-vcb-cta-border: var(--landi-vcb-color-border);
  --landi-vcb-chip-surface: var(--landi-vcb-color-surface);
  --landi-vcb-chip-font-size: 12px;
  --landi-vcb-chip-tracking: 0.02em;

  /* Motion */
  --landi-vcb-motion-scale: 1;
  --landi-vcb-halo-duration-listening: 1600ms;
  --landi-vcb-halo-duration-speaking: 900ms;
}
```

## 6. Parts

| Part | Element | Use |
|---|---|---|
| `button` | root `<button>` | Background, padding, focus ring. |
| `icon-wrap` | mic icon container | Resize / reposition the icon block. |
| `icon` | mic SVG | Recolor / resize the icon itself. |
| `spinner` | connecting spinner | Style the connect-state spinner. |
| `halo` | listening/speaking halo ring | Restyle the ambient pulse ring. |
| `level-dot` | audio level indicator | Resize / recolor the live amplitude dot. |
| `label` | inner `<span>` | Label typography. |
| `chip` | nav-variant compact chip | Replace chip background, radius, tracking. |

```css
voice-call-button::part(button) { background: tomato; }
voice-call-button::part(level-dot) { width: 12px; height: 12px; }
```

## 7. Slots

| Slot | Use |
|---|---|
| (default) | Button label text. Falls back to `"Talk with our AI"` if empty. |

## 8. Backend contract

The button is purely a state-mirror UI; no backend calls. The voice transport (real or mock) is owned by `<agentable-canvas>` (or any kernel-impl-registering bundle on the same page). See [README.md §8](../README.md#8-backend-contract).

## 9. Browser support

Same as `<agentable-canvas>` — modern evergreens, no IE.

## 10. Changelog

See [docs/MILESTONES.md](MILESTONES.md).
