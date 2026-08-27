/**
 * Shared props + typed event wiring for `<agentable-panel>` framework wrappers.
 *
 * React, Vue, and Svelte wrappers delegate attribute sync and CustomEvent
 * listener lifecycle to this module so the `AgentablePanelEventMap`
 * stays single-sourced.
 */
import type {
  AgentablePanelElement,
  AgentablePanelEventMap,
} from '../agentable-panel';

export type {
  AgentablePanelElement,
  AgentablePanelEventMap,
  AgentablePanelConfigReloadDetail,
  AgentablePanelReadyDetail,
  AgentablePanelAdapterDetail,
  AgentablePanelErrorDetail,
  AgentablePanelChromeDetail,
  AgentablePanelApprovalDetail,
  AgentablePanelPhaseDetail,
} from '../agentable-panel';

/** CamelCase props mirrored across React Vue Svelte wrappers. */
export interface AgentablePanelWrapperProps {
  panel: string;
  tenant?: string;
  primaryColor?: string;
  welcomeMessage?: string;
  apiEndpoint?: string;
  anonKey?: string;
  configPath?: string;
  voiceEnabled?: boolean;
  snapGrid?: boolean;
  systemPrompt?: string;
  voiceGreeting?: string;
  greetingMode?: string;
  tokenEndpoint?: string;
  locale?: string;
  configUrl?: string;
  panelDataUrl?: string;
  panelTitle?: string;
  hideChrome?: boolean;
  slotName?: string;
  lazyHydrate?: boolean;
}

/** Typed callback props — same names in every framework wrapper. */
export interface AgentablePanelEventHandlers {
  onConfigReloaded?: (event: AgentablePanelEventMap['agentable:config-reloaded']) => void;
  onPanelReady?: (event: AgentablePanelEventMap['agentable:panel-ready']) => void;
  onAdapterLoaded?: (event: AgentablePanelEventMap['agentable:adapter-loaded']) => void;
  onPanelError?: (event: AgentablePanelEventMap['agentable:panel-error']) => void;
  onChromeChanged?: (event: AgentablePanelEventMap['agentable:chrome-changed']) => void;
  onApprovalPending?: (event: AgentablePanelEventMap['agentable:approval-pending']) => void;
  onPhaseChanged?: (event: AgentablePanelEventMap['agentable:phase-changed']) => void;
}

const PANEL_EVENT_BINDINGS: ReadonlyArray<{
  event: keyof AgentablePanelEventMap;
  handler: keyof AgentablePanelEventHandlers;
}> = [
  { event: 'agentable:config-reloaded', handler: 'onConfigReloaded' },
  { event: 'agentable:panel-ready', handler: 'onPanelReady' },
  { event: 'agentable:adapter-loaded', handler: 'onAdapterLoaded' },
  { event: 'agentable:panel-error', handler: 'onPanelError' },
  { event: 'agentable:chrome-changed', handler: 'onChromeChanged' },
  { event: 'agentable:approval-pending', handler: 'onApprovalPending' },
  { event: 'agentable:phase-changed', handler: 'onPhaseChanged' },
];

function setStringAttribute(element: AgentablePanelElement, name: string, value: string | undefined): void {
  if (value === undefined || value.length === 0) {
    element.removeAttribute(name);
    return;
  }
  element.setAttribute(name, value);
}

function setBooleanAttribute(element: AgentablePanelElement, name: string, value: boolean | undefined): void {
  if (value === undefined) {
    element.removeAttribute(name);
    return;
  }
  if (value) {
    element.setAttribute(name, '');
  } else {
    element.removeAttribute(name);
  }
}

