/**
 * agentable-canvas — Lit custom-element wrapper for the Agentable Canvas.
 *
 * Published contract (per EMBEDDING.md): a single `<agentable-canvas>` tag
 * can be dropped into any page to mount the full canvas.
 *
 *     <agentable-canvas
 *       tenant="acme"
 *       primary-color="#3B82F6"
 *       welcome-message="Hi! How can I help?"
 *       api-endpoint="/api"
 *       voice-enabled
 *       snap-grid
 *     ></agentable-canvas>
 *     <script src="/embed/agentable-canvas.js"></script>
 *
 * Sizing: the React canvas fills the host element, so the consumer sets the
 * width/height via CSS (either an explicit size, or letting it stretch in a
 * flex/grid container). Defaults to `block` + `min-height: 600px` for a
 * sensible out-of-the-box appearance.
 *
 * Branding: attributes like `primary-color` are applied as CSS custom
 * properties on the host, which cascade into the React canvas via Tailwind
 * token references. Consumers can also override tokens directly in CSS:
 *
 *     agentable-canvas { --landi-color-primary: #FF5722; }
 *
 * Events: the canvas emits `CustomEvent`s that bubble + cross the shadow
 * boundary (`composed: true`), so consumers can listen directly on the host:
 *
 *     document.querySelector('agentable-canvas').addEventListener(
 *       'landi:message-sent', e => console.log(e.detail)
 *     );
 */
import { LitElement, css, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRoot, type Root } from 'react-dom/client';
import { StrictMode, createElement } from 'react';
import { BrowserRouter } from 'react-router';
import { CanvasShell, type CanvasShellProps } from '../canvas/CanvasShell';
import { ensureVoiceKernel } from '../shared/voiceKernel';
import { hexToHslComponents } from './utils/hexToHsl';
// Import the canvas + Tailwind stylesheet as an inline string (Vite ?inline
// query). For the Lit shell the styles MUST live inside the Shadow Root —
// a `<link>` in the document <head> will not pierce the shadow boundary, so
// React-rendered children would render unstyled. Adopting via Lit's
// `static styles` array constructs a CSSStyleSheet shared across instances
// and avoids per-element style cloning.
import canvasStyles from '../index.css?inline';

type EmbedConfig = {
  tenant: string;
  primaryColor: string;
  welcomeMessage: string;
  apiEndpoint: string;
  voiceEnabled: boolean;
  snapGrid: boolean;
  systemPrompt: string;
  voiceGreeting: string;
  tokenEndpoint: string;
};

const DEFAULT_CONFIG: EmbedConfig = {
  tenant: 'default',
  // Neutral default token — agency-blue. Tenants supply their own brand
  // color via the `primary-color` attribute or `--landi-color-primary` CSS
  // custom property.
  primaryColor: '#3B82F6',
  welcomeMessage: 'Hi! How can I help?',
  apiEndpoint: '/api',
  voiceEnabled: true,
  snapGrid: true,
  // Empty string = "fall back to CanvasContext default" (a generic
  // demo persona). The Lit shell carries no tenant-specific defaults.
  systemPrompt: '',
  voiceGreeting: '',
  // Empty string = "use VITE_GEMINI_API_KEY (dev) or fail in prod".
  // Production deployments should set this to the URL of a backplane
  // worker that mints ephemeral Gemini Live tokens — never bake the
  // long-lived API key into the public bundle.
  tokenEndpoint: '',
};

@customElement('agentable-canvas')
export class AgentableCanvasElement extends LitElement {
  // NOTE on `declare`: Lit decorators install accessors via Object.defineProperty.
  // With `useDefineForClassFields: true` (the modern TS default for ES2022),
  // `tenant = '...'` would emit a class-field initializer that runs AFTER the
  // decorator and overwrites the accessor — so attribute changes from the host
  // never trigger updates and `<agentable-canvas>` renders an empty Shadow DOM
  // forever (`hasUpdated: false`, `isUpdatePending: true`). The fix is to mark
  // each reactive property `declare` (so TS emits no field) and pass the
  // default through the decorator's accessor itself by assigning in the
  // constructor or via property initializers in the field declaration after
  // the accessor is installed. Per Lit's class-field-shadowing guidance.
  // See: https://lit.dev/msg/class-field-shadowing
  @property({ type: String })
  declare tenant: string;

  @property({ type: String, attribute: 'primary-color' })
  declare primaryColor: string;

  @property({ type: String, attribute: 'welcome-message' })
  declare welcomeMessage: string;

  @property({ type: String, attribute: 'api-endpoint' })
  declare apiEndpoint: string;

  @property({ type: Boolean, attribute: 'voice-enabled' })
  declare voiceEnabled: boolean;

  @property({ type: Boolean, attribute: 'snap-grid' })
  declare snapGrid: boolean;

  @property({ type: String, attribute: 'system-prompt' })
  declare systemPrompt: string;

  @property({ type: String, attribute: 'voice-greeting' })
  declare voiceGreeting: string;

  @property({ type: String, attribute: 'token-endpoint' })
  declare tokenEndpoint: string;

  private _root: Root | null = null;

  constructor() {
    super();
    // Defaults are assigned through the property accessors installed by
    // `@property`, so they ARE reactive (changes still trigger updates).
    this.tenant = DEFAULT_CONFIG.tenant;
    this.primaryColor = DEFAULT_CONFIG.primaryColor;
    this.welcomeMessage = DEFAULT_CONFIG.welcomeMessage;
    this.apiEndpoint = DEFAULT_CONFIG.apiEndpoint;
    this.voiceEnabled = DEFAULT_CONFIG.voiceEnabled;
    this.snapGrid = DEFAULT_CONFIG.snapGrid;
    this.systemPrompt = DEFAULT_CONFIG.systemPrompt;
    this.voiceGreeting = DEFAULT_CONFIG.voiceGreeting;
    this.tokenEndpoint = DEFAULT_CONFIG.tokenEndpoint;
  }

