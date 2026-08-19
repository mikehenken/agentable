<script setup lang="ts">
/**
 * Vue 3 wrapper for `<agentable-panel>` ().
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import '../embed/agentable-panel';
import type { AgentablePanelElement } from '../embed/agentable-panel';
import {
  applyAgentablePanelProps,
  bindAgentablePanelEvents,
  type AgentablePanelEventHandlers,
  type AgentablePanelWrapperProps,
} from '../embed/wrappers/agentablePanelWrapperCore';

const props = withDefaults(
  defineProps<
    AgentablePanelWrapperProps & {
      class?: string;
      style?: string | Record<string, string>;
    }
  >(),
  {
    panel: '',
  });

const emit = defineEmits<{
  configReloaded: [event: CustomEvent];
  panelReady: [event: CustomEvent];
  adapterLoaded: [event: CustomEvent];
  panelError: [event: CustomEvent];
  chromeChanged: [event: CustomEvent];
  approvalPending: [event: CustomEvent];
  phaseChanged: [event: CustomEvent];
}>();

const panelRef = ref<AgentablePanelElement | null>(null);
let unbindEvents: (() => void) | null = null;

function wrapperPropsFromVue(): AgentablePanelWrapperProps {
  return {
    panel: props.panel,
    tenant: props.tenant,
    primaryColor: props.primaryColor,
    welcomeMessage: props.welcomeMessage,
    apiEndpoint: props.apiEndpoint,
    anonKey: props.anonKey,
    configPath: props.configPath,
    voiceEnabled: props.voiceEnabled,
    snapGrid: props.snapGrid,
    systemPrompt: props.systemPrompt,
    voiceGreeting: props.voiceGreeting,
    greetingMode: props.greetingMode,
    tokenEndpoint: props.tokenEndpoint,
    locale: props.locale,
    configUrl: props.configUrl,
    panelDataUrl: props.panelDataUrl,
    panelTitle: props.panelTitle,
    hideChrome: props.hideChrome,
    slotName: props.slotName,
    lazyHydrate: props.lazyHydrate,
  };
}

function eventHandlersFromEmit(): AgentablePanelEventHandlers {
  return {
    onConfigReloaded: (event) => emit('configReloaded', event),
    onPanelReady: (event) => emit('panelReady', event),
    onAdapterLoaded: (event) => emit('adapterLoaded', event),
    onPanelError: (event) => emit('panelError', event),
    onChromeChanged: (event) => emit('chromeChanged', event),
    onApprovalPending: (event) => emit('approvalPending', event),
    onPhaseChanged: (event) => emit('phaseChanged', event),
  };
}

function syncElement(): void {
  if (!panelRef.value) {
    return;
  }
  applyAgentablePanelProps(panelRef.value, wrapperPropsFromVue());
}

onMounted(() => {
  if (!panelRef.value) {
    return;
  }
  syncElement();
  unbindEvents = bindAgentablePanelEvents(panelRef.value, eventHandlersFromEmit);
});

watch(
  () => wrapperPropsFromVue(),
  () => syncElement(),
  { deep: true });

onBeforeUnmount(() => {
  unbindEvents?.();
  unbindEvents = null;
});

async function reload(): Promise<void> {
  if (panelRef.value) {
    await panelRef.value.reload();
  }
}

defineExpose({
  get element() {
    return panelRef.value;
  },
  reload,
});
</script>

<template>
  <agentable-panel
    ref="panelRef":class="props.class":style="props.style":panel="props.panel":tenant="props.tenant":primary-color="props.primaryColor":welcome-message="props.welcomeMessage":api-endpoint="props.apiEndpoint":anon-key="props.anonKey":config-path="props.configPath":voice-enabled="props.voiceEnabled":snap-grid="props.snapGrid":system-prompt="props.systemPrompt":voice-greeting="props.voiceGreeting":voice-greeting-mode="props.greetingMode":token-endpoint="props.tokenEndpoint":locale="props.locale":config-url="props.configUrl":panel-data-url="props.panelDataUrl":panel-title="props.panelTitle":hide-chrome="props.hideChrome":slot-name="props.slotName":lazy-hydrate="props.lazyHydrate"
  >
    <slot />
  </agentable-panel>
</template>
