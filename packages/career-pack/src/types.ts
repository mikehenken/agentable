import type { PartialCanvasTenantConfig } from '../../../src/config/CanvasContext';
import type { EmbedAdapterConfig } from '../../../src/embed/types/embedConfig';
import type { PanelDefinition } from '../../../src/panels/types';
import type { ToolDefinition } from '../../../src/panels/tools';
import type { CareerPanelId, CareerSourceName } from './constants';
// Re-exports below don't bring names into local scope; CareerPackOptions needs it.
import type { CareerDataset } from './schema/careerEntityTypes';

export type {
  CareerApplication,
  CareerDataset,
  CareerGrowthPath,
  CareerJob,
  CareerResource,
} from './schema/careerEntityTypes';
/** Lucide icon name + nav wiring for career chrome. */
export interface CareerNavItem {
  id: string;
  label: string;
  icon: string;
  panelId: CareerPanelId | string;
}

/** Serializable host config shared by plain-HTML embed and React hosts. */
export interface CareerHostConfig {
  tenant: string;
  persona: PartialCanvasTenantConfig['persona'];
  labels?: PartialCanvasTenantConfig['labels'];
  panelData?: PartialCanvasTenantConfig['panelData'];
  adapter?: EmbedAdapterConfig;
  panels: readonly PanelDefinition[];
  panelIds: readonly string[];
  navItems: readonly CareerNavItem[];
  tools: readonly ToolDefinition[];
  adapterSources: readonly CareerSourceName[];
}

/** Resolved career pack — immutable base; use `extendCareerPack` to customize. */
export interface CareerPack {
  readonly panels: readonly PanelDefinition[];
  readonly panelIds: readonly string[];
  readonly navItems: readonly CareerNavItem[];
  readonly tools: readonly ToolDefinition[];
  readonly adapterSources: readonly CareerSourceName[];
  readonly tenantDefaults: PartialCanvasTenantConfig;
  readonly personaScaffold: CareerPersonaScaffold;
}

/** Persona scaffold tenants customize via config (mechanism 1). */
export interface CareerPersonaScaffold {
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

export interface CareerPackOptions {
  tenant?: string;
  persona?: Partial<CareerPersonaScaffold>;
  labels?: PartialCanvasTenantConfig['labels'];
  dataset?: CareerDataset;
  adapter?: EmbedAdapterConfig;
}