  // Order matters: the inlined canvas/Tailwind sheet first (provides resets
  // + utility classes the React tree consumes), then the host-element rules
  // last so they win where they overlap (`:host` block, mount sizing).
  static styles = [
    unsafeCSS(canvasStyles),
    css`
      :host {
        display: block;
        position: relative;
        width: 100%;
        min-height: 600px;
        contain: layout paint;
        background: var(--landi-color-background, #f0f0ec);
      }
      .agentable-canvas-mount {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
    `,
  ];

  render() {
    return html`<div class="agentable-canvas-mount"></div>`;
  }

  firstUpdated(): void {
    // Install the shared voice-state kernel before the React tree mounts so
    // any child component can reach for `window.__voiceKernel__` without
    // timing risk.
    ensureVoiceKernel();
    this._applyBrandTokens();
    // Test-mode escape hatch: a `data-skip-react-mount` attribute on the host
    // element suppresses the React tree mount, letting Lit-shell-level
    // component tests assert against shadowRoot, parts, attribute reactivity,
    // events, and brand-token application WITHOUT pulling in the full React
    // canvas tree (which contains lazy panels + voice-mock scenarios on real
    // setTimeout timers, which never quiesce inside `@open-wc/testing`'s
    // `fixture()` budget). Full integration is covered separately by the
    // happy-dom Vitest suite under `tests/integration/`.
    // (F.7.3 activation, 2026-04-26: see docs/reviews/2026-04-26-F73-activation-attempt.md "Remaining gap".)
    if (this.hasAttribute('data-skip-react-mount')) {
      return;
    }
    this._mountReact();
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('primaryColor')) {
      this._applyBrandTokens();
    }
    // Re-render React if any prop the tree consumes changed. Avoids tearing
    // down + re-creating the root (which would lose voiceKernel state).
    if (
      changed.has('tenant') ||
      changed.has('systemPrompt') ||
      changed.has('voiceGreeting') ||
      changed.has('tokenEndpoint')
    ) {
      this._renderReact();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._root) {
      this._root.unmount();
      this._root = null;
    }
  }

  /**
   * Public API (per EMBEDDING.md). These are stub-level for M1 and dispatch
   * CustomEvents the embedded canvas can listen for to orchestrate voice.
   */
  startVoiceCall(): void {
    this.dispatchEvent(
      new CustomEvent('landi:voice-start-requested', {
        bubbles: true,
        composed: true,
      })
    );
  }

  endVoiceCall(): void {
    this.dispatchEvent(
      new CustomEvent('landi:voice-end-requested', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private _applyBrandTokens(): void {
    // Set BOTH the legacy hex form AND the HSL companion form. The HSL
    // form is what Tailwind's `<alpha-value>` placeholder pattern needs
    // for utilities like `bg-canvas-primary/30` to actually compose alpha
    // with the tenant override. Without setting the HSL form here, an
    // embedder using `primary-color="#ff0000"` would get split brand:
    // solid `bg-canvas-primary` honors override, alpha-modified
    // `bg-canvas-primary/30` keeps the build-time default color.
    this.style.setProperty('--landi-color-primary', this.primaryColor);
    const hsl = hexToHslComponents(this.primaryColor);
    if (hsl) {
      this.style.setProperty('--landi-color-primary-hsl', hsl);
    } else {
      // Embedder passed a non-hex value (e.g. `"teal"`, `"rgb(...)"`). The
      // hex token still gets set (browsers parse named/rgb colors fine),
      // but the HSL companion stays at its build-time default — meaning
      // alpha-modified utilities like `bg-canvas-primary/30` will keep
      // rendering the build-time default color instead of the override.
      // Loud warn so the misconfiguration surfaces in dev.
      console.warn(
        `[agentable-canvas] primary-color="${this.primaryColor}" is not a valid hex (#RGB or #RRGGBB); --landi-color-primary-hsl unchanged. Alpha-modified utilities will not honor this override.`
      );
    }
  }

  private _mountReact(): void {
    const shadow = this.renderRoot;
    const mount = shadow.querySelector<HTMLDivElement>('.agentable-canvas-mount');
    if (!mount) return;
    this._root = createRoot(mount);
    this._renderReact();
  }

  private _renderReact(): void {
    if (!this._root) return;
    // Build the tenant config from current attribute values. Empty strings
    // mean "use CanvasContext default" — leave the field undefined so the
    // provider's default-merge kicks in. CanvasProvider accepts a deeply-
    // partial config (`PartialCanvasTenantConfig`), so this is type-safe
    // without casts.
    const persona: {
      systemPrompt?: string;
      voiceGreeting?: string;
      tokenEndpoint?: string;
    } = {};
    if (this.systemPrompt) persona.systemPrompt = this.systemPrompt;
    if (this.voiceGreeting) persona.voiceGreeting = this.voiceGreeting;
    if (this.tokenEndpoint) persona.tokenEndpoint = this.tokenEndpoint;

    this._root.render(
      createElement(
        StrictMode,
        null,
        createElement(
          BrowserRouter,
          null,
          createElement<CanvasShellProps>(CanvasShell, {
            config: {
              tenant: this.tenant,
              ...(Object.keys(persona).length > 0 ? { persona } : {}),
            },
          })
        )
      )
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'agentable-canvas': AgentableCanvasElement;
  }
}
