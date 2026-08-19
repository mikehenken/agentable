/**
 * agentable-whiteboard — Lit custom-element wrapper for WhiteboardShell (tldraw).
 *
 * Parallel to `<agentable-canvas>` (CanvasShell / DraggablePanel substrate).
 * Use this tag when the host page needs PanelShape panels on a tldraw canvas.
 *
 *     <agentable-whiteboard
 *       tenant="archipelago"
 *       config-url="/config/archipelago-career.json"
 *       canvas-mode="bounded"
 *       canvas-bounds="1200x800"
 *       voice-enabled
 *       snap-grid
 *       toolbar-config='{"tools":["select","draw","hand","layers","voice","auto-arrange","reset"],"layoutActionPlacement":"both"}'
 *     ></agentable-whiteboard>
 *     <script type="module" src="/embed/agentable-whiteboard.js"></script>
 *
 * Config loading, merge order, and brand tokens match the canvas embed contract.
 * Toolbar: attribute `toolbar-config` (JSON) wins over config-url `toolbar` /
 * `toolbarConfig`. {@link DEFAULT_WHITEBOARD_TOOLBAR_TOOLS} applies when both are omitted.
 */
import { LitElement, css, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRoot, type Root } from 'react-dom/client';
import { StrictMode, createElement, Fragment } from 'react';
import { WhiteboardShell } from '../engines/tldraw/WhiteboardShell';
import type { WhiteboardShellProps } from '../engines/tldraw/WhiteboardShell';
import { ensureVoiceKernel } from '../shared/voiceKernel';
import { ensurePageSession } from '../session/pageSession';
import { hexToHslComponents } from './utils/hexToHsl';
import {
  parseCanvasModeFromEmbed,
  parseHostHeaderHeight,
  type ParseCanvasModeInput,
} from '../engines/tldraw/canvasMode';
import type { CanvasMode } from '../engine/types';
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
import canvasStyles from '../index.css?inline';
import { tldrawStyles } from '../engines/tldraw/styles/tldrawBaseStyles';
import whiteboardDarkStyles from '../engines/tldraw/styles/whiteboard-vibe-dark.css?inline';
// AiPersona.tsx side-effect-imports AiPersona.css → Vite extracts it to the
// document-level agentable-whiteboard.css. That sheet does NOT pierce the Lit
// shadow root, so halo rings/keyframes never apply unless we also inline here.
import aiPersonaStyles from '../components/ai-persona/AiPersona.css?inline';
import {
  runGalleryScriptedTool,
  runMeridianGalleryStep,
  runNorthstarGalleryStep,
  waitForGalleryWhiteboardReady,
  type GalleryScriptedToolName,
  type GalleryScriptedToolResult,
  type MeridianDemoStep,
  type MeridianDemoSummary,
  type MeridianDocumentDemoResult,
  type MeridianExportDemoResult,
  type MeridianHitlDemoResult,
  type NorthstarDemoStep,
  type NorthstarDemoSummary,
} from './galleryScriptedDemo';
import { withAgentToolContextAsync } from '../agents/agentContext';
import { OPERATOR_TOOL_CONTEXT } from '../agents/surface/operatorRegistrationBridge';
import {
  createMeridianGalleryHostBundle,
  disposeMeridianGalleryHostBundle,
  setMeridianGalleryHostBundle,
  type MeridianGalleryHostBundle,
} from './meridian/meridianGalleryHost';
import { MeridianGalleryHostProvider } from './meridian/MeridianGalleryHostContext';
import { MeridianEngineBindingBridge } from './meridian/MeridianEngineBindingBridge';
import { MeridianGalleryDemoVisuals } from './meridian/MeridianGalleryDemoVisuals';
import { createMeridianDocumentPanelLoader } from './meridian/MeridianDocumentPanelHost';
import { DEFAULT_WHITEBOARD_PANEL_REGISTRY } from '../engines/tldraw/shapes/whiteboardPanelRegistry';
import { getEditor } from '../engines/tldraw/shapes/panelShapeApi';
import {
  createEmbedBootstrapState,
  embedRenderSignatureChanged,
  runEmbedEnsureReady,
  runEmbedExplicitReload,
  type EmbedBootstrapState,
} from './embedBootstrapLifecycle';
import {
  resolveWhiteboardEmbedWiring,
  type ResolveWhiteboardEmbedWiringState,
} from './whiteboard/resolveWhiteboardEmbedWiring';
import { createCareerNavFooterRenderer } from '../../packages/career-pack/src/whiteboard/createCareerNavFooterRenderer';
import type { WhiteboardWiringProviderResult } from './whiteboard/whiteboardWiringProviderRegistry';
import { onWhiteboardWiringProvidersChanged } from './whiteboard/whiteboardWiringProviderRegistry';
import { applyHostHeaderHeight } from './whiteboard/embedHostChrome';

