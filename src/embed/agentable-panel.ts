/**
 * @docs/features/agentable-panel-single-element.md
 * `<agentable-panel>` — Lit custom-element wrapper for a single panel surface.
 *
 * Panel-only embed: chrome, adapter lifecycle, HITL approval layer, no canvas.
 *
 * <agentable-panel
 * panel="open-positions"
 * config-url="/config/sandals-career.json"
 * primary-color="#0077B6"
 * locale="en"
 * ></agentable-panel>
 * <script type="module" src="/embed/agentable-panel.js"></script>
 *
 * Named page slots (section 15): `slot-name="sidebar"` maps to
 * `data-agentable-slot="sidebar"` for agent `open_panel` targeting.
 *
 * Events bubble + cross the shadow boundary (`composed: true`).
 */
import { IntersectionController } from '@lit-labs/observers/intersection-controller.js';
import { LitElement, css, html, unsafeCSS, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  DEFAULT_LAZY_ROOT_MARGIN,
  panelEmbedSkeletonStyles,
  renderPanelEmbedSkeletonTemplate,
} from './lazyHydration';
import { t } from '../i18n';
import type { Root } from 'react-dom/client';
import { ensurePageSession } from '../session/pageSession';
import { ensurePageSlotRegistry } from '../session/pageSlots';
import { hexToHslComponents } from './utils/hexToHsl';
import {
  mergeEmbedConfig,
  type EmbedBuiltInDefaults,
} from './embedConfigMerge';
import { resolveEmbedPanelData } from './embedConfigLoader';
import {
  buildEmbedConfigReloadDetail,
  type EmbedConfigReloadDetail,
} from './configReloadDetail';
import {
  buildEmbedConfigSourceInput,
  embedConfigSourceChanged,
  hasEmbedConfigSource,
} from './embedConfigHost';
import type {
  EmbedAttributeSnapshot,
  EmbedConfigDocument,
  ResolvedEmbedConfig,
} from './types/embedConfig';
import { setJobsCatalog } from '../stores/jobsCatalogStore';
import { setRoleTaxonomy } from '../stores/roleTaxonomyStore';
import type { RawPanelDataPayload } from '../config/panelDataNormalize';
import { bootstrapSessionLocale } from '../i18n/bootstrapSessionLocale';
import {
  createEmbedBootstrapState,
  embedRenderSignatureChanged,
  runEmbedEnsureReady,
  runEmbedExplicitReload,
  type EmbedBootstrapState,
} from './embedBootstrapLifecycle';
import type { PanelEmbedShellPhase } from './panel/panelEmbedPhases';
import canvasStyles from '../index.css?inline';
import aiPersonaStyles from '../components/ai-persona/AiPersona.css?inline';
import panelEmbedGalleryDarkStyles from './styles/panel-embed-gallery-dark.css?inline';
import panelEmbedCareerLightStyles from './styles/panel-embed-career-light.css?inline';

const DEFAULT_CONFIG: EmbedBuiltInDefaults = {
  tenant: 'default',
  primaryColor: '#3B82F6',
  welcomeMessage: 'Hi! How can I help?',
  apiEndpoint: '/api',
  voiceEnabled: false,
  snapGrid: true,
  systemPrompt: '',
  voiceGreeting: '',
  greetingMode: '',
  tokenEndpoint: '',
  fullpageOnEngage: false,
  canvasMode: 'infinite',
  canvasBounds: '',
  canvasBehavior: '',
  canvasZoom: '',
  hostHeaderHeight: '',
  locale: 'en',
};

export interface AgentablePanelConfigReloadDetail extends EmbedConfigReloadDetail {
  panelId: string;
}

export interface AgentablePanelReadyDetail {
  panelId: string;
  definitionKind: 'spec' | 'react';
}

export interface AgentablePanelAdapterDetail {
  ok: boolean;
  panelId: string;
  error?: string;
}

export interface AgentablePanelErrorDetail {
  code: string;
  message: string;
  panelId: string;
}

export interface AgentablePanelChromeDetail {
  panelId: string;
  minimized: boolean;
}

export interface AgentablePanelApprovalDetail {
  panelId: string;
  count: number;
}

