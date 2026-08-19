import type { PartialCanvasTenantConfig } from '../../../src/config/CanvasContext';
import type { EmbedConfigDocument } from '../../../src/embed/types/embedConfig';
import type { PanelDefinition } from '../../../src/panels/types';
import { supportDatasetToPanelData } from './adapters/supportDatasetToPanelData';
import { MINIMAL_SUPPORT_DATASET } from './fixtures/minimal-dataset';
import type { SupportInboxPackExtensions } from './extension-points';
import { createSupportInboxPanelDefinitions } from './panels';
import { createSupportInboxPersonaScaffold } from './persona';
import { createSupportInboxTools, type SupportInboxToolRuntime } from './tools';
import { SUPPORT_INBOX_SOURCE_NAMES } from './constants';
import type {
  SupportInboxHostConfig,
  SupportInboxNavItem,
  SupportInboxPack,
  SupportInboxPackOptions,
} from './types';

const DEFAULT_NAV_ITEMS: readonly SupportInboxNavItem[] = [
  { id: 'inbox', label: 'support.nav.inbox', icon: 'Inbox', panelId: 'inbox' },
  { id: 'ticket-detail', label: 'support.nav.ticketDetail', icon: 'MessageSquare', panelId: 'ticket-detail' },
  { id: 'macros', label: 'support.nav.macros', icon: 'MessagesSquare', panelId: 'macros' },
];

const NOOP_TOOL_RUNTIME: SupportInboxToolRuntime = {
  openPanel: (panelId) => ({ ok: true, result: `Opened ${panelId}.` }),
};

function mergePanels(
  base: readonly PanelDefinition[],
  extensions?: SupportInboxPackExtensions): readonly PanelDefinition[] {
  const byId = new Map<string, PanelDefinition>();
  for (const panel of base) {
    byId.set(panel.id, panel);
  }
  for (const panel of extensions?.panels ?? []) {
    if (!byId.has(panel.id)) {
      byId.set(panel.id, panel);
    }
  }
  for (const [id, panel] of Object.entries(extensions?.panelOverrides ?? {})) {
    byId.set(id, panel);
  }
  return Object.freeze([...byId.values()]);
}

function buildTenantDefaults(options: SupportInboxPackOptions = {}): PartialCanvasTenantConfig {
  const persona = createSupportInboxPersonaScaffold(options.persona);
  const dataset = options.dataset ?? MINIMAL_SUPPORT_DATASET;
  return {
    tenant: options.tenant ?? 'support-default',
    persona: {
      systemPrompt: persona.systemPrompt,
      assistantName: persona.assistantName,
      tenantTitle: persona.tenantTitle,
      voiceGreeting: persona.voiceGreeting,
      starterPrompts: [...persona.starterPrompts],
    },...(options.labels ? { labels: options.labels }: {}),
    panelData: supportDatasetToPanelData(dataset),
  };
}

/** Create the shared support-inbox pack ( pattern — one package, no per-client forks). */
export function createSupportInboxPack(options: SupportInboxPackOptions = {}): SupportInboxPack {
  const panels = createSupportInboxPanelDefinitions();
  const personaScaffold = createSupportInboxPersonaScaffold(options.persona);
  const tenantDefaults = buildTenantDefaults(options);
  const packShell: SupportInboxPack = {
    panels: panels,
    panelIds: panels.map((panel) => panel.id),
    navItems: DEFAULT_NAV_ITEMS,
    tools: createSupportInboxTools(NOOP_TOOL_RUNTIME),
    adapterSources: SUPPORT_INBOX_SOURCE_NAMES,
    tenantDefaults,
    personaScaffold,
  };
  return Object.freeze(packShell);
}

/** Extend the shared pack via published extension points only ( AC). */
export function extendSupportInboxPack(
  base: SupportInboxPack,
  extensions: SupportInboxPackExtensions = {}): SupportInboxPack {
  const mergedPanels = mergePanels(base.panels, extensions);
  const mergedNav = Object.freeze([...base.navItems,...(extensions.navItems ?? [])]);
  const mergedTenant = {...base.tenantDefaults,...buildTenantDefaults(extensions.tenant),
    persona: {...base.tenantDefaults.persona,...buildTenantDefaults(extensions.tenant).persona,
    },
  };
  const extended: SupportInboxPack = {
    panels: mergedPanels,
    panelIds: mergedPanels.map((panel) => panel.id),
    navItems: mergedNav,
    tools: Object.freeze([...base.tools,...(extensions.tools ?? [])]),
    adapterSources: base.adapterSources,
    tenantDefaults: mergedTenant,
    personaScaffold: createSupportInboxPersonaScaffold({...base.personaScaffold,...extensions.tenant?.persona,
    }),
  };
  return Object.freeze(extended);
}

/** Resolve a host-neutral config object for embed + React interop. */
export function resolveSupportInboxHostConfig(
  pack: SupportInboxPack,
  options: SupportInboxPackOptions = {}): SupportInboxHostConfig {
  const tenantDefaults = {...pack.tenantDefaults,...buildTenantDefaults(options),
    persona: {...pack.tenantDefaults.persona,...buildTenantDefaults(options).persona,
    },
  };
  const adapter =
    options.adapter ??
    ({
      kind: 'static',
      data: supportDatasetToPanelData(options.dataset ?? MINIMAL_SUPPORT_DATASET),
    } as const);

  return {
    tenant: tenantDefaults.tenant ?? 'support-default',
    persona: tenantDefaults.persona ?? {},
    labels: tenantDefaults.labels,
    panelData: tenantDefaults.panelData,
    adapter,
    panels: pack.panels,
    panelIds: pack.panelIds,
    navItems: pack.navItems,
    tools: pack.tools,
    adapterSources: pack.adapterSources,
  };
}

/** Plain-HTML embed document shape (config-url path). */
export function toEmbedConfigDocument(config: SupportInboxHostConfig): EmbedConfigDocument {
  return {
    tenant: config.tenant,
    persona: config.persona,
    adapter: config.adapter,
    panelData: config.panelData,
    panels: config.panels.map((panel) => ({ id: panel.id, kind: panel.kind })),
  };
}

/** React host registration slice (createCanvasHost panels + tenant). */
export function toReactHostConfig(config: SupportInboxHostConfig): {
  tenant: string;
  persona: PartialCanvasTenantConfig['persona'];
  labels?: PartialCanvasTenantConfig['labels'];
  panelData?: PartialCanvasTenantConfig['panelData'];
  panels: SupportInboxHostConfig['panels'];
  panelIds: SupportInboxHostConfig['panelIds'];
  tools: SupportInboxHostConfig['tools'];
} {
  return {
    tenant: config.tenant,
    persona: config.persona,
    labels: config.labels,
    panelData: config.panelData,
    panels: config.panels,
    panelIds: config.panelIds,
    tools: config.tools,
  };
}

export { createSupportInboxTools, type SupportInboxToolRuntime } from './tools';
export { createSupportInboxPanelDefinitions } from './panels';
export { createSupportInboxPersonaScaffold } from './persona';
export type { SupportInboxPackExtensions } from './extension-points';
