/**
 * <voice-call-button> — Lit web component.
 *
 * Drop-in voice-call trigger that mirrors the agent's state via the shared
 * `window.__voiceKernel__` (the vanilla voice-state bus). Designed to be
 * embedded in any host page (nav, hero CTA, drawer trigger). The button
 * never owns a voice session — it merely commands the canvas (which owns
 * the Gemini Live connection) and reflects the current state.
 *
 * Usage:
 *
 *   <script type="module" src="/embed/voice-call-button.js"></script>
 *   <voice-call-button variant="nav">Talk with our AI</voice-call-button>
 *
 * Per the Landi web-components-ui rules: Lit, Shadow DOM, brand tokens only,
 * `::part` exposure, typed event map, no hardcoded brand values.
 */

import { LitElement, css, html, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { ensureVoiceKernel, type VoiceState } from '../shared/voiceKernel';

/**
 * Below this normalised audio level, the level-dot is hidden entirely.
 * 0.05 = ~5% loudness floor — anything quieter is ambient noise / breath.
 */
const LEVEL_DOT_VISIBILITY_THRESHOLD = 0.05;

/**
 * Convert a 0..1 audio level to a CSS `transform: scale(...)` value for the
 * level-dot indicator. Base scale 0.5, gain 3, clamped to 1 max — chosen so
 * normal speech sits visibly between scale(0.6) and scale(1.5) without ever
 * exceeding the chip's bounding box.
 */
function levelToScale(level: number): number {
  return 0.5 + Math.min(1, level * 3);
}

export interface VoiceCallButtonEventMap {
  'landi:call-started': CustomEvent<{ timestamp: string }>;
  'landi:call-ended': CustomEvent<{ timestamp: string }>;
  'landi:call-state-changed': CustomEvent<{ state: VoiceState; level: number; timestamp: string }>;
  'landi:call-error': CustomEvent<{ message: string; timestamp: string }>;
}

declare global {
  interface HTMLElementTagNameMap {
    'voice-call-button': VoiceCallButtonElement;
  }
  interface HTMLElementEventMap extends VoiceCallButtonEventMap {}
}

type Variant = 'nav' | 'hero';

@customElement('voice-call-button')
export class VoiceCallButtonElement extends LitElement {
  // See AgentableCanvasElement for the class-field-shadowing rationale —
  // `declare` keeps the @property/@state accessors intact under
  // `useDefineForClassFields: true`. Defaults assigned in the constructor so
  // they go through the reactive accessors. Without this, the button never
  // re-renders when voiceKernel state changes.
  // https://lit.dev/msg/class-field-shadowing
  /** Visual preset. `nav` = compact pill on dark backdrop. `hero` = large CTA. */
  @property({ type: String, reflect: true })
  declare variant: Variant;

  /** Disable the button entirely (e.g. when voice prerequisites unmet). */
  @property({ type: Boolean, reflect: true })
  declare disabled: boolean;

  @state() private declare _state: VoiceState;
  @state() private declare _level: number;
  @state() private declare _errorMessage: string;

  private _unsubscribe: (() => void) | null = null;
  private _previousState: VoiceState = 'idle';

  constructor() {
    super();
    this.variant = 'nav';
    this.disabled = false;
    this._state = 'idle';
    this._level = 0;
    this._errorMessage = '';
  }

  static styles = css`
    :host {
      display: inline-flex;
      box-sizing: border-box;
      /* Brand tokens — host page can override any of these. All raw values
         (colors, font sizes, spacing, radii) live in this block; component
         body rules consume tokens only, per web-components-ui §3.1. */
      --landi-vcb-color-primary: var(--landi-color-primary, #0d7377);
      --landi-vcb-color-accent: var(--landi-color-accent, #c9a227);
      --landi-vcb-color-error: var(--landi-color-error, #b04545);
      --landi-vcb-color-surface: var(--landi-color-surface-translucent, rgba(255, 255, 255, 0.1));
      --landi-vcb-color-surface-hover: var(--landi-color-surface-translucent-hover, rgba(255, 255, 255, 0.2));
      --landi-vcb-color-border: var(--landi-color-border-translucent, rgba(255, 255, 255, 0.15));
      --landi-vcb-color-border-hover: var(--landi-color-border-translucent-hover, rgba(255, 255, 255, 0.3));
      --landi-vcb-color-text: var(--landi-color-text-on-dark, #ffffff);
      --landi-vcb-radius: var(--landi-radius-pill, 9999px);
      --landi-vcb-radius-hero: var(--landi-radius-pill, 9999px);
      --landi-vcb-font-family: var(--landi-font-family, 'Inter', system-ui, sans-serif);
      --landi-vcb-shadow-hero: var(--landi-shadow-cta, 0 8px 24px -8px rgba(0, 0, 0, 0.3));
      --landi-vcb-motion-scale: var(--landi-motion-scale, 1);

      /* Hero CTA defaults: brand primary with accent. Tenants override via
         the --landi-color-* tokens or the --landi-vcb-* overrides below. */
      --landi-vcb-cta-bg: var(--landi-color-cta-background, var(--landi-vcb-color-primary));
      --landi-vcb-cta-bg-hover: var(--landi-color-cta-background-hover,
        color-mix(in srgb, var(--landi-vcb-color-primary) 88%, white));
      --landi-vcb-cta-border: var(--landi-color-cta-border,
        color-mix(in srgb, var(--landi-vcb-color-accent) 40%, transparent));

      /* Chip status badge tokens. */
      --landi-vcb-chip-surface: var(--landi-color-chip-surface, rgba(255, 255, 255, 0.12));
      --landi-vcb-chip-font-size: var(--landi-font-size-chip, 0.6875rem);
      --landi-vcb-chip-tracking: var(--landi-letter-spacing-chip, 0.025em);

      /* Halo animation durations. Tunable per state so embedders can match
         their brand pacing (e.g. slower for "calm", faster for "energetic"). */
      --landi-vcb-halo-duration-listening: var(--landi-motion-halo-listening, 1.4s);
      --landi-vcb-halo-duration-speaking: var(--landi-motion-halo-speaking, 0.9s);
    }

    button {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.625rem;
      border: 1px solid var(--landi-vcb-color-border);
      background: var(--landi-vcb-color-surface);
      color: var(--landi-vcb-color-text);
      font-family: var(--landi-vcb-font-family);
      font-weight: 500;
      backdrop-filter: blur(8px);
      transition: background-color 220ms ease, border-color 220ms ease, transform 220ms ease;
    }

    button:hover:not(:disabled) {
      background: var(--landi-vcb-color-surface-hover);
      border-color: var(--landi-vcb-color-border-hover);
    }

    button:focus-visible {
      outline: 2px solid var(--landi-vcb-color-accent);
      outline-offset: 2px;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    /* Variant: nav — compact pill */
    :host([variant='nav']) button {
      padding: 0.625rem 1rem;
      border-radius: var(--landi-vcb-radius);
      font-size: 0.875rem;
    }

    /* Variant: hero — larger CTA, deeper padding, drop shadow.
       Token-driven: accent-on-primary by default. */
    :host([variant='hero']) button {
      padding: 1rem 2rem;
      border-radius: var(--landi-vcb-radius-hero);
      font-size: 1rem;
      box-shadow: var(--landi-vcb-shadow-hero);
      background: var(--landi-vcb-cta-bg);
      border-color: var(--landi-vcb-cta-border);
    }

    :host([variant='hero']) button:hover:not(:disabled) {
      background: var(--landi-vcb-cta-bg-hover);
    }

    .icon-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1rem;
      height: 1rem;
    }

    :host([variant='hero']) .icon-wrap {
      width: 1.25rem;
      height: 1.25rem;
    }

    .icon {
      color: var(--landi-vcb-color-accent);
      width: 100%;
      height: 100%;
    }

    /* Pulse halo. Reserved for *active* states only — idle is static, per
       the "premium, calm" brand identity. A perpetual idle pulse on a
       marketing nav burns battery and undermines tone. */
    .halo {
      position: absolute;
      inset: 0;
      border-radius: var(--landi-vcb-radius);
      background: var(--landi-vcb-color-accent);
      opacity: 0;
      transform: scale(0.6);
      pointer-events: none;
    }

    .halo.listening {
      background: var(--landi-vcb-color-primary);
      opacity: 0.4;
      animation: halo-ping var(--landi-vcb-halo-duration-listening) cubic-bezier(0, 0, 0.2, 1) infinite;
    }

    .halo.speaking {
      opacity: 0.5;
      animation: halo-ping var(--landi-vcb-halo-duration-speaking) cubic-bezier(0, 0, 0.2, 1) infinite;
    }

    .halo.error {
      background: var(--landi-vcb-color-error);
      opacity: 0.4;
    }

    @keyframes halo-ping {
      0% {
        transform: scale(0.6);
        opacity: 0.6;
      }
      80%,
      100% {
        transform: scale(1.6);
        opacity: 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .halo {
        animation: none !important;
        opacity: 0.4;
      }
      button {
        transition: none;
      }
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem 0.5rem;
      border-radius: var(--landi-vcb-radius);
      font-size: var(--landi-vcb-chip-font-size);
      font-weight: 500;
      letter-spacing: var(--landi-vcb-chip-tracking);
      text-transform: uppercase;
      background: var(--landi-vcb-chip-surface);
      color: var(--landi-vcb-color-text);
    }

    .chip.listening {
      background: color-mix(in srgb, var(--landi-vcb-color-primary) 30%, transparent);
    }

    .chip.speaking {
      background: color-mix(in srgb, var(--landi-vcb-color-accent) 30%, transparent);
    }

    .chip.error {
      background: color-mix(in srgb, var(--landi-vcb-color-error) 30%, transparent);
    }

    /* Spinner for connecting state */
    .spinner {
      width: 0.875rem;
      height: 0.875rem;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: var(--landi-vcb-radius);
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .spinner {
        animation-duration: 2s;
      }
    }

    .level-dot {
      width: 0.375rem;
      height: 0.375rem;
      border-radius: var(--landi-vcb-radius);
      background: var(--landi-vcb-color-primary);
      transition: transform 80ms ease-out;
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    // If the host page reparents this element (portal, drawer, framework
    // re-mount), connectedCallback fires again. Tear down the prior
    // subscription before adding a new one so the kernel's listener Set
    // doesn't grow unbounded across reparents.
    this._unsubscribe?.();
    const kernel = ensureVoiceKernel();
    this._unsubscribe = kernel.voice.subscribe((snapshot) => {
      this._state = snapshot.state;
      this._level = snapshot.level;
      this._errorMessage = snapshot.errorMessage ?? '';
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubscribe?.();
    this._unsubscribe = null;
  }

  updated(changed: PropertyValues<this>): void {
    // `_state` is private; `keyof` widens to public members only, so the
    // map lookup needs a relax. Using `Map<string, unknown>` keeps the
    // intent clear without inventing a public alias for a strictly-
    // internal field.
    if ((changed as unknown as Map<string, unknown>).has('_state') && this._state !== this._previousState) {
      this._dispatchStateChange();
      if (this._state === 'listening' && this._previousState === 'connecting') {
        this._dispatchEvent('landi:call-started', { timestamp: new Date().toISOString() });
      }
      if (this._state === 'idle' && this._previousState !== 'idle') {
        this._dispatchEvent('landi:call-ended', { timestamp: new Date().toISOString() });
      }
      if (this._state === 'error' && this._errorMessage) {
        this._dispatchEvent('landi:call-error', {
          message: this._errorMessage,
          timestamp: new Date().toISOString(),
        });
      }
      this._previousState = this._state;
    }
  }

  /** Public API — start the call (no-op if active). */
  async start(): Promise<void> {
    await ensureVoiceKernel().voice.start();
  }

  /** Public API — end the call (no-op if idle). */
  async stop(): Promise<void> {
    await ensureVoiceKernel().voice.stop();
  }

  /** Public API — toggle based on current state. */
  async toggle(): Promise<void> {
    await ensureVoiceKernel().voice.toggle();
  }

  private _dispatchStateChange(): void {
    this._dispatchEvent('landi:call-state-changed', {
      state: this._state,
      level: this._level,
      timestamp: new Date().toISOString(),
    });
  }

  private _dispatchEvent<K extends keyof VoiceCallButtonEventMap>(
    type: K,
    detail: VoiceCallButtonEventMap[K]['detail']
  ): void {
    this.dispatchEvent(
      new CustomEvent(type, { detail, bubbles: true, composed: true }) as VoiceCallButtonEventMap[K]
    );
  }

  private _onClick = (e: MouseEvent): void => {
    e.preventDefault();
    if (this.disabled) return;
    void this.toggle();
  };

  private _statusLabel(): string {
    switch (this._state) {
      case 'connecting':
        return 'Connecting';
      case 'listening':
        return 'Listening';
      case 'speaking':
        // Generic — VoiceWidget.tsx mirrors this string. Tenants can swap
        // via the assistant-name attribute / config in a future revision.
        return 'Speaking';
      case 'error':
        // Action, not diagnostic. The full error stays in the visually-hidden
        // aria-live region for screen-reader users.
        return 'Tap to retry';
      default:
        return '';
    }
  }

  render() {
    const isActive = this._state !== 'idle' && this._state !== 'error';
    const haloClasses = classMap({
      halo: true,
      // No `idle` class — idle is intentionally static (no halo).
      listening: this._state === 'listening',
      speaking: this._state === 'speaking',
      error: this._state === 'error',
    });
    const chipClasses = classMap({
      chip: true,
      listening: this._state === 'listening',
      speaking: this._state === 'speaking',
      error: this._state === 'error',
    });

    const statusLabel = this._statusLabel();
    const ariaLabel = isActive ? `End call (${statusLabel})` : 'Start voice call';

    return html`
      <button
        part="button"
        type="button"
        ?disabled=${this.disabled}
        aria-label=${ariaLabel}
        aria-pressed=${isActive ? 'true' : 'false'}
        @click=${this._onClick}
      >
        <span class="icon-wrap" part="icon-wrap" aria-hidden="true">
          ${this._state === 'connecting'
            ? html`<span class="spinner" part="spinner"></span>`
            : html`
                <span class=${haloClasses} part="halo"></span>
                <svg
                  class="icon"
                  part="icon"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
                  />
                </svg>
              `}
        </span>
        <span class="label" part="label"><slot>Talk with our AI</slot></span>
        ${statusLabel
          ? html`
              <span class=${chipClasses} part="chip" role="status" aria-live="polite">
                ${this._state === 'listening' && this._level > LEVEL_DOT_VISIBILITY_THRESHOLD
                  ? html`<span
                      class="level-dot"
                      part="level-dot"
                      style=${styleMap({ transform: `scale(${levelToScale(this._level).toFixed(2)})` })}
                    ></span>`
                  : null}
                ${statusLabel}
              </span>
            `
          : null}
        <span class="visually-hidden" aria-live="polite">
          ${this._state === 'error' && this._errorMessage ? this._errorMessage : ''}
        </span>
      </button>
    `;
  }
}
