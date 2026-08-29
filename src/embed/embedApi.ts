/**
 * JS API for white-label embed hosts.
 *
 * Parity with script-tag attributes: `anonKey`, `apiEndpoint`, `configPath`,
 * and the same config merge path as `<agentable-canvas>` / `<agentable-panel>`.
 */
import type { AgentableCanvasElement } from './agentable-canvas';
import type { AgentablePanelElement } from './agentable-panel';
import {
  ANON_KEY_ATTR,
  API_ENDPOINT_ATTR,
  CONFIG_PATH_ATTR,
  readScriptTagEmbedHints,
} from './tenantLookup';
import {
  mountAgentablePanelIn,
  type AgentablePanelMountConfig,
} from './mountAgentablePanel';

export type AgentableEmbedElement = AgentableCanvasElement | AgentablePanelElement;

export interface AgentableEmbedInitOptions {
  container: string | HTMLElement;
  /** Public anon key for tenant config lookup (G3 — never a service role key). */
  anonKey?: string;
  /** API base for lookup; defaults to element built-in `/api`. */
  apiEndpoint?: string;
  /** Lookup route override (default `/agentable/embed/config`). */
  configPath?: string;
  configUrl?: string;
  panelDataUrl?: string;
  tenant?: string;
  primaryColor?: string;
  welcomeMessage?: string;
  locale?: string;
  /** Panel-only mount — requires `panel`. */
  panel?: string;
  panelTitle?: string;
  hideChrome?: boolean;
  slotName?: string;
  lazyHydrate?: boolean;
  /** Which custom element to create. Default `agentable-canvas`. */
  element?: 'agentable-canvas' | 'agentable-panel';
}

export interface AgentableEmbedInstance {
  element: AgentableEmbedElement;
  destroy(): void;
}

function resolveContainer(container: string | HTMLElement): HTMLElement {
  if (typeof container === 'string') {
    const el = document.querySelector<HTMLElement>(container);
    if (!el) {
      throw new Error(`[agentable] container not found: ${container}`);
    }
    return el;
  }
  return container;
}

/** Panel elements carry lookup/config properties the canvas element does not declare. */
function isAgentablePanelElement(
  element: AgentableEmbedElement,
): element is AgentablePanelElement {
  return element.tagName.toLowerCase() === 'agentable-panel';
}

function applySharedAttributes(
  element: AgentableEmbedElement,
  options: AgentableEmbedInitOptions): void {
  if (options.anonKey) {
    element.setAttribute(ANON_KEY_ATTR, options.anonKey);
    if (isAgentablePanelElement(element)) {
      element.anonKey = options.anonKey;
    }
  }
  if (options.apiEndpoint) {
    element.setAttribute(API_ENDPOINT_ATTR, options.apiEndpoint);
    element.apiEndpoint = options.apiEndpoint;
  }
  if (options.configPath) {
    element.setAttribute(CONFIG_PATH_ATTR, options.configPath);
    if (isAgentablePanelElement(element)) {
      element.configPath = options.configPath;
    }
  }
  if (options.configUrl) {
    element.setAttribute('config-url', options.configUrl);
    if (isAgentablePanelElement(element)) {
      element.configUrl = options.configUrl;
    }
  }
  if (options.panelDataUrl) {
    element.setAttribute('panel-data-url', options.panelDataUrl);
    if (isAgentablePanelElement(element)) {
      element.panelDataUrl = options.panelDataUrl;
    }
  }
  if (options.tenant) {
    element.setAttribute('tenant', options.tenant);
    element.tenant = options.tenant;
  }
  if (options.primaryColor) {
    element.setAttribute('primary-color', options.primaryColor);
    element.primaryColor = options.primaryColor;
  }
  if (options.welcomeMessage) {
    element.setAttribute('welcome-message', options.welcomeMessage);
    element.welcomeMessage = options.welcomeMessage;
  }
  if (options.locale) {
    element.setAttribute('locale', options.locale);
    if (isAgentablePanelElement(element)) {
      element.locale = options.locale;
    }
  }
}

function initPanel(options: AgentableEmbedInitOptions): AgentableEmbedInstance {
  const container = resolveContainer(options.container);
  if (!options.panel?.trim()) {
    throw new Error('[agentable] panel init requires `panel`');
  }

  const mountConfig: AgentablePanelMountConfig = {
    panelId: options.panel.trim(),...(options.anonKey ? { anonKey: options.anonKey }: {}),...(options.apiEndpoint ? { apiEndpoint: options.apiEndpoint }: {}),...(options.configPath ? { configPath: options.configPath }: {}),...(options.configUrl ? { configUrl: options.configUrl }: {}),...(options.panelDataUrl ? { panelDataUrl: options.panelDataUrl }: {}),...(options.tenant ? { tenant: options.tenant }: {}),...(options.primaryColor ? { primaryColor: options.primaryColor }: {}),...(options.welcomeMessage ? { welcomeMessage: options.welcomeMessage }: {}),...(options.locale ? { locale: options.locale }: {}),...(options.panelTitle ? { panelTitle: options.panelTitle }: {}),...(options.hideChrome ? { hideChrome: options.hideChrome }: {}),...(options.slotName ? { slotName: options.slotName }: {}),...(options.lazyHydrate ? { lazyHydrate: options.lazyHydrate }: {}),
  };

  const element = mountAgentablePanelIn(container, mountConfig);
  return {
    element,
    destroy() {
      element.remove();
    },
  };
}

function initCanvas(options: AgentableEmbedInitOptions): AgentableEmbedInstance {
  const container = resolveContainer(options.container);
  const element = document.createElement('agentable-canvas') as AgentableCanvasElement;
  applySharedAttributes(element, options);
  container.replaceChildren(element);
  return {
    element,
    destroy() {
      element.remove();
    },
  };
}

/**
 * Drop-in factory for JS API embed hosts. Mirrors script-tag `data-anon-key`.
 */
export function initAgentableEmbed(options: AgentableEmbedInitOptions): AgentableEmbedInstance {
  const kind = options.element ?? (options.panel ? 'agentable-panel': 'agentable-canvas');
  if (kind === 'agentable-panel') {
    return initPanel(options);
  }
  return initCanvas(options);
}

export const AgentableEmbedApi = { init: initAgentableEmbed };

export default AgentableEmbedApi;

/** Auto-mount from executing script tag when `data-container` is present. */
export function bootstrapScriptTagEmbed(): void {
  if (typeof document === 'undefined') return;
  const hints = readScriptTagEmbedHints();
  if (!hints?.container) return;

  try {
    initAgentableEmbed({
      container: hints.container,...(hints.anonKey ? { anonKey: hints.anonKey }: {}),...(hints.apiEndpoint ? { apiEndpoint: hints.apiEndpoint }: {}),...(hints.configPath ? { configPath: hints.configPath }: {}),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message: String(error);
    console.warn('[agentable] script-tag auto-mount failed:', message);
  }
}

declare global {
  interface Window {
    AgentableEmbed?: typeof AgentableEmbedApi;
  }
}

if (typeof window !== 'undefined') {
  window.AgentableEmbed = AgentableEmbedApi;
}
