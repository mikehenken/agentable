/**
 * Embed JSON config document (02 section 11).
 *
 * Loaded from the `config-url` attribute. Generalizes moss's lost
 * `panel-data-url` into a structured tenant config + adapter block.
 */
import type { PartialCanvasTenantConfig } from '../../config/CanvasContext';
import type { VoiceGreetingMode } from '../../voice/greetingMode';
import type { RawPanelDataPayload } from '../../config/panelDataNormalize';
import type { ParseCanvasModeInput } from '../../engines/tldraw/canvasMode';
import type { WhiteboardToolbarConfig } from '../../engines/tldraw/toolbar/toolbarConfig';

/** Inline static dataset or URL to a JSON panel-data document. */
export interface StaticEmbedAdapterConfig {
  kind: 'static';
  /** Inline panel-data payload (jobs, resources, growthPaths, …). */
  data?: RawPanelDataPayload;
  /** URL to a JSON panel-data document (moss `panel-data-url` equivalent). */
  dataUrl?: string;
}

/** HTTP-backed adapter — base URL serves the panel-data JSON document for now. */
export interface HttpEmbedAdapterConfig {
  kind: 'http';
  /** Full URL or path to the panel-data JSON document. */
  baseUrl: string;
}

export type EmbedAdapterConfig = StaticEmbedAdapterConfig | HttpEmbedAdapterConfig;

/** Panel registration refs consumed by the whiteboard embed (config-url `panels`). */
export interface EmbedPanelSpecRef {
  id: string;
  kind?: string;
}

/** Document fetched from `config-url`. */
export interface EmbedConfigDocument {
  tenant?: string;
  primaryColor?: string;
  welcomeMessage?: string;
  apiEndpoint?: string;
  voiceEnabled?: boolean;
  snapGrid?: boolean;
  systemPrompt?: string;
  voiceGreeting?: string;
  /** — `agent-first` | `user-first`. */
  greetingMode?: VoiceGreetingMode | string;
  tokenEndpoint?: string;
  fullpageOnEngage?: boolean;
  /** @deprecated Moss alias — same as fullpageOnEngage. */
  fullscreenOnEngage?: boolean;
  canvasMode?: string;
  canvasBounds?: string;
  canvasBehavior?: string;
  canvasZoom?: string;
  hostHeaderHeight?: string;
  /** Nested persona block (preferred over flat system-prompt fields). */
  persona?: PartialCanvasTenantConfig['persona'];
  /** Inline panel data when adapter.kind is static with inline data. */
  panelData?: RawPanelDataPayload;
  /** Data adapter declaration. */
  adapter?: EmbedAdapterConfig;
  /** Session locale (BCP 47); middle precedence after embed attribute. */
  locale?: string;
  /**
   * Whiteboard toolbar config (preferred key). Attribute `toolbar-config`
   * overrides this when present.
   */
  toolbar?: WhiteboardToolbarConfig;
  /** Alias for `toolbar` (camelCase hosts React props). */
  toolbarConfig?: WhiteboardToolbarConfig;
  /** Career domain panel registration refs for the whiteboard embed. */
  panels?: readonly EmbedPanelSpecRef[];
}

/** Snapshot of Lit element attribute values for merge (attributes beat config-url). */
export interface EmbedAttributeSnapshot {
  tenant: string;
  primaryColor: string;
  welcomeMessage: string;
  apiEndpoint: string;
  voiceEnabled: boolean;
  /** True when the `voice-enabled` attribute is present on the host element. */
  voiceEnabledSet: boolean;
  snapGrid: boolean;
  /** True when the `snap-grid` attribute is present on the host element. */
  snapGridSet: boolean;
  systemPrompt: string;
  voiceGreeting: string;
  greetingMode: string;
  tokenEndpoint: string;
  fullpageOnEngage: boolean;
  fullscreenOnEngage: boolean;
  /** True when `fullpage-on-engage` or `fullscreen-on-engage` is present. */
  fullpageOnEngageSet: boolean;
  canvasMode: string;
  canvasBounds: string;
  canvasBehavior: string;
  canvasZoom: string;
  hostHeaderHeight: string;
  locale: string;
  /**
   * Raw JSON string from `toolbar-config` attribute (empty when unset).
   * When non-empty, wins over config-url `toolbar` `toolbarConfig`.
   */
  toolbarConfigJson: string;
}

/** Resolved embed state passed to React after merge. */
export interface ResolvedEmbedConfig {
  tenant: string;
  primaryColor: string;
  welcomeMessage: string;
  apiEndpoint: string;
  voiceEnabled: boolean;
  snapGrid: boolean;
  systemPrompt: string;
  voiceGreeting: string;
  greetingMode: string;
  tokenEndpoint: string;
  fullpageOnEngage: boolean;
  canvasModeInput: ParseCanvasModeInput;
  hostHeaderHeight: string;
  locale: string;
  tenantConfig: PartialCanvasTenantConfig;
  /** Resolved whiteboard toolbar config (career defaults when omitted). */
  toolbarConfig?: WhiteboardToolbarConfig;
}

export type EmbedFetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
