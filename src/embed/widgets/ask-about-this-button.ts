/**
 * `<ask-about-this-button>` — Lit widget (widgets family).
 *
 * Contextual CTA that sends an ask-about prompt into the shared chat surface.
 *
 * Usage:
 * <script type="module" src="/embed/ask-about-this-button.js"></script>
 * <ask-about-this-button context="Sandals Royal Bahamian">
 * Ask about this resort
 * </ask-about-this-button>
 */
import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { dispatchChatPrompt } from '../../choreography/dispatchPrompt';
import { bindWidgetPageSession, type WidgetPageSessionBinding } from './widgetPageSession';
import { widgetHostTokens } from './widgetTokens';

export interface AskAboutThisButtonEventMap {
  'landi:ask-about-selected': CustomEvent<{
    context: string;
    prompt: string;
    timestamp: string;
  }>;
}

declare global {
  interface HTMLElementTagNameMap {
    'ask-about-this-button': AskAboutThisButtonElement;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Lit typed event map augmentation
  interface HTMLElementEventMap extends AskAboutThisButtonEventMap {}
}

@customElement('ask-about-this-button')
export class AskAboutThisButtonElement extends LitElement {
  /** Subject the user wants to ask about (required for dispatch). */
  @property({ type: String, reflect: true })
  declare context: string;

  /** Prefix prepended to `context` when building the chat prompt. */
  @property({ type: String, attribute: 'prompt-prefix', reflect: true })
  declare promptPrefix: string;

  @property({ type: Boolean, reflect: true })
  declare disabled: boolean;

  private _pageSession: WidgetPageSessionBinding | null = null;

  constructor() {
    super();
    this.context = '';
    this.promptPrefix = 'Tell me about';
    this.disabled = false;
  }

  static styles = [
    widgetHostTokens,
    css`:host {
        display: inline-flex;
      }

      button {
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.625rem 1rem;
        border-radius: var(--landi-widget-radius-pill);
        font-family: var(--landi-widget-font-family);
        font-size: 0.875rem;
        font-weight: 500;
        border: 1px solid color-mix(in srgb, var(--landi-widget-color-primary) 35%, transparent);
        background: color-mix(in srgb, var(--landi-widget-color-primary) 12%, white);
        color: var(--landi-widget-color-primary);
        transition:
          background-color 160ms ease,
          border-color 160ms ease,
          transform 160ms ease;
      }

      button:hover:not(:disabled) {
        background: color-mix(in srgb, var(--landi-widget-color-primary) 18%, white);
        border-color: color-mix(in srgb, var(--landi-widget-color-primary) 55%, transparent);
      }

      button:focus-visible {
        outline: 2px solid var(--landi-widget-color-accent);
        outline-offset: 2px;
      }

      button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }.icon {
        width: 1rem;
        height: 1rem;
        flex-shrink: 0;
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this._pageSession = bindWidgetPageSession('ask-about-this-button');
    this._pageSession.join();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._pageSession?.leave();
    this._pageSession = null;
  }

  buildPrompt(contextValue: string = this.context): string {
    const subject = contextValue.trim();
    const prefix = this.promptPrefix.trim() || 'Tell me about';
    if (!subject) return '';
    return `${prefix} ${subject}`.replace(/\s+/g, ' ').trim();
  }

  private _onClick = (event: MouseEvent): void => {
    event.preventDefault();
    if (this.disabled) return;

    const prompt = this.buildPrompt();
    if (!prompt) return;

    dispatchChatPrompt(prompt, { source: 'ask-about-this-button' });
    this.dispatchEvent(
      new CustomEvent('landi:ask-about-selected', {
        detail: {
          context: this.context.trim(),
          prompt,
          timestamp: new Date().toISOString(),
        },
        bubbles: true,
        composed: true,
      }));
  };

  render() {
    const hasContext = this.context.trim().length > 0;
    const ariaLabel = hasContext
      ? `Ask about ${this.context.trim()}`: 'Ask about this item';

    return html`
      <button
        part="button"
        type="button"
        ?disabled=${this.disabled || !hasContext}
        aria-label=${ariaLabel}
        @click=${this._onClick}
      >
        <svg class="icon" part="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.74V17a1 1 0 0 1-1 1h-2v1a1 1 0 0 1-2 0v-1H9a1 1 0 0 1-1-1v-2.26A6.98 6.98 0 0 1 5 9a7 7 0 0 1 7-7Zm0 2a5 5 0 0 0-5 5c0 1.86 1.02 3.48 2.53 4.32L10 13.5V15h4v-1.5l.47-.18A4.99 4.99 0 0 0 17 9a5 5 0 0 0-5-5Z"
          />
        </svg>
        <span part="label"><slot>Ask about this</slot></span>
      </button>
    `;
  }
}
