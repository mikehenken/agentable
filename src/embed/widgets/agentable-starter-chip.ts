/**
 * `<agentable-starter-chip>` — Lit widget (D44 widgets family, P9-T3).
 *
 * Standalone starter prompt chip for marketing pages. Dispatches the shared
 * chat `prompt` choreography primitive on activate.
 *
 * Usage:
 *   <script type="module" src="/embed/agentable-starter-chip.js"></script>
 *   <agentable-starter-chip
 *     emoji="✨"
 *     label="Explore roles"
 *     prompt="What roles are open right now?"
 *   ></agentable-starter-chip>
 */
import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { dispatchChatPrompt } from '../../choreography/dispatchPrompt';
import { bindWidgetPageSession, type WidgetPageSessionBinding } from './widgetPageSession';
import { widgetHostTokens, widgetVisuallyHidden } from './widgetTokens';

export interface AgentableStarterChipEventMap {
  'landi:starter-chip-selected': CustomEvent<{
    prompt: string;
    label: string;
    timestamp: string;
  }>;
}

declare global {
  interface HTMLElementTagNameMap {
    'agentable-starter-chip': AgentableStarterChipElement;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Lit typed event map augmentation
  interface HTMLElementEventMap extends AgentableStarterChipEventMap {}
}

@customElement('agentable-starter-chip')
export class AgentableStarterChipElement extends LitElement {
  @property({ type: String, reflect: true })
  declare emoji: string;

  /** Visible chip label; falls back to `prompt` when empty. */
  @property({ type: String, reflect: true })
  declare label: string;

  /** Prompt text sent to chat on activate. */
  @property({ type: String, reflect: true })
  declare prompt: string;

  /** When true, show pin affordance (P4/P9 parity). */
  @property({ type: Boolean, reflect: true })
  declare pin: boolean;

  @property({ type: Boolean, reflect: true })
  declare disabled: boolean;

  private _pageSession: WidgetPageSessionBinding | null = null;

  constructor() {
    super();
    this.emoji = '✨';
    this.label = '';
    this.prompt = '';
    this.pin = false;
    this.disabled = false;
  }

  static styles = [
    widgetHostTokens,
    widgetVisuallyHidden,
    css`
      :host {
        display: inline-flex;
      }

      button {
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: var(--landi-widget-radius-pill);
        font-family: var(--landi-widget-font-family);
        font-size: 0.8125rem;
        font-weight: 500;
        border: 1px solid var(--landi-widget-color-border);
        background: var(--landi-widget-color-surface);
        color: var(--landi-widget-color-text);
        transition:
          background-color 140ms ease,
          border-color 140ms ease,
          color 140ms ease;
      }

      button:hover:not(:disabled) {
        border-color: color-mix(in srgb, var(--landi-widget-color-accent) 45%, transparent);
        background: color-mix(in srgb, var(--landi-widget-color-accent) 10%, var(--landi-widget-color-surface));
        color: var(--landi-widget-color-primary);
      }

      button:focus-visible {
        outline: 2px solid var(--landi-widget-color-accent);
        outline-offset: 2px;
      }

      button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      .emoji {
        font-size: 0.875rem;
        line-height: 1;
      }

      .pin {
        width: 11px;
        height: 11px;
        opacity: 0.55;
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this._pageSession = bindWidgetPageSession('agentable-starter-chip');
    this._pageSession.join();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._pageSession?.leave();
    this._pageSession = null;
  }

  private _visibleLabel(): string {
    const trimmedLabel = this.label.trim();
    if (trimmedLabel.length > 0) return trimmedLabel;
    return this.prompt.trim();
  }

  private _onClick = (event: MouseEvent): void => {
    event.preventDefault();
    if (this.disabled) return;

    const promptText = this.prompt.trim();
    if (!promptText) return;

    dispatchChatPrompt(promptText, { source: 'agentable-starter-chip' });
    this.dispatchEvent(
      new CustomEvent('landi:starter-chip-selected', {
        detail: {
          prompt: promptText,
          label: this._visibleLabel(),
          timestamp: new Date().toISOString(),
        },
        bubbles: true,
        composed: true,
      }),
    );
  };

  render() {
    const label = this._visibleLabel();
    const buttonClasses = classMap({
      chip: true,
      pinned: this.pin,
    });

    return html`
      <button
        part="button"
        type="button"
        class=${buttonClasses}
        ?disabled=${this.disabled || label.length === 0}
        aria-label=${label.length > 0 ? `Starter prompt: ${label}` : 'Starter prompt'}
        @click=${this._onClick}
      >
        <span class="emoji" part="emoji" aria-hidden="true">${this.emoji}</span>
        <span part="label">${label}</span>
        ${this.pin
          ? html`
              <svg class="pin" part="pin" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M16 3V4.5L14.5 6 16 7.5V9L12 13 8 9V7.5L9.5 6 8 4.5V3H16Z"
                />
              </svg>
            `
          : null}
        <span class="visually-hidden">${this.prompt.trim()}</span>
      </button>
    `;
  }
}