export interface AgentablePanelPhaseDetail {
  panelId: string;
  phase: PanelEmbedShellPhase;
}

export interface AgentablePanelEventMap {
  'agentable:config-reloaded': CustomEvent<AgentablePanelConfigReloadDetail>;
  'agentable:panel-ready': CustomEvent<AgentablePanelReadyDetail>;
  'agentable:adapter-loaded': CustomEvent<AgentablePanelAdapterDetail>;
  'agentable:panel-error': CustomEvent<AgentablePanelErrorDetail>;
  'agentable:chrome-changed': CustomEvent<AgentablePanelChromeDetail>;
  'agentable:approval-pending': CustomEvent<AgentablePanelApprovalDetail>;
  'agentable:phase-changed': CustomEvent<AgentablePanelPhaseDetail>;
}

declare global {
  interface HTMLElementTagNameMap {
    'agentable-panel': AgentablePanelElement;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Lit typed event map augmentation
  interface HTMLElementEventMap extends AgentablePanelEventMap {}
}

@customElement('agentable-panel')
export class AgentablePanelElement extends LitElement {
  /** Registered panel definition id (required). */
  @property({ type: String })
  declare panel: string;

  @property({ type: String })
  declare tenant: string;

  @property({ type: String, attribute: 'primary-color' })
  declare primaryColor: string;

  @property({ type: String, attribute: 'welcome-message' })
  declare welcomeMessage: string;

  @property({ type: String, attribute: 'api-endpoint' })
  declare apiEndpoint: string;

  /** Public anon key for white-label tenant config lookup (G3). */
  @property({ type: String, attribute: 'anon-key' })
  declare anonKey: string;

  /** Override route for anon-key lookup (default `/agentable/embed/config`). */
  @property({ type: String, attribute: 'config-path' })
  declare configPath: string;

  @property({ type: Boolean, attribute: 'voice-enabled' })
  declare voiceEnabled: boolean;

  @property({ type: Boolean, attribute: 'snap-grid' })
  declare snapGrid: boolean;

  @property({ type: String, attribute: 'system-prompt' })
  declare systemPrompt: string;

  @property({ type: String, attribute: 'voice-greeting' })
  declare voiceGreeting: string;

  @property({ type: String, attribute: 'voice-greeting-mode' })
  declare greetingMode: string;

  @property({ type: String, attribute: 'token-endpoint' })
  declare tokenEndpoint: string;

  @property({ type: String })
  declare locale: string;

  @property({ type: String, attribute: 'config-url' })
  declare configUrl: string;

  @property({ type: String, attribute: 'panel-data-url' })
  declare panelDataUrl: string;

  /** Optional chrome title override (i18n keys supported). */
  @property({ type: String, attribute: 'panel-title' })
  declare panelTitle: string;

  /** Hide framework chrome (full-bleed body only). */
  @property({ type: Boolean, attribute: 'hide-chrome' })
  declare hideChrome: boolean;

  /** Named page-session slot id. */
  @property({ type: String, attribute: 'slot-name' })
  declare slotName: string;

  /** Defer session join + React mount until the element intersects the viewport. */
  @property({ type: Boolean, attribute: 'lazy-hydrate' })
  declare lazyHydrate: boolean;

  @state()
  private declare _hydrated: boolean;

  private _participantId = `panel-embed-${Math.random().toString(36).slice(2, 10)}`;
  private _root: Root | null = null;
  private _reactModules: {
    createRoot: typeof import('react-dom/client').createRoot;
    createElement: typeof import('react').createElement;
    PanelEmbedShell: typeof import('./panel/PanelEmbedShell').PanelEmbedShell;
  } | null = null;
  private _configDocument: EmbedConfigDocument | null = null;
  private _panelDataRaw: RawPanelDataPayload | null = null;
  private _resolved: ResolvedEmbedConfig | null = null;
  private _bootstrapState: EmbedBootstrapState = createEmbedBootstrapState();
  private _slotUnregister: (() => void) | null = null;
  private _activated = false;
  private _visibility = new IntersectionController(this, {
    config: { rootMargin: DEFAULT_LAZY_ROOT_MARGIN, threshold: 0 },
    callback: (entries) => entries.some((entry) => entry.isIntersecting),
  });

  constructor() {
    super();
    this.panel = '';
    this.tenant = DEFAULT_CONFIG.tenant;
    this.primaryColor = DEFAULT_CONFIG.primaryColor;
    this.welcomeMessage = DEFAULT_CONFIG.welcomeMessage;
    this.apiEndpoint = DEFAULT_CONFIG.apiEndpoint;
    this.anonKey = '';
    this.configPath = '';
    this.voiceEnabled = DEFAULT_CONFIG.voiceEnabled;
    this.snapGrid = DEFAULT_CONFIG.snapGrid;
    this.systemPrompt = DEFAULT_CONFIG.systemPrompt;
    this.voiceGreeting = DEFAULT_CONFIG.voiceGreeting;
    this.greetingMode = DEFAULT_CONFIG.greetingMode;
    this.tokenEndpoint = DEFAULT_CONFIG.tokenEndpoint;
    this.locale = DEFAULT_CONFIG.locale;
    this.configUrl = '';
    this.panelDataUrl = '';
    this.panelTitle = '';
    this.hideChrome = false;
    this.slotName = '';
    this.lazyHydrate = false;
    this._hydrated = false;
  }

  static styles = [
    unsafeCSS(canvasStyles),
    unsafeCSS(aiPersonaStyles),
    unsafeCSS(panelEmbedGalleryDarkStyles),
    unsafeCSS(panelEmbedCareerLightStyles),
    panelEmbedSkeletonStyles,
    css`.visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }:host {
        display: block;
        position: relative;
        width: 100%;
        min-height: 420px;
        contain: layout paint;
        background: var(--landi-color-background, #f0f0ec);
        --landi-radius-panel: var(--landi-radius-lg, 12px);
      }.agentable-panel-mount {
        position: relative;
        width: 100%;
        min-height: inherit;
        height: 100%;
      }
    `,
  ];

  render() {
    if (this.lazyHydrate && !this._hydrated) {
      return renderPanelEmbedSkeletonTemplate(t('chrome.panel.loading'));
    }
    return html`<div part="mount" class="agentable-panel-mount"></div>`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.lazyHydrate) {
      this._hydrated = true;
    }
  }

  willUpdate(changed: PropertyValues<this>): void {
    if (this.lazyHydrate && this._visibility.value === true) {
      this._hydrated = true;
    }
    if (changed.has('lazyHydrate') && !this.lazyHydrate) {
      this._hydrated = true;
    }
  }

  firstUpdated(): void {
    if (this._hydrated) {
      this._activatePanel();
    }
  }

  updated(changed: PropertyValues<this>): void {
    if (changed.has('_hydrated') && this._hydrated && !this._activated) {
      this._activatePanel();
    }
    if (changed.has('primaryColor') && this.hasAttribute('primary-color')) {
      this._applyBrandTokens(this.primaryColor);
    }

    const configSourceChanged = embedConfigSourceChanged(changed);
    const reactPropsChanged =
      changed.has('panel') ||
      changed.has('tenant') ||
      changed.has('locale') ||
      changed.has('panelTitle') ||
      changed.has('hideChrome') ||
      changed.has('slotName') ||
      configSourceChanged;
    if (configSourceChanged && hasEmbedConfigSource(this)) {
      void this._reloadConfig(false);
      return;
    }

    if (reactPropsChanged) {
      this._recomputeResolved();
      void this._renderReact();
    }

    if (changed.has('slotName')) {
      this._syncNamedSlotRegistration();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._slotUnregister?.();
    this._slotUnregister = null;
    if (this._activated) {
      ensurePageSession().leave(this._participantId);
    }
    this._activated = false;
    if (this._root) {
      this._root.unmount();
      this._root = null;
    }
  }

  async reload(): Promise<void> {
    await runEmbedExplicitReload(this._bootstrapState, () => this._reloadConfig(true));
  }

  private _activatePanel(): void {
    if (this._activated) {
      return;
    }
    this._activated = true;
    ensurePageSession().join(this._participantId);
    this._syncNamedSlotRegistration();
    if (this.hasAttribute('primary-color')) {
      this._applyBrandTokens(this.primaryColor);
    }
    if (this.hasAttribute('data-skip-react-mount')) {
      void this._reloadConfig(false);
      return;
    }
    void this._bootstrap();
  }

  private _syncNamedSlotRegistration(): void {
    this._slotUnregister?.();
    this._slotUnregister = null;
    const slotId = this.slotName.trim();
    if (!slotId || typeof window === 'undefined') {
      return;
    }

    const parentSlot = this.closest('[data-agentable-slot]');
    if (
      parentSlot instanceof HTMLElement &&
      parentSlot.getAttribute('data-agentable-slot')?.trim() === slotId
    ) {
      return;
    }

    this._slotUnregister = ensurePageSlotRegistry().register(slotId, this);
  }

  private _attributeSnapshot(): EmbedAttributeSnapshot {
    return {
      tenant: this.hasAttribute('tenant') ? this.tenant: '',
      primaryColor: this.hasAttribute('primary-color') ? this.primaryColor: '',
      welcomeMessage: this.hasAttribute('welcome-message') ? this.welcomeMessage: '',
      apiEndpoint: this.hasAttribute('api-endpoint') ? this.apiEndpoint: '',
      voiceEnabled: this.voiceEnabled,
      voiceEnabledSet: this.hasAttribute('voice-enabled'),
      snapGrid: this.snapGrid,
      snapGridSet: this.hasAttribute('snap-grid'),
      systemPrompt: this.hasAttribute('system-prompt') ? this.systemPrompt: '',
      voiceGreeting: this.hasAttribute('voice-greeting') ? this.voiceGreeting: '',
      greetingMode: this.hasAttribute('voice-greeting-mode') ? this.greetingMode: '',
      tokenEndpoint: this.hasAttribute('token-endpoint') ? this.tokenEndpoint: '',
      fullpageOnEngage: false,
      fullscreenOnEngage: false,
      fullpageOnEngageSet: false,
      canvasMode: '',
      canvasBounds: '',
      canvasBehavior: '',
      canvasZoom: '',
      hostHeaderHeight: '',
      locale: this.hasAttribute('locale') ? this.locale: '',
      toolbarConfigJson: '',
    };
  }

  private _recomputeResolved(): void {
    this._resolved = mergeEmbedConfig(
      DEFAULT_CONFIG,
      this._configDocument,
      this._attributeSnapshot(),
      this._panelDataRaw);
    this._syncAgentStores(this._panelDataRaw);
    this._applyBrandTokens(this._resolved.primaryColor);
  }

  private _syncAgentStores(panelDataRaw: RawPanelDataPayload | null): void {
    setJobsCatalog(panelDataRaw?.jobs);
    setRoleTaxonomy(panelDataRaw?.roleTaxonomy);
  }

  private async _ensureReady(): Promise<void> {
    await runEmbedEnsureReady(this._bootstrapState, () => this._reloadConfig(false));
  }

  private async _bootstrap(): Promise<void> {
    await this._ensureReady();
  }

  private async _reloadConfig(dispatchEvent: boolean): Promise<void> {
    let ok = true;
    let caughtError: unknown;

    try {
      if (hasEmbedConfigSource(this)) {
        const resolved = await resolveEmbedPanelData(
          buildEmbedConfigSourceInput(this, fetch.bind(globalThis)));
        this._configDocument = resolved.configDoc;
        this._panelDataRaw = resolved.panelDataRaw;
      } else {
        this._configDocument = null;
        this._panelDataRaw = null;
      }
    } catch (error: unknown) {
      ok = false;
      caughtError = error;
      console.error(`[agentable-panel] Failed to load embed config:`, error);
    }

    this._recomputeResolved();
    if (this._shouldMountReact()) {
      if (!this._root) {
        await this._mountReact();
      } else {
        await this._renderReact();
      }
    }

    if (dispatchEvent) {
      const base = buildEmbedConfigReloadDetail(ok, caughtError);
      const detail: AgentablePanelConfigReloadDetail = {...base,
        panelId: this.panel,
      };
      this.dispatchEvent(
        new CustomEvent<AgentablePanelConfigReloadDetail>('agentable:config-reloaded', {
          bubbles: true,
          composed: true,
          detail,
        }));
    }
  }

  private _shouldMountReact(): boolean {
    return !this.hasAttribute('data-skip-react-mount');
  }

  private _applyBrandTokens(color: string = this.primaryColor): void {
    this.style.setProperty('--landi-color-primary', color);
    const hsl = hexToHslComponents(color);
    if (hsl) {
      this.style.setProperty('--landi-color-primary-hsl', hsl);
    }
  }

  private async _ensureReactModules(): Promise<NonNullable<AgentablePanelElement['_reactModules']>> {
    if (this._reactModules) {
      return this._reactModules;
    }
    const [reactDom, react, shell] = await Promise.all([
      import('react-dom/client'),
      import('react'),
      import('./panel/PanelEmbedShell'),
    ]);
    this._reactModules = {
      createRoot: reactDom.createRoot,
      createElement: react.createElement,
      PanelEmbedShell: shell.PanelEmbedShell,
    };
    return this._reactModules;
  }

  private async _mountReact(): Promise<void> {
    if (!this._shouldMountReact()) {
      return;
    }
    const mount = this.renderRoot.querySelector<HTMLDivElement>('.agentable-panel-mount');
    if (!mount) {
      return;
    }
    const { createRoot } = await this._ensureReactModules();
    if (!this._root) {
      this._root = createRoot(mount);
    }
    await this._renderReact();
  }

  private async _renderReact(): Promise<void> {
    if (!this._root || !this._shouldMountReact()) {
      return;
    }
    if (!this._resolved) {
      this._recomputeResolved();
    }
    const resolved = this._resolved;
    if (!resolved) {
      return;
    }

    const { createElement, PanelEmbedShell } = await this._ensureReactModules();

    bootstrapSessionLocale({
      embedLocale: this.locale,
      tenantLocale: resolved.tenantConfig.locale ?? resolved.locale,
    });

    const panelId = this.panel.trim();
    const signature = JSON.stringify({
      panelId,
      tenant: resolved.tenantConfig.tenant ?? resolved.tenant ?? this.tenant,
      primaryColor: resolved.primaryColor,
      locale: resolved.locale,
      panelTitle: this.panelTitle,
      hideChrome: this.hideChrome,
      slotName: this.slotName,
    });
    if (!embedRenderSignatureChanged(this._bootstrapState, signature)) {
      return;
    }

    this._root.render(
      createElement(PanelEmbedShell, {
        panelId,
        tenantConfig: resolved.tenantConfig,
        locale: resolved.locale,
        configDocument: this._configDocument,
        panelDataRaw: this._panelDataRaw,
        panelData: resolved.tenantConfig.panelData as Record<string, unknown> | undefined,
        titleOverride: this.panelTitle || undefined,
        hideChrome: this.hideChrome,
        namedSlot: this.slotName || undefined,
        onPhaseChange: (phase) => {
          this.dispatchEvent(
            new CustomEvent<AgentablePanelPhaseDetail>('agentable:phase-changed', {
              bubbles: true,
              composed: true,
              detail: { panelId, phase },
            }));
        },
        onReady: (detail) => {
          this.dispatchEvent(
            new CustomEvent<AgentablePanelReadyDetail>('agentable:panel-ready', {
              bubbles: true,
              composed: true,
              detail,
            }));
        },
        onAdapterLoaded: (detail) => {
          this.dispatchEvent(
            new CustomEvent<AgentablePanelAdapterDetail>('agentable:adapter-loaded', {
              bubbles: true,
              composed: true,
              detail: {...detail, panelId },
            }));
        },
        onError: (detail) => {
          this.dispatchEvent(
            new CustomEvent<AgentablePanelErrorDetail>('agentable:panel-error', {
              bubbles: true,
              composed: true,
              detail: {...detail, panelId },
            }));
        },
        onChromeChange: (detail) => {
          this.dispatchEvent(
            new CustomEvent<AgentablePanelChromeDetail>('agentable:chrome-changed', {
              bubbles: true,
              composed: true,
              detail: { panelId, minimized: detail.minimized },
            }));
        },
        onApprovalPending: (detail) => {
          this.dispatchEvent(
            new CustomEvent<AgentablePanelApprovalDetail>('agentable:approval-pending', {
              bubbles: true,
              composed: true,
              detail: { panelId, count: detail.count },
            }));
        },
      }));
  }
}