/** Sync wrapper props onto a live `<agentable-panel>` custom element. */
export function applyAgentablePanelProps(
  element: AgentablePanelElement,
  props: AgentablePanelWrapperProps): void {
  element.panel = props.panel;
  element.setAttribute('panel', props.panel);

  if (props.tenant !== undefined) {
    element.tenant = props.tenant;
    setStringAttribute(element, 'tenant', props.tenant);
  }
  if (props.primaryColor !== undefined) {
    element.primaryColor = props.primaryColor;
    setStringAttribute(element, 'primary-color', props.primaryColor);
  }
  if (props.welcomeMessage !== undefined) {
    element.welcomeMessage = props.welcomeMessage;
    setStringAttribute(element, 'welcome-message', props.welcomeMessage);
  }
  if (props.apiEndpoint !== undefined) {
    element.apiEndpoint = props.apiEndpoint;
    setStringAttribute(element, 'api-endpoint', props.apiEndpoint);
  }
  if (props.anonKey !== undefined) {
    element.anonKey = props.anonKey;
    setStringAttribute(element, 'anon-key', props.anonKey);
  }
  if (props.configPath !== undefined) {
    element.configPath = props.configPath;
    setStringAttribute(element, 'config-path', props.configPath);
  }
  if (props.voiceEnabled !== undefined) {
    element.voiceEnabled = props.voiceEnabled;
    setBooleanAttribute(element, 'voice-enabled', props.voiceEnabled);
  }
  if (props.snapGrid !== undefined) {
    element.snapGrid = props.snapGrid;
    setBooleanAttribute(element, 'snap-grid', props.snapGrid);
  }
  if (props.systemPrompt !== undefined) {
    element.systemPrompt = props.systemPrompt;
    setStringAttribute(element, 'system-prompt', props.systemPrompt);
  }
  if (props.voiceGreeting !== undefined) {
    element.voiceGreeting = props.voiceGreeting;
    setStringAttribute(element, 'voice-greeting', props.voiceGreeting);
  }
  if (props.greetingMode !== undefined) {
    element.greetingMode = props.greetingMode;
    setStringAttribute(element, 'voice-greeting-mode', props.greetingMode);
  }
  if (props.tokenEndpoint !== undefined) {
    element.tokenEndpoint = props.tokenEndpoint;
    setStringAttribute(element, 'token-endpoint', props.tokenEndpoint);
  }
  if (props.locale !== undefined) {
    element.locale = props.locale;
    setStringAttribute(element, 'locale', props.locale);
  }
  if (props.configUrl !== undefined) {
    element.configUrl = props.configUrl;
    setStringAttribute(element, 'config-url', props.configUrl);
  }
  if (props.panelDataUrl !== undefined) {
    element.panelDataUrl = props.panelDataUrl;
    setStringAttribute(element, 'panel-data-url', props.panelDataUrl);
  }
  if (props.panelTitle !== undefined) {
    element.panelTitle = props.panelTitle;
    setStringAttribute(element, 'panel-title', props.panelTitle);
  }
  if (props.hideChrome !== undefined) {
    element.hideChrome = props.hideChrome;
    setBooleanAttribute(element, 'hide-chrome', props.hideChrome);
  }
  if (props.slotName !== undefined) {
    element.slotName = props.slotName;
    setStringAttribute(element, 'slot-name', props.slotName);
  }
  if (props.lazyHydrate !== undefined) {
    element.lazyHydrate = props.lazyHydrate;
    setBooleanAttribute(element, 'lazy-hydrate', props.lazyHydrate);
  }
}

export interface AgentablePanelEventBinding {
  event: keyof AgentablePanelEventMap;
  listener: EventListener;
}

/** Build listener records that read handlers lazily (avoids stale closures). */
export function createAgentablePanelEventBindings(
  readHandlers: () => AgentablePanelEventHandlers): AgentablePanelEventBinding[] {
  return PANEL_EVENT_BINDINGS.map(({ event, handler }) => ({
    event,
    listener: ((nativeEvent: Event) => {
      const callback = readHandlers()[handler];
      if (callback) {
        (callback as (event: Event) => void)(nativeEvent);
      }
    }) as EventListener,
  }));
}

/** Attach typed panel events; returns an unsubscribe function. */
export function bindAgentablePanelEvents(
  element: AgentablePanelElement,
  readHandlers: () => AgentablePanelEventHandlers): () => void {
  const bindings = createAgentablePanelEventBindings(readHandlers);
  for (const { event, listener } of bindings) {
    element.addEventListener(event, listener);
  }
  return () => {
    for (const { event, listener } of bindings) {
      element.removeEventListener(event, listener);
    }
  };
}

/** Imperative reload passthrough for wrapper refs. */
export function reloadAgentablePanel(element: AgentablePanelElement): Promise<void> {
  return element.reload();
}

export const AGENTABLE_PANEL_WRAPPER_EVENT_NAMES = PANEL_EVENT_BINDINGS.map(({ event }) => event);
