/**
 * DOM helper for mounting `<agentable-panel>` into a host container.
 * Assumes the custom element is already registered.
 */
import type { AgentablePanelElement } from './agentable-panel';
import { readLazyHydrateFlag } from './lazyHydration';

/** Config copied from data-* placeholders onto the custom element. */
export interface AgentablePanelMountConfig {
  panelId: string;
  tenant?: string;
  primaryColor?: string;
  welcomeMessage?: string;
  apiEndpoint?: string;
  voiceEnabled?: boolean;
  snapGrid?: boolean;
  systemPrompt?: string;
  voiceGreeting?: string;
  greetingMode?: string;
  tokenEndpoint?: string;
  locale?: string;
  configUrl?: string;
  panelDataUrl?: string;
  /** Public anon key for tenant config lookup (G3). */
  anonKey?: string;
  /** API base for lookup — maps to `api-endpoint`. */
  apiEndpoint?: string;
  /** Lookup route override — maps to `config-path`. */
  configPath?: string;
  panelTitle?: string;
  hideChrome?: boolean;
  slotName?: string;
  skipReactMount?: boolean;
  lazyHydrate?: boolean;
  theme?: string;
}

const BOOLEAN_TRUE = new Set(['', 'true', '1', 'yes']);

function readBooleanAttribute(source: Element, name: string): boolean | undefined {
  if (!source.hasAttribute(name)) {
    return undefined;
  }
  const raw = source.getAttribute(name);
  if (raw === null) {
    return true;
  }
  return BOOLEAN_TRUE.has(raw.trim().toLowerCase());
}