const DEFAULT_CONFIG: EmbedBuiltInDefaults = {
  tenant: 'default',
  primaryColor: '#3B82F6',
  welcomeMessage: 'Hi! How can I help?',
  apiEndpoint: '/api',
  voiceEnabled: false,
  snapGrid: false,
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

export type AgentableWhiteboardConfigReloadDetail = EmbedConfigReloadDetail;

export type {
  GalleryScriptedToolName,
  GalleryScriptedToolResult,
  MeridianDemoStep,
  MeridianDemoSummary,
  MeridianDocumentDemoResult,
  MeridianExportDemoResult,
  MeridianHitlDemoResult,
  NorthstarDemoStep,
  NorthstarDemoSummary,
} from './galleryScriptedDemo';

@customElement('agentable-whiteboard')
export class AgentableWhiteboardElement extends LitElement {
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

  @property({ type: Boolean, attribute: 'fullpage-on-engage' })
  declare fullpageOnEngage: boolean;

  @property({ type: Boolean, attribute: 'fullscreen-on-engage' })
  declare fullscreenOnEngage: boolean;

  @property({ type: String, attribute: 'canvas-mode' })
  declare canvasMode: string;

  @property({ type: String, attribute: 'canvas-bounds' })
  declare canvasBounds: string;

  @property({ type: String, attribute: 'canvas-behavior' })
  declare canvasBehavior: string;

  @property({ type: String, attribute: 'canvas-zoom' })
  declare canvasZoom: string;

  @property({ type: String, attribute: 'host-header-height' })
  declare hostHeaderHeight: string;

  @property({ type: String })
  declare locale: string;

  @property({ type: String, attribute: 'config-url' })
  declare configUrl: string;

  @property({ type: String, attribute: 'panel-data-url' })
  declare panelDataUrl: string;

  /**
   * JSON toolbar config attribute. Example:
   * `toolbar-config='{"tools":["select","draw","hand","layers","voice"],"layoutActionPlacement":"both"}'`
   */
  @property({ type: String, attribute: 'toolbar-config' })
  declare toolbarConfig: string;

  /**
   * When false, skip opening the floating Atlas chat PanelShape on mount.
   * Example 13 uses the operator rail as the sole chat surface.
   */
  @property({ type: Boolean, attribute: 'open-chat-on-mount' })
  declare openChatOnMount: boolean;

  /**
   * When true, purge chat PanelShape on mount and block recreation.
   * Stronger than open-chat-on-mount=false alone — handles IndexedDB restore.
   */
  @property({ type: Boolean, attribute: 'suppress-canvas-chat' })
  declare suppressCanvasChat: boolean;

  /**
   * Opt into vibe-dark whiteboard chrome. When omitted, defaults to light.
   * Set `light-canvas` to force light; set `dark-canvas` for gallery / operator demos.
   */
  @property({ type: Boolean, attribute: 'dark-canvas' })
  declare darkCanvas: boolean;

  @property({ type: Boolean, attribute: 'light-canvas' })
  declare lightCanvas: boolean;

  private _participantId = `whiteboard-embed-${Math.random().toString(36).slice(2, 10)}`;
  private _root: Root | null = null;
  private _configDocument: EmbedConfigDocument | null = null;
  private _panelDataRaw: RawPanelDataPayload | null = null;
  private _resolved: ResolvedEmbedConfig | null = null;
  private _bootstrapState: EmbedBootstrapState = createEmbedBootstrapState();
  private _meridianHostBundle: MeridianGalleryHostBundle | null = null;
  private _whiteboardWiringProvider: WhiteboardWiringProviderResult | null = null;
  private _wiringProviderUnsub: (() => void) | null = null;

  constructor() {
    super();
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
    this.fullpageOnEngage = DEFAULT_CONFIG.fullpageOnEngage;
    this.fullscreenOnEngage = DEFAULT_CONFIG.fullpageOnEngage;
    this.canvasMode = DEFAULT_CONFIG.canvasMode;
    this.canvasBounds = DEFAULT_CONFIG.canvasBounds;
    this.canvasBehavior = DEFAULT_CONFIG.canvasBehavior;
    this.canvasZoom = DEFAULT_CONFIG.canvasZoom;
    this.hostHeaderHeight = DEFAULT_CONFIG.hostHeaderHeight;
    this.locale = DEFAULT_CONFIG.locale;
    this.configUrl = '';
    this.panelDataUrl = '';
    this.toolbarConfig = '';
    this.openChatOnMount = true;
    this.suppressCanvasChat = false;
    this.darkCanvas = false;
    this.lightCanvas = false;
  }

  static styles = [
    unsafeCSS(canvasStyles),
    unsafeCSS(tldrawStyles),
    unsafeCSS(whiteboardDarkStyles),
    unsafeCSS(aiPersonaStyles),
    css`:host {
        display: block;
        position: relative;
        width: 100%;
        min-height: 600px;
        contain: layout paint;
        background: var(--landi-color-background, #f0f0ec);
      }:host(.agentable-canvas-host-fullpage) {
        width: 100%;
        height: 100%;
        min-height: 0;
        max-height: none;
      }.agentable-whiteboard-mount {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
    `,
  ];

  render() {
    return html`<div class="agentable-whiteboard-mount"></div>`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this._root !== null || this.hasAttribute('data-skip-react-mount')) {
      return;
    }
    // Gallery chrome reparents this element through a brief disconnect; remount React on reconnect.
    queueMicrotask(() => {
      if (this._root !== null || !this.isConnected || this.hasAttribute('data-skip-react-mount')) {
        return;
      }
      const mount = this.renderRoot.querySelector<HTMLDivElement>('.agentable-whiteboard-mount');
      if (mount === null) {
        return;
      }
      void this._ensureReady().then(() => {
        if (this._root === null && this.isConnected && this._shouldMountReact()) {
          this._mountReact();
        }
      });
    });
  }

  firstUpdated(): void {
    ensureVoiceKernel();
    ensurePageSession().join(this._participantId);
    this._wiringProviderUnsub = onWhiteboardWiringProvidersChanged(() => {
      this.refreshWhiteboardWiring();
    });
    // Brand tokens applied after config merge in `_recomputeResolved` so
    // config-url primaryColor (e.g. Archipelago #0077B6) is not overwritten by
    // the Lit constructor default (#3B82F6). Explicit `primary-color` still
    // wins via attribute snapshot + merge.
    if (this.hasAttribute('primary-color')) {
      this._applyBrandTokens(this.primaryColor);
    }
    if (this.hasAttribute('data-skip-react-mount')) {
      void this._reloadConfig(false);
      return;
    }
    void this._bootstrap();
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('primaryColor') && this.hasAttribute('primary-color')) {
      this._applyBrandTokens(this.primaryColor);
    }

    const configSourceChanged = embedConfigSourceChanged(changed);
    const reactPropsChanged =
      changed.has('tenant') ||
      changed.has('systemPrompt') ||
      changed.has('voiceGreeting') ||
      changed.has('greetingMode') ||
      changed.has('tokenEndpoint') ||
      changed.has('snapGrid') ||
      changed.has('canvasMode') ||
      changed.has('canvasBounds') ||
      changed.has('canvasBehavior') ||
      changed.has('canvasZoom') ||
      changed.has('locale') ||
      changed.has('toolbarConfig') ||
      changed.has('openChatOnMount') ||
      changed.has('suppressCanvasChat') ||
      changed.has('darkCanvas') ||
      changed.has('lightCanvas') ||
      configSourceChanged;
    if (configSourceChanged && hasEmbedConfigSource(this)) {
      void this._reloadConfig(false);
      return;
    }

    if (reactPropsChanged) {
      this._recomputeResolved();
      this._renderReact();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._wiringProviderUnsub?.();
    this._wiringProviderUnsub = null;
    ensurePageSession().leave(this._participantId);
    if (this._meridianHostBundle !== null) {
      disposeMeridianGalleryHostBundle();
      this._meridianHostBundle = null;
    }
    this._whiteboardWiringProvider?.dispose();
    this._whiteboardWiringProvider = null;
    if (this._root) {
      this._root.unmount();
      this._root = null;
    }
  }

  async reload(): Promise<void> {
    await runEmbedExplicitReload(this._bootstrapState, () => this._reloadConfig(true));
  }

  /**
   * Re-resolve pack wiring when a provider registers after first mount (split-script hosts).
   * Idempotent when wiring already came from an active provider or Meridian gallery bundle.
   */
  refreshWhiteboardWiring(): void {
    if (!this.isConnected || this._root === null || this._resolved === null) {
      return;
    }
    if (this._meridianHostBundle !== null || this._whiteboardWiringProvider !== null) {
      return;
    }
    this._bootstrapState.lastRenderSignature = null;
    this._renderReact();
    if (import.meta.env.DEV && this._whiteboardWiringProvider !== null) {
      console.info(
        '[agentable-whiteboard] Pack wiring provider registered after first mount — wiring upgraded.');
    }
  }

  startVoiceCall(): void {
    this.dispatchEvent(
      new CustomEvent('landi:voice-start-requested', {
        bubbles: true,
        composed: true,
      }));
  }

  endVoiceCall(): void {
    this.dispatchEvent(
      new CustomEvent('landi:voice-end-requested', {
        bubbles: true,
        composed: true,
      }));
  }

  /** Wait until the tldraw editor and draw tools are ready (gallery demos). */
  async whenReady(timeoutMs = 20_000): Promise<boolean> {
    await this._ensureReady();
    return waitForGalleryWhiteboardReady(timeoutMs);
  }

  /** Blur the bound tldraw editor when operator composer takes focus. */
  blurCanvasEditor(): void {
    getEditor()?.blur();
  }

  /**
   * Run a scripted agent tool without an LLM (draw_shapes, read_canvas,
   * clear_agent_drawings). Uses the active whiteboard engine internally.
   */
  async runScriptedTool(
    toolName: GalleryScriptedToolName,
    args: Record<string, unknown> = {}): Promise<GalleryScriptedToolResult> {
    await this._ensureReady();
    const ready = await waitForGalleryWhiteboardReady();
    if (!ready) {
      return { ok: false, toolName, error: 'Whiteboard editor not ready' };
    }
    return runGalleryScriptedTool(toolName, args);
  }

  /**
   * Run a scripted tool stamped with the canvas-wide operator agent context.
 * Keeps draw/read paths on the bound whiteboard editor.
   */
  async runOperatorScriptedTool(
    toolName: GalleryScriptedToolName,
    args: Record<string, unknown> = {}): Promise<GalleryScriptedToolResult> {
    await this._ensureReady();
    const ready = await waitForGalleryWhiteboardReady();
    if (!ready) {
      return { ok: false, toolName, error: 'Whiteboard editor not ready' };
    }
    return withAgentToolContextAsync(OPERATOR_TOOL_CONTEXT, () =>
      runGalleryScriptedTool(toolName, args));
  }

  /**
   * Northstar Atelier gallery demo step — same fixtures as P8 harness.
   * Steps: clear | draw-flow | draw-batch | read-canvas | full
   */
  async runNorthstarDemo(step: NorthstarDemoStep): Promise<{
    ok: boolean;
    summary?: NorthstarDemoSummary;
    steps: GalleryScriptedToolResult[];
  }> {
    await this._ensureReady();
    return runNorthstarGalleryStep(step);
  }

  /**
 * Meridian Labs gallery demo — connected wireframe funnel + stencils.
   * Steps: wireframe | full (both run the full onboarding wireframe set).
   */
  async runMeridianDemo(step: MeridianDemoStep): Promise<{
    ok: boolean;
    summary?: MeridianDemoSummary;
    steps: GalleryScriptedToolResult[];
    document?: MeridianDocumentDemoResult;
    export?: MeridianExportDemoResult;
    hitl?: MeridianHitlDemoResult;
  }> {
    await this._ensureReady();
    return runMeridianGalleryStep(step);
  }

  private _isMeridianLabsTenant(resolved: ResolvedEmbedConfig): boolean {
    const tenant = resolved.tenantConfig.tenant ?? resolved.tenant ?? this.tenant;
    return tenant === 'meridian-labs';
  }

  private _ensureMeridianHostBundle(): MeridianGalleryHostBundle | null {
    if (this._meridianHostBundle !== null) {
      return this._meridianHostBundle;
    }
    if (!this._resolved || !this._isMeridianLabsTenant(this._resolved)) {
      return null;
    }
    const bundle = createMeridianGalleryHostBundle();
    this._meridianHostBundle = bundle;
    setMeridianGalleryHostBundle(bundle);
    return bundle;
  }

  private _attributeSnapshot(): EmbedAttributeSnapshot {
    // Empty string = "attribute not set" so config-url / CSS can win.
    // Lit constructors always assign built-in defaults; treating those as
    // explicit attributes would permanently shadow archipelago-career.json
    // primaryColor / welcomeMessage (and other persona fields).
    return {
      tenant: this.hasAttribute('tenant') ? this.tenant : '',
      primaryColor: this.hasAttribute('primary-color') ? this.primaryColor : '',
      welcomeMessage: this.hasAttribute('welcome-message')
        ? this.welcomeMessage: '',
      apiEndpoint: this.hasAttribute('api-endpoint') ? this.apiEndpoint : '',
      voiceEnabled: this.voiceEnabled,
      voiceEnabledSet: this.hasAttribute('voice-enabled'),
      snapGrid: this.snapGrid,
      snapGridSet: this.hasAttribute('snap-grid'),
      systemPrompt: this.hasAttribute('system-prompt') ? this.systemPrompt : '',
      voiceGreeting: this.hasAttribute('voice-greeting')
        ? this.voiceGreeting: '',
      greetingMode: this.hasAttribute('voice-greeting-mode')
        ? this.greetingMode: '',
      tokenEndpoint: this.hasAttribute('token-endpoint')
        ? this.tokenEndpoint: '',
      fullpageOnEngage: this.fullpageOnEngage,
      fullscreenOnEngage: this.fullscreenOnEngage,
      fullpageOnEngageSet:
        this.hasAttribute('fullpage-on-engage') ||
        this.hasAttribute('fullscreen-on-engage'),
      canvasMode: this.hasAttribute('canvas-mode') ? this.canvasMode : '',
      canvasBounds: this.hasAttribute('canvas-bounds') ? this.canvasBounds : '',
      canvasBehavior: this.hasAttribute('canvas-behavior')
        ? this.canvasBehavior: '',
      canvasZoom: this.hasAttribute('canvas-zoom') ? this.canvasZoom : '',
      hostHeaderHeight: this.hasAttribute('host-header-height')
        ? this.hostHeaderHeight: '',
      locale: this.hasAttribute('locale') ? this.locale : '',
      toolbarConfigJson: this.toolbarConfig,
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
      const source =
        this.configUrl ||
        this.panelDataUrl ||
        (this.anonKey ? `anon-key:${this.anonKey.slice(0, 8)}…` : 'unknown');
      console.error(
        `[agentable-whiteboard] Failed to load embed config from "${source}":`,
        error);
    }

    this._recomputeResolved();
    if (this._shouldMountReact()) {
      if (!this._root) {
        this._mountReact();
      } else {
        this._renderReact();
      }
    }

    if (dispatchEvent) {
      const detail = buildEmbedConfigReloadDetail(ok, caughtError);
      this.dispatchEvent(
        new CustomEvent<AgentableWhiteboardConfigReloadDetail>(
          'agentable:config-reloaded',
          {
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
    } else {
      console.warn(
        `[agentable-whiteboard] primary-color="${color}" is not a valid hex (#RGB or #RRGGBB); --landi-color-primary-hsl unchanged.`);
    }
  }

  private _mountReact(): void {
    const shadow = this.renderRoot;
    const mount = shadow.querySelector<HTMLDivElement>('.agentable-whiteboard-mount');
    if (!mount) return;
    this._root = createRoot(mount);
    this._renderReact();
  }

  private _resolvedCanvasMode(): CanvasMode {
    const input: ParseCanvasModeInput =
      this._resolved?.canvasModeInput ?? {
        mode: this.canvasMode,
        bounds: this.canvasBounds,
        behavior: this.canvasBehavior,
        zoom: this.canvasZoom,
      };
    return parseCanvasModeFromEmbed(input);
  }

  private _whiteboardRenderSignature(resolved: ResolvedEmbedConfig): string {
    const tenant = resolved.tenantConfig.tenant ?? resolved.tenant ?? this.tenant;
    return JSON.stringify({
      tenant,
      primaryColor: resolved.primaryColor,
      voiceEnabled: resolved.voiceEnabled,
      snapGrid: resolved.snapGrid,
      fullpageOnEngage: resolved.fullpageOnEngage,
      hostHeaderHeight: resolved.hostHeaderHeight,
      systemPrompt: resolved.tenantConfig.persona?.systemPrompt ?? '',
      canvasMode: this._resolvedCanvasMode(),
      openChatOnMount: this.openChatOnMount,
      suppressCanvasChat: this.suppressCanvasChat,
      darkCanvas: this._resolveDarkCanvas(),
      toolbarConfig: resolved.toolbarConfig ?? null,
      locale: resolved.locale,
      meridian: tenant === 'meridian-labs',
      panelDataKeys: this._panelDataRaw ? Object.keys(this._panelDataRaw).sort() : [],
      configPanels: this._configDocument?.panels ?? null,
    });
  }

  private _applyHostChrome(resolved: ResolvedEmbedConfig): void {
    const parsedHeight = parseHostHeaderHeight(resolved.hostHeaderHeight);
    if (parsedHeight !== null) {
      applyHostHeaderHeight(this, parsedHeight);
    } else if (!this.hasAttribute('host-header-height')) {
      this.style.removeProperty('--agentable-host-header-height');
    }
  }

  private _resolveWhiteboardWiring(resolved: ResolvedEmbedConfig) {
    const tenant = resolved.tenantConfig.tenant ?? resolved.tenant ?? this.tenant;
    const result: ResolveWhiteboardEmbedWiringState = resolveWhiteboardEmbedWiring(
      {
        configDocument: this._configDocument,
        tenantConfig: resolved.tenantConfig,
        panelDataRaw: this._panelDataRaw,
        tenant,
        fetchFn: fetch.bind(globalThis),
      },
      this._whiteboardWiringProvider);
    this._whiteboardWiringProvider = result.activeProvider;
    return result.wiring;
  }

  /**
   * Light vs dark canvas: explicit `light-canvas` / `dark-canvas` attributes only.
   * When neither is set, defaults to light (domain branding arrives via pack config).
   */
  private _resolveDarkCanvas(): boolean {
    if (this.hasAttribute('light-canvas')) {
      return false;
    }
    if (this.hasAttribute('dark-canvas')) {
      return true;
    }
    return false;
  }

  private _renderReact(): void {
    if (!this._root) return;

    if (!this._resolved) {
      this._recomputeResolved();
    }
    const resolved = this._resolved;
    if (!resolved) return;

    const signature = this._whiteboardRenderSignature(resolved);
    if (!embedRenderSignatureChanged(this._bootstrapState, signature)) {
      return;
    }

    bootstrapSessionLocale({
      embedLocale: this.locale,
      tenantLocale: resolved.tenantConfig.locale ?? resolved.locale,
    });

    this._applyHostChrome(resolved);
    const meridianBundle = this._ensureMeridianHostBundle();
    const packWiring = meridianBundle === null ? this._resolveWhiteboardWiring(resolved) : null;

    const whiteboardProps: WhiteboardShellProps = {
      config: resolved.tenantConfig,
      layout: 'infinite-panels',
      mode: this._resolvedCanvasMode(),
      openChatOnMount: this.openChatOnMount,
      suppressCanvasChat: this.suppressCanvasChat,
      darkCanvas: this._resolveDarkCanvas(),
      snapGrid: resolved.snapGrid,
      fullpageOnEngage: resolved.fullpageOnEngage,
      hostHeaderHeight: parseHostHeaderHeight(resolved.hostHeaderHeight),...(resolved.toolbarConfig ? { toolbarConfig: resolved.toolbarConfig }: {}),
      enableVoiceTool: resolved.voiceEnabled,...(meridianBundle !== null
        ? {
            host: meridianBundle.host,
            panels: {...DEFAULT_WHITEBOARD_PANEL_REGISTRY,
              document: createMeridianDocumentPanelLoader(),
            },
          }: packWiring !== null
          ? {...(packWiring.host !== undefined ? { host: packWiring.host }: {}),...(packWiring.navItems.length > 0 ? { navItems: packWiring.navItems }: {}),...(packWiring.navItems.length > 0
                ? { renderNavFooter: createCareerNavFooterRenderer }: {}),...(packWiring.adapterSources.length > 0
                ? { adapterSources: packWiring.adapterSources }: {}),
              panels: packWiring.panelLoaders,
            }: {}),
    };
    const whiteboardElement = createElement(
      WhiteboardShell,
      whiteboardProps as Parameters<typeof createElement>[1]);

    this._root.render(
      createElement(
        StrictMode,
        null,
        meridianBundle !== null
          ? createElement(MeridianGalleryHostProvider, {
              bundle: meridianBundle,
              children: createElement(
                Fragment,
                null,
                createElement(MeridianEngineBindingBridge),
                createElement(MeridianGalleryDemoVisuals),
                whiteboardElement),
            }): whiteboardElement));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'agentable-whiteboard': AgentableWhiteboardElement;
  }
}
