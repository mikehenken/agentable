/**
 * @docs/features/iframe-oembed-fallback.md
 * `<agentable-iframe-embed>` — parent-side sandboxed iframe wrapper with
 * postMessage bridge for JS-capable hosts.
 */
import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
  applySandboxedIframeAttributes,
  createIframeParentBridge,
  type IframeParentBridge,
} from './iframe/iframeParentBridge';
import { buildIframeHostUrl } from './iframe/iframeHostUrl';
import type { EmbedBridgeSurface } from './iframe/embedBridgeProtocol';
import type { PageSessionSnapshot } from '../session/pageSession';

export interface AgentableIframeEmbedReadyDetail {
  bridgeId: string;
  surface: EmbedBridgeSurface;
  sessionId: string;
}

export interface AgentableIframeEmbedEventDetail {
  bridgeId: string;
  eventType: string;
  detail: Record<string, unknown>;
}

export interface AgentableIframeEmbedSessionDetail {
  bridgeId: string;
  snapshot: PageSessionSnapshot;
}

export interface AgentableIframeEmbedErrorDetail {
  bridgeId: string;
  code: string;
  message: string;
}

export interface AgentableIframeEmbedEventMap {
  'agentable:iframe-ready': CustomEvent<AgentableIframeEmbedReadyDetail>;
  'agentable:iframe-event': CustomEvent<AgentableIframeEmbedEventDetail>;
  'agentable:iframe-session': CustomEvent<AgentableIframeEmbedSessionDetail>;
  'agentable:iframe-error': CustomEvent<AgentableIframeEmbedErrorDetail>;
}

declare global {
  interface HTMLElementTagNameMap {
    'agentable-iframe-embed': AgentableIframeEmbedElement;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Lit typed event map augmentation
  interface HTMLElementEventMap extends AgentableIframeEmbedEventMap {}
}

@customElement('agentable-iframe-embed')
export class AgentableIframeEmbedElement extends LitElement {
  @property({ type: String })
  declare panel: string;

  @property({ type: String, attribute: 'embed-base-url' })
  declare embedBaseUrl: string;

  @property({ type: String, attribute: 'config-url' })
  declare configUrl: string;

  @property({ type: String, attribute: 'panel-data-url' })
  declare panelDataUrl: string;

  @property({ type: String, attribute: 'primary-color' })
  declare primaryColor: string;

  @property({ type: String })
  declare locale: string;

  @property({ type: String, attribute: 'slot-name' })
  declare slotName: string;

  @property({ type: Boolean, attribute: 'hide-chrome' })
  declare hideChrome: boolean;

  @property({ type: Number })
  declare width: number;

  @property({ type: Number })
  declare height: number;

  @property({ type: String, attribute: 'bridge-id' })
  declare bridgeId: string;

  private _bridge: IframeParentBridge | null = null;
  private _disconnectBridge: (() => void) | null = null;

  constructor() {
    super();
    this.panel = '';
    this.embedBaseUrl = '';
    this.configUrl = '';
    this.panelDataUrl = '';
    this.primaryColor = '';
    this.locale = '';
    this.slotName = '';
    this.hideChrome = false;
    this.width = 640;
    this.height = 480;
    this.bridgeId = '';
  }

  static styles = css`:host {
      display: block;
      width: 100%;
      min-height: 420px;
    }.agentable-iframe-embed__frame {
      display: block;
      width: 100%;
      height: 100%;
      min-height: inherit;
    }
  `;

  render (){
    return html`<iframe
      part="frame"
      class="agentable-iframe-embed__frame"
      aria-label="Agentable panel embed"
    ></iframe>`;
  }

  firstUpdated(): void {
    this._mountIframe();
  }

  updated(changed: Map<string, unknown>): void {
    if (
      changed.has('panel') ||
      changed.has('embedBaseUrl') ||
      changed.has('configUrl') ||
      changed.has('panelDataUrl') ||
      changed.has('primaryColor') ||
      changed.has('locale') ||
      changed.has('slotName') ||
      changed.has('hideChrome') ||
      changed.has('width') ||
      changed.has('height')
    ) {
      this._mountIframe();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._teardownBridge();
  }

  ping(): void {
    this._bridge?.ping();
  }

  private _resolveBridgeId(): string {
    const explicit = this.bridgeId.trim();
    if (explicit) {
      return explicit;
    }
    return `bridge_${Math.random().toString(36).slice(2, 10)}`;
  }

  private _resolveEmbedBaseUrl(): string {
    const explicit = this.embedBaseUrl.trim();
    if (explicit) {
      return explicit;
    }
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'https://embed.agentable.dev';
  }

  private _teardownBridge(): void {
    this._disconnectBridge?.();
    this._disconnectBridge = null;
    this._bridge = null;
  }

  private _mountIframe(): void {
    const iframe = this.renderRoot.querySelector('iframe');
    if (!(iframe instanceof HTMLIFrameElement)) {
      return;
    }

    const panelId = this.panel.trim();
    if (!panelId) {
      return;
    }

    this._teardownBridge();
    const bridgeId = this._resolveBridgeId();
    const embedBaseUrl = this._resolveEmbedBaseUrl();
    const parentOrigin =
      typeof window !== 'undefined' ? window.location.origin: 'https://localhost';

    const iframeSrc = buildIframeHostUrl(embedBaseUrl, {
      surface: 'panel',
      panel: panelId,
      configUrl: this.configUrl || undefined,
      panelDataUrl: this.panelDataUrl || undefined,
      primaryColor: this.primaryColor || undefined,
      locale: this.locale || undefined,
      slotName: this.slotName || undefined,
      hideChrome: this.hideChrome,
      parentOrigin,
      bridgeId,
      width: this.width,
      height: this.height,
    });

    applySandboxedIframeAttributes(iframe, iframeSrc);
    iframe.style.minHeight = `${this.height}px`;

    this._bridge = createIframeParentBridge({
      bridgeId: bridgeId,
      iframe,
      embedOrigin: embedBaseUrl,
      parentOrigin,
      onReady: (detail) => {
        this.dispatchEvent(
          new CustomEvent<AgentableIframeEmbedReadyDetail>('agentable:iframe-ready', {
            bubbles: true,
            composed: true,
            detail,
          }));
      },
      onEvent: (detail) => {
        this.dispatchEvent(
          new CustomEvent<AgentableIframeEmbedEventDetail>('agentable:iframe-event', {
            bubbles: true,
            composed: true,
            detail,
          }));
      },
      onSession: (detail) => {
        this.dispatchEvent(
          new CustomEvent<AgentableIframeEmbedSessionDetail>('agentable:iframe-session', {
            bubbles: true,
            composed: true,
            detail,
          }));
      },
      onError: (detail) => {
        this.dispatchEvent(
          new CustomEvent<AgentableIframeEmbedErrorDetail>('agentable:iframe-error', {
            bubbles: true,
            composed: true,
            detail,
          }));
      },
    });

    this._disconnectBridge = this._bridge.connect();
  }
}
