---

lrn: lrn::en:platform:agentable-canvas.feature.panel-framework-wrappers::doc

related_docs:

  - docs/features/agentable-panel-single-element.md

  - docs/features/auto-mount-scan.md

  - landi-canvas-studio/docs/development/agentable-panels/02-PANEL_SYSTEM_SPEC.md

changelog:

  - date: 2026-07-21

    summary: React, Vue, and Svelte wrappers with shared typed event forwarding.

---



# Panel framework wrappers 



Thin framework wrappers around `<agentable-panel>` for React, Vue 3, and Svelte hosts. All three delegate attribute sync and the `AgentablePanelEventMap` to `src/embed/wrappers/agentablePanelWrapperCore.ts`.



## Published entry points



| Import | Surface |

|--------|---------|

| `agentable-canvas/react` | `AgentablePanel` (also `./react/panel`) |

| `agentable-canvas/vue` | `AgentablePanel` SFC (`./vue/panel`) |

| `agentable-canvas/svelte` | `AgentablePanel` SFC (`./svelte/panel`) |

| `agentable-canvas/embed/wrappers/panel` | Shared props + `bindAgentablePanelEvents` |



Peer dependencies: `vue` ^3.4 for Vue hosts; `svelte` ^4 or ^5 for Svelte hosts. React 19+ hosts may use the wrapper or native JSX with `src/embed/react.d.ts` augmentation.



## React



```tsx

import { AgentablePanel } from 'agentable-canvas/react';



<AgentablePanel

  panel="open-positions"

  configUrl="/config/sandals-career.json"

  primaryColor="#0077B6"

  onPanelReady={(e) => console.log(e.detail)}

  onPhaseChanged={(e) => console.log(e.detail.phase)}

/>;

```



`ref` exposes `{ element, reload }`.



## Vue 3



```vue

<script setup lang="ts">

import { AgentablePanel } from 'agentable-canvas/vue';

</script>



<template>

  <AgentablePanel

    panel="open-positions"

    config-url="/config/sandals-career.json"

    primary-color="#0077B6"

    @panel-ready="(e) => console.log(e.detail)"

  />

</template>

```



`defineExpose` mirrors React: `{ element, reload }`.



## Svelte



```svelte

<script lang="ts">

  import { AgentablePanel } from 'agentable-canvas/svelte';

</script>



<AgentablePanel

  panel="open-positions"

  configUrl="/config/sandals-career.json"

  primaryColor="#0077B6"

  onPanelReady={(e) => console.log(e.detail)}

/>

```



## Typed events (all wrappers)



| Callback prop (React Svelte) | Vue emit | Custom event |

|-------------------------------|----------|--------------|

| `onConfigReloaded` | `configReloaded` | `agentable:config-reloaded` |

| `onPanelReady` | `panelReady` | `agentable:panel-ready` |

| `onAdapterLoaded` | `adapterLoaded` | `agentable:adapter-loaded` |

| `onPanelError` | `panelError` | `agentable:panel-error` |

| `onChromeChanged` | `chromeChanged` | `agentable:chrome-changed` |

| `onApprovalPending` | `approvalPending` | `agentable:approval-pending` |

| `onPhaseChanged` | `phaseChanged` | `agentable:phase-changed` |



Custom events use colons; wrappers attach listeners with `addEventListener` (React 19 JSX `onagentable:*` also supported via `react.d.ts`).



## Props



Same camelCase contract across wrappers: `panel` (required), `configUrl`, `panelDataUrl`, `anonKey`, `configPath`, `primaryColor`, `locale`, `slotName`, `hideChrome`, `lazyHydrate`, and the shared branding/voice attributes from `<agentable-panel>`.



## Module map



| Path | Role |

|------|------|

| `src/embed/wrappers/agentablePanelWrapperCore.ts` | Shared props + event bind/unbind |

| `src/react/AgentablePanel.tsx` | React 19 wrapper + ref handle |

| `src/vue/AgentablePanel.vue` | Vue 3 SFC |

| `src/svelte/AgentablePanel.svelte` | Svelte SFC |

| `src/embed/react.d.ts` | JSX types for raw `<agentable-panel>` |



## Tests



- Vitest: `tests/unit/agentablePanelWrapperCore.test.ts`, `tests/unit/AgentablePanelReact.test.tsx`

