import type { PartialCanvasTenantConfig } from '../../../src/config/CanvasContext';
import type { EmbedAdapterConfig } from '../../../src/embed/types/embedConfig';
import type { PanelDefinition } from '../../../src/panels/types';
import type { ToolDefinition } from '../../../src/panels/tools';
import type { SupportInboxPanelId, SupportInboxSourceName } from './constants';
import type { SupportDataset } from './schema/supportEntityTypes';

export type {
  SupportDataset,
  SupportMacro,
  SupportMessage,
  SupportTicket,
  SupportTicketPriority,
  SupportTicketStatus,
} from './schema/supportEntityTypes';

/** Lucide icon name + nav wiring for support chrome. */
export interface SupportInboxNavItem {
  id: string;
  label: string;
  icon: string;
  panelId: SupportInboxPanelId | string;
}

/** Serializable host config shared by plain-HTML embed and React hosts. */
export interface SupportInboxHostConfig {
  tenant: string;
  persona: PartialCanvasTenantConfig['persona'];
  labels?: PartialCanvasTenantConfig['labels'];
  panelData?: PartialCanvasTenantConfig['panelData'];
  adapter?: EmbedAdapterConfig;
  panels: readonly PanelDefinition[];
  panelIds: readonly string[];
  navItems: readonly SupportInboxNavItem[];
  tools: readonly ToolDefinition[];
  adapterSources: readonly SupportInboxSourceName[];
}

/** Resolved support-inbox pack — immutable base; use `extendSupportInboxPack` to customize. */
export interface SupportInboxPack {
  readonly panels: readonly PanelDefinition[];
  readonly panelIds: readonly string[];
  readonly navItems: readonly SupportInboxNavItem[];
  readonly tools: readonly ToolDefinition[];
  readonly adapterSources: readonly SupportInboxSourceName[];
  readonly tenantDefaults: PartialCanvasTenantConfig;
  readonly personaScaffold: SupportInboxPersonaScaffold;
}

/** Persona scaffold tenants customize via config ( mechanism 1). */
export interface SupportInboxPersonaScaffold {
  assistantName: string;
  tenantTitle: string;
  voiceGreeting: string;
  starterPrompts: readonly {
    emoji: string;
    text: string;
    label?: string;
  }[];
  systemPrompt: string;
}

export interface SupportInboxPackOptions {
  tenant?: string;
  persona?: Partial<SupportInboxPersonaScaffold>;
  labels?: PartialCanvasTenantConfig['labels'];
  dataset?: SupportDataset;
  adapter?: EmbedAdapterConfig;
}