function readStringAttribute(source: Element, name: string): string | undefined {
  const raw = source.getAttribute(name)?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

/**
 * Resolve panel id from a `[data-agentable-panel]` placeholder:
 * `data-panel` wins, then non-empty `data-agentable-panel` value.
 */
export function resolvePanelIdFromPlaceholder(element: Element): string | undefined {
  const explicit = readStringAttribute(element, 'data-panel');
  if (explicit) {
    return explicit;
  }
  const marker = readStringAttribute(element, 'data-agentable-panel');
  return marker;
}

/** Map data-* attributes on a placeholder to mount config. */
export function readMountConfigFromPlaceholder(element: Element): AgentablePanelMountConfig | null {
  const panelId = resolvePanelIdFromPlaceholder(element);
  if (!panelId) {
    return null;
  }

  return {
    panelId,
    tenant: readStringAttribute(element, 'data-tenant'),
    primaryColor: readStringAttribute(element, 'data-primary-color'),
    welcomeMessage: readStringAttribute(element, 'data-welcome-message'),
    apiEndpoint: readStringAttribute(element, 'data-api-endpoint'),
    voiceEnabled: readBooleanAttribute(element, 'data-voice-enabled'),
    snapGrid: readBooleanAttribute(element, 'data-snap-grid'),
    systemPrompt: readStringAttribute(element, 'data-system-prompt'),
    voiceGreeting: readStringAttribute(element, 'data-voice-greeting'),
    greetingMode: readStringAttribute(element, 'data-voice-greeting-mode'),
    tokenEndpoint: readStringAttribute(element, 'data-token-endpoint'),
    locale: readStringAttribute(element, 'data-locale'),
    configUrl: readStringAttribute(element, 'data-config-url'),
    panelDataUrl: readStringAttribute(element, 'data-panel-data-url'),
    anonKey: readStringAttribute(element, 'data-anon-key'),
    configPath: readStringAttribute(element, 'data-config-path'),
    panelTitle: readStringAttribute(element, 'data-panel-title'),
    hideChrome: readBooleanAttribute(element, 'data-hide-chrome'),
    slotName: readStringAttribute(element, 'data-slot-name'),
    skipReactMount: readBooleanAttribute(element, 'data-skip-react-mount'),
    lazyHydrate: readLazyHydrateFlag(element),
    theme: readStringAttribute(element, 'data-theme'),
  };
}

function applyMountConfig(element: AgentablePanelElement, config: AgentablePanelMountConfig): void {
  element.panel = config.panelId;
  element.setAttribute('panel', config.panelId);

  if (config.tenant) {
    element.tenant = config.tenant;
    element.setAttribute('tenant', config.tenant);
  }
  if (config.primaryColor) element.primaryColor = config.primaryColor;
  if (config.welcomeMessage) element.welcomeMessage = config.welcomeMessage;
  if (config.apiEndpoint) element.apiEndpoint = config.apiEndpoint;
  if (config.voiceEnabled !== undefined) element.voiceEnabled = config.voiceEnabled;
  if (config.snapGrid !== undefined) element.snapGrid = config.snapGrid;
  if (config.systemPrompt) element.systemPrompt = config.systemPrompt;
  if (config.voiceGreeting) element.voiceGreeting = config.voiceGreeting;
  if (config.greetingMode) element.greetingMode = config.greetingMode;
  if (config.tokenEndpoint) element.tokenEndpoint = config.tokenEndpoint;
  if (config.locale) {
    element.locale = config.locale;
    element.setAttribute('locale', config.locale);
  }
  if (config.configUrl) element.configUrl = config.configUrl;
  if (config.panelDataUrl) element.panelDataUrl = config.panelDataUrl;
  if (config.anonKey) {
    element.anonKey = config.anonKey;
    element.setAttribute('anon-key', config.anonKey);
  }
  if (config.apiEndpoint) {
    element.apiEndpoint = config.apiEndpoint;
    element.setAttribute('api-endpoint', config.apiEndpoint);
  }
  if (config.configPath) {
    element.configPath = config.configPath;
    element.setAttribute('config-path', config.configPath);
  }
  if (config.panelTitle) element.panelTitle = config.panelTitle;
  if (config.hideChrome !== undefined) element.hideChrome = config.hideChrome;
  if (config.slotName) {
    element.slotName = config.slotName;
    element.setAttribute('slot-name', config.slotName);
  }

  if (config.primaryColor) {
    element.setAttribute('primary-color', config.primaryColor);
  }
  if (config.configUrl) {
    element.setAttribute('config-url', config.configUrl);
  }
  if (config.panelDataUrl) {
    element.setAttribute('panel-data-url', config.panelDataUrl);
  }
  if (config.anonKey) {
    element.setAttribute('anon-key', config.anonKey);
  }
  if (config.apiEndpoint) {
    element.setAttribute('api-endpoint', config.apiEndpoint);
  }
  if (config.configPath) {
    element.setAttribute('config-path', config.configPath);
  }
  if (config.slotName) {
    element.setAttribute('slot-name', config.slotName);
  }
  if (config.hideChrome) {
    element.setAttribute('hide-chrome', '');
  }
  if (config.skipReactMount) {
    element.setAttribute('data-skip-react-mount', '');
  }
  if (config.lazyHydrate) {
    element.setAttribute('lazy-hydrate', '');
  }
  if (config.theme) {
    element.setAttribute('data-theme', config.theme);
  }
}

export function createAgentablePanelElement(config: AgentablePanelMountConfig): AgentablePanelElement {
  const element = document.createElement('agentable-panel') as AgentablePanelElement;
  applyMountConfig(element, config);
  return element;
}

/**
 * Mount or update a panel inside `container`. Reuses an existing child
 * `<agentable-panel>` when present.
 */
export function mountAgentablePanelIn(
  container: HTMLElement,
  config: AgentablePanelMountConfig,
): AgentablePanelElement {
  const existing = container.querySelector<AgentablePanelElement>('agentable-panel');
  if (existing) {
    applyMountConfig(existing, config);
    return existing;
  }

  const element = createAgentablePanelElement(config);
  container.appendChild(element);
  return element;
}
