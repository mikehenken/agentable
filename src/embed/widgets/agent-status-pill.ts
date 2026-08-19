/**
 * `<agent-status-pill>` — Lit widget (widgets family).
 *
 * Read-only agent status badge subscribing to `window.__agentStatusKernel__`.
 * Host runtimes publish registry rows; marketing pages embed the pill without
 * React.
 *
 * Usage:
 *   <script type="module" src="/embed/agent-status-pill.js"></script>
 *   <agent-status-pill agent-id="concierge"></agent-status-pill>
 */
import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import type { AgentSessionStatus } from '../../agents/types';
import {
  ensureAgentStatusKernel,
  resolvePrimaryAgentStatus,
  type AgentStatusEntry,
} from '../../shared/agentStatusKernel';
import { bindWidgetPageSession, type WidgetPageSessionBinding } from './widgetPageSession';
import { widgetHostTokens } from './widgetTokens';

export interface AgentStatusPillEventMap {
  'landi:agent-status-changed': CustomEvent<{
    agentId: string;
    status: AgentSessionStatus;
    label: string;
    task?: string;
    timestamp: string;
  }>;
}

declare global {
  interface HTMLElementTagNameMap {
    'agent-status-pill': AgentStatusPillElement;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Lit typed event map augmentation
  interface HTMLElementEventMap extends AgentStatusPillEventMap {}
}

function statusLabel(status: AgentSessionStatus): string {
  switch (status) {
    case 'running':
      return 'Working';
    case 'waiting_approval':
      return 'Needs approval';
    case 'done':
      return 'Done';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Ready';
  }
}

@customElement('agent-status-pill')
export class AgentStatusPillElement extends LitElement {
  /** When set, pin the pill to one agent row. */
  @property({ type: String, attribute: 'agent-id', reflect: true })
  declare agentId: string;

  /** Optional label override (otherwise kernel label). */
  @property({ type: String, reflect: true })
  declare label: string;

  /** Hide the pill entirely when no matching agent is registered. */
  @property({ type: Boolean, attribute: 'hide-when-idle', reflect: true })
  declare hideWhenIdle: boolean;

  @state() private declare _entry: AgentStatusEntry | undefined;

  private _unsubscribe: (() => void) | null = null;
  private _pageSession: WidgetPageSessionBinding | null = null;
  private _previousStatus: AgentSessionStatus | null = null;

  constructor() {
    super();
    this.agentId = '';
    this.label = '';
    this.hideWhenIdle = false;
    this._entry = undefined;
  }

  static styles = [
    widgetHostTokens,
    css`
      :host {
        display: inline-flex;
      }

      :host([hidden]) {
        display: none;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.25rem 0.625rem;
        border-radius: var(--landi-widget-radius-pill);
        font-family: var(--landi-widget-font-family);
        font-size: 0.6875rem;
        font-weight: 600;
        letter-spacing: 0.025em;
        text-transform: uppercase;
        border: 1px solid var(--landi-widget-color-border);
        background: var(--landi-widget-color-surface);
        color: var(--landi-widget-color-text-muted);
      }

      .pill.running {
        color: var(--landi-widget-color-primary);
        border-color: color-mix(in srgb, var(--landi-widget-color-primary) 35%, transparent);
        background: color-mix(in srgb, var(--landi-widget-color-primary) 10%, white);
      }

      .pill.waiting_approval {
        color: var(--landi-widget-color-accent);
        border-color: color-mix(in srgb, var(--landi-widget-color-accent) 40%, transparent);
        background: color-mix(in srgb, var(--landi-widget-color-accent) 12%, white);
      }

      .pill.error,
      .pill.cancelled {
        color: var(--landi-widget-color-error);
        border-color: color-mix(in srgb, var(--landi-widget-color-error) 35%, transparent);
      }

      .spinner {
        width: 0.75rem;
        height: 0.75rem;
        border: 2px solid currentColor;
        border-top-color: transparent;
        border-radius: var(--landi-widget-radius-pill);
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
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this._pageSession = bindWidgetPageSession('agent-status-pill');
    this._pageSession.join();

    this._unsubscribe?.();
    const kernel = ensureAgentStatusKernel();
    this._unsubscribe = kernel.agents.subscribe((snapshot) => {
      this._syncEntry(snapshot.agents);
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubscribe?.();
    this._unsubscribe = null;
    this._pageSession?.leave();
    this._pageSession = null;
  }

  private _syncEntry(agents: readonly AgentStatusEntry[]): void {
    const preferredId = this.agentId.trim() || undefined;
    const next = resolvePrimaryAgentStatus(agents, preferredId);
    const previous = this._entry;
    this._entry = next;

    if (next && next.status !== this._previousStatus) {
      this._previousStatus = next.status;
      this.dispatchEvent(
        new CustomEvent('landi:agent-status-changed', {
          detail: {
            agentId: next.agentId,
            status: next.status,
            label: next.label,
            task: next.task,
            timestamp: new Date().toISOString(),
          },
          bubbles: true,
          composed: true,
        }),
      );
    }

    if (!next && previous) {
      this._previousStatus = null;
    }
  }

  private _displayLabel(): string {
    const override = this.label.trim();
    if (override.length > 0) return override;
    if (this._entry?.label.trim()) return this._entry.label.trim();
    return 'Agent';
  }

  render() {
    const entry = this._entry;
    const shouldHide =
      !entry || (this.hideWhenIdle && entry.status === 'idle' && this.agentId.trim().length === 0);

    if (shouldHide) {
      return html``;
    }

    const status = entry.status;
    const pillClasses = classMap({
      pill: true,
      [status]: true,
    });
    const visibleStatus = statusLabel(status);
    const taskHint = entry?.task?.trim() ?? '';

    return html`
      <span
        part="pill"
        class=${pillClasses}
        role="status"
        aria-live="polite"
        aria-label=${`${this._displayLabel()}: ${visibleStatus}${taskHint ? `. ${taskHint}` : ''}`}
      >
        ${status === 'running'
          ? html`<span class="spinner" part="spinner" aria-hidden="true"></span>`
          : null}
        <span part="label">${this._displayLabel()}</span>
        <span part="status">${visibleStatus}</span>
      </span>
    `;
  }
}
