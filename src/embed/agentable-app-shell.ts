/**
 * agentable-app-shell: Lit custom-element wrapper for the DOM workspace
 * engine. Mounts the career-pack panel set across the `main` and
 * `sidebar` app-shell regions on `engine="dom"` (regions, resizable
 * splits, per-region tabs, `camera: none`) rather than the tldraw canvas
 * engine `<agentable-whiteboard>` mounts.
 *
 * <agentable-app-shell
 * tenant="archipelago-resorts"
 * primary-color="#0E7490"
 * career-data-url="/examples/shared/archipelago-career-data.json"
 * locale="en"
 * ></agentable-app-shell>
 * <script type="module" src="/embed/agentable-app-shell.js"></script>
 *
 * This entry imports only the DOM engine path (`../engines/dom`) and the
 * panel rendering primitives (`../panels/registry`, `../panels/spec`,
 * `../panels/renderer`); never `../panels/host` (which reaches the agent
 * runtime and, through it, the tldraw-only digest shape collector) and
 * never `../engines/tldraw/**` or the `tldraw` package. The built bundle
 * for this entry point ships with no tldraw module and no tldraw
 * watermark string.
 *
 * Events bubble and cross the shadow boundary (`composed: true`).
 */
import { LitElement, css, html, unsafeCSS, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { hexToHslComponents } from './utils/hexToHsl';
import { bootstrapSessionLocale } from '../i18n/bootstrapSessionLocale';
import { AppShellWorkspace, type AppShellWorkspaceReadyDetail } from './appShell/AppShellWorkspace';
import canvasStyles from '../index.css?inline';
import whiteboardDarkStyles from '../engines/tldraw/styles/whiteboard-vibe-dark.css?inline';
import domAppShellDarkStyles from '../engines/dom/styles/dom-app-shell-vibe-dark.css?inline';
import domAppShellPanelBodyStyles from '../engines/dom/styles/dom-app-shell-panel-body.css?inline';

const DEFAULT_TENANT = 'archipelago-resorts';
const DEFAULT_PRIMARY_COLOR = '#0E7490';
const DEFAULT_LOCALE = 'en';

export type AgentableAppShellWorkspaceReadyDetail = AppShellWorkspaceReadyDetail;

export interface AgentableAppShellEventMap {
  'agentable:workspace-ready': CustomEvent<AgentableAppShellWorkspaceReadyDetail>;
}

declare global {
  interface HTMLElementTagNameMap {
    'agentable-app-shell': AgentableAppShellElement;
  }
   // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Lit typed event map augmentation
  interface HTMLElementEventMap extends AgentableAppShellEventMap {}
}

@customElement('agentable-app-shell')
export class AgentableAppShellElement extends LitElement {
  @property({ type: String })
  declare tenant: string;

  @property({ type: String, attribute: 'primary-color' })
  declare primaryColor: string;

  @property({ type: String })
  declare locale: string;

  /** URL to a career dataset JSON document; empty falls back to the built-in fixture. */
  @property({ type: String, attribute: 'career-data-url' })
  declare careerDataUrl: string;

  private _root: Root | null = null;

  constructor() {
    super();
    this.tenant = DEFAULT_TENANT;
    this.primaryColor = DEFAULT_PRIMARY_COLOR;
    this.locale = DEFAULT_LOCALE;
    this.careerDataUrl = '';
  }

  static styles = [
    unsafeCSS(canvasStyles),
    unsafeCSS(whiteboardDarkStyles),
    unsafeCSS(domAppShellDarkStyles),
    unsafeCSS(domAppShellPanelBodyStyles),
    css`:host {
        display: block;
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 560px;
        contain: layout paint;
        background: #121212;
        color: #ececec;
        overflow: hidden;
      }.agentable-app-shell-mount {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: inherit;
        overflow: hidden;
      }
    `,
  ];

  render (){
    return html`<div part="mount" class="agentable-app-shell-mount"></div>`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.hasAttribute('primary-color')) {
      this._applyBrandTokens(this.primaryColor);
    }
  }

  /**
   * `firstUpdated` fires once, after Lit commits the first render: the
   * earliest point `renderRoot` actually contains the `part="mount"` div.
   * Mounting from `connectedCallback` instead (before that first commit)
   * would find no mount node and silently no-op, per Lit's own update
   * scheduling (the initial render is a microtask after upgrade, not
   * synchronous with `connectedCallback`).
   */
  firstUpdated(): void {
    this._mount();
  }

  updated(changed: PropertyValues<this>): void {
    if (changed.has('primaryColor') && this.hasAttribute('primary-color')) {
      this._applyBrandTokens(this.primaryColor);
    }
    if (
      this._root &&
      (changed.has('tenant') ||
        changed.has('locale') ||
        changed.has('careerDataUrl') ||
        changed.has('primaryColor'))
    ) {
      this._render();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._root?.unmount;
    this._root = null;
  }

  private _applyBrandTokens(color: string): void {
    this.style.setProperty('--landi-color-primary', color);
    const hsl = hexToHslComponents(color);
    if (hsl) {
      this.style.setProperty('--landi-color-primary-hsl', hsl);
    }
  }

  private _mount(): void {
    const mount = this.renderRoot.querySelector<HTMLDivElement>('.agentable-app-shell-mount');
    if (!mount) return;
    if (!this._root) {
      this._root = createRoot(mount);
    }
    this._render();
  }

  private _render(): void {
    if (!this._root) return;
    bootstrapSessionLocale({ embedLocale: this.locale });
    this._root.render(
      createElement(AppShellWorkspace, {
        tenant: this.tenant,
        locale: this.locale,
        careerDataUrl: this.careerDataUrl,
        onReady: (detail: AppShellWorkspaceReadyDetail) => {
          this.dispatchEvent(
            new CustomEvent<AgentableAppShellWorkspaceReadyDetail>('agentable:workspace-ready', {
              bubbles: true,
              composed: true,
              detail,
            }));
        },
      }));
  }
}
