<script lang="ts">
  /**
   * Svelte wrapper for `<agentable-panel>` ().
   */
  import { onDestroy, onMount } from 'svelte';
  import '../embed/agentable-panel';
  import type { AgentablePanelElement } from '../embed/agentable-panel';
  import {
    applyAgentablePanelProps,
    bindAgentablePanelEvents,
    type AgentablePanelEventHandlers,
    type AgentablePanelWrapperProps,
  } from '../embed/wrappers/agentablePanelWrapperCore';

  export let panel: string;
  export let tenant: string | undefined = undefined;
  export let primaryColor: string | undefined = undefined;
  export let welcomeMessage: string | undefined = undefined;
  export let apiEndpoint: string | undefined = undefined;
  export let anonKey: string | undefined = undefined;
  export let configPath: string | undefined = undefined;
  export let voiceEnabled: boolean | undefined = undefined;
  export let snapGrid: boolean | undefined = undefined;
  export let systemPrompt: string | undefined = undefined;
  export let voiceGreeting: string | undefined = undefined;
  export let greetingMode: string | undefined = undefined;
  export let tokenEndpoint: string | undefined = undefined;
  export let locale: string | undefined = undefined;
  export let configUrl: string | undefined = undefined;
  export let panelDataUrl: string | undefined = undefined;
  export let panelTitle: string | undefined = undefined;
  export let hideChrome: boolean | undefined = undefined;
  export let slotName: string | undefined = undefined;
  export let lazyHydrate: boolean | undefined = undefined;
  export let className: string | undefined = undefined;
  export let style: string | undefined = undefined;

  export let onConfigReloaded: AgentablePanelEventHandlers['onConfigReloaded'] = undefined;
  export let onPanelReady: AgentablePanelEventHandlers['onPanelReady'] = undefined;
  export let onAdapterLoaded: AgentablePanelEventHandlers['onAdapterLoaded'] = undefined;
  export let onPanelError: AgentablePanelEventHandlers['onPanelError'] = undefined;
  export let onChromeChanged: AgentablePanelEventHandlers['onChromeChanged'] = undefined;
  export let onApprovalPending: AgentablePanelEventHandlers['onApprovalPending'] = undefined;
  export let onPhaseChanged: AgentablePanelEventHandlers['onPhaseChanged'] = undefined;

  let panelEl: AgentablePanelElement | undefined;
  let unbindEvents: (() => void) | null = null;

  function wrapperProps(): AgentablePanelWrapperProps {
    return {
      panel,
      tenant,
      primaryColor,
      welcomeMessage,
      apiEndpoint,
      anonKey,
      configPath,
      voiceEnabled,
      snapGrid,
      systemPrompt,
      voiceGreeting,
      greetingMode,
      tokenEndpoint,
      locale,
      configUrl,
      panelDataUrl,
      panelTitle,
      hideChrome,
      slotName,
      lazyHydrate,
    };
  }

  function eventHandlers(): AgentablePanelEventHandlers {
    return {
      onConfigReloaded,
      onPanelReady,
      onAdapterLoaded,
      onPanelError,
      onChromeChanged,
      onApprovalPending,
      onPhaseChanged,
    };
  }

  function syncElement(): void {
    if (!panelEl) {
      return;
    }
    applyAgentablePanelProps(panelEl, wrapperProps());
  }

  onMount(() => {
    if (!panelEl) {
      return;
    }
    syncElement();
    unbindEvents = bindAgentablePanelEvents(panelEl, eventHandlers);
  });

  onDestroy(() => {
    unbindEvents?.();
    unbindEvents = null;
  });

  $: if (panelEl) {
    syncElement();
  }

  export function reload(): Promise<void> {
    if (!panelEl) {
      return Promise.resolve();
    }
    return panelEl.reload();
  }

  export function getElement(): AgentablePanelElement | undefined {
    return panelEl;
  }
</script>

<agentable-panel
  bind:this={panelEl}
  class={className}
  {style}
  {panel}
  {tenant}
  primary-color={primaryColor}
  welcome-message={welcomeMessage}
  api-endpoint={apiEndpoint}
  anon-key={anonKey}
  config-path={configPath}
  voice-enabled={voiceEnabled}
  snap-grid={snapGrid}
  system-prompt={systemPrompt}
  voice-greeting={voiceGreeting}
  voice-greeting-mode={greetingMode}
  token-endpoint={tokenEndpoint}
  {locale}
  config-url={configUrl}
  panel-data-url={panelDataUrl}
  panel-title={panelTitle}
  hide-chrome={hideChrome}
  slot-name={slotName}
  lazy-hydrate={lazyHydrate}
>
  <slot />
</agentable-panel>
