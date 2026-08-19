import type { PartialCanvasTenantConfig } from '../../../src/canvas/CanvasContext';
import type { EmbedConfigDocument } from '../../../src/embed/types/embedConfig';
import type { PanelDefinition } from '../../../src/panels/types';
import { CAREER_SOURCE_NAMES } from './constants';
import { careerDatasetToPanelData } from './adapters/careerDatasetToPanelData';
import { MINIMAL_CAREER_DATASET } from './fixtures/minimal-dataset';
import type { CareerPackExtensions } from './extension-points';
import { createCareerPanelDefinitions } from './panels';
import { createCareerPersonaScaffold } from './persona';
import { applyCareerEmbedDefaults } from './whiteboard/careerCanvasDefaults';
import { createCareerTools, type CareerToolRuntime } from './tools';
import type {
  CareerHostConfig,
  CareerNavItem,
  CareerPack,
  CareerPackOptions,
} from './types';

const DEFAULT_NAV_ITEMS: readonly CareerNavItem[] = [
  { id: 'positions', label: 'career.nav.openPositions', icon: 'Briefcase', panelId: 'open-positions' },
  { id: 'new-chat', label: 'career.nav.newChat', icon: 'MessageSquare', panelId: 'chat' },
  { id: 'applications', label: 'career.nav.applications', icon: 'FileText', panelId: 'applications' },
  { id: 'resume', label: 'career.nav.resumeDocs', icon: 'FileStack', panelId: 'resume-docs' },
  { id: 'resources', label: 'career.nav.resources', icon: 'GraduationCap', panelId: 'resources' },
  { id: 'trajectories', label: 'career.nav.growthPaths', icon: 'TrendingUp', panelId: 'growth-paths' },
  { id: 'tools', label: 'career.nav.careerTools', icon: 'Wrench', panelId: 'career-tools' },
];

const NOOP_TOOL_RUNTIME: CareerToolRuntime = {
  openPanel: (panelId) => ({ ok: true, result: `Opened ${panelId}.` }),
};

function mergePanels(
  base: readonly PanelDefinition[],
  extensions?: CareerPackExtensions): readonly PanelDefinition[] {
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

function buildTenantDefaults(options: CareerPackOptions = {}): PartialCanvasTenantConfig {
  const persona = createCareerPersonaScaffold(options.persona);
  const dataset = options.dataset ?? MINIMAL_CAREER_DATASET;
  return {
    tenant: options.tenant ?? 'career-default',
    persona: {
      systemPrompt: persona.systemPrompt,
      assistantName: persona.assistantName,
      tenantTitle: persona.tenantTitle,
      voiceGreeting: persona.voiceGreeting,
      starterPrompts: [...persona.starterPrompts],
    },...(options.labels ? { labels: options.labels }: {}),
    panelData: careerDatasetToPanelData(dataset),
  };
}

/**
 * Create the shared career pack ( — one package, no per-client forks).
 */
export function createCareerPack(options: CareerPackOptions = {}): CareerPack {
  const panels = createCareerPanelDefinitions();
  const personaScaffold = createCareerPersonaScaffold(options.persona);
  const tenantDefaults = buildTenantDefaults(options);
  const packShell: CareerPack = {
    panels: panels,
    panelIds: panels.map((panel) => panel.id),
    navItems: DEFAULT_NAV_ITEMS,
    tools: createCareerTools(NOOP_TOOL_RUNTIME),
    adapterSources: CAREER_SOURCE_NAMES,
    tenantDefaults,
    personaScaffold,
  };
  return Object.freeze(packShell);
}

/**
 * Extend the shared pack via published extension points only ( AC).
 * Does not mutate the base pack instance.
 */
export function extendCareerPack(
  base: CareerPack,
  extensions: CareerPackExtensions = {}): CareerPack {
  const mergedPanels = mergePanels(base.panels, extensions);
  const mergedNav = Object.freeze([...base.navItems,...(extensions.navItems ?? []),
  ]);
  const mergedTenant = {...base.tenantDefaults,...buildTenantDefaults(extensions.tenant),
    persona: {...base.tenantDefaults.persona,...buildTenantDefaults(extensions.tenant).persona,
    },
  };
  const extended: CareerPack = {
    panels: mergedPanels,
    panelIds: mergedPanels.map((panel) => panel.id),
    navItems: mergedNav,
    tools: Object.freeze([...base.tools,...(extensions.tools ?? []),
    ]),
    adapterSources: base.adapterSources,
    tenantDefaults: mergedTenant,
    personaScaffold: createCareerPersonaScaffold({...base.personaScaffold,...extensions.tenant?.persona,
    }),
  };
  return Object.freeze(extended);
}

/** Resolve a host-neutral config object for embed + React interop. */
export function resolveCareerHostConfig(
  pack: CareerPack,
  options: CareerPackOptions = {}): CareerHostConfig {
  const tenantDefaults = {...pack.tenantDefaults,...buildTenantDefaults(options),
    persona: {...pack.tenantDefaults.persona,...buildTenantDefaults(options).persona,
    },
  };
  const adapter =
    options.adapter ??
    ({
      kind: 'static',
      data: {
        jobs: tenantDefaults.panelData?.jobs,
        applications: tenantDefaults.panelData?.applications,
        growthPaths: tenantDefaults.panelData?.growthPaths,
        resources: tenantDefaults.panelData?.resources,
      },
    } as const);

  return {
    tenant: tenantDefaults.tenant ?? 'career-default',
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
export function toEmbedConfigDocument(config: CareerHostConfig): EmbedConfigDocument {
  return applyCareerEmbedDefaults({
    tenant: config.tenant,
    persona: config.persona,
    adapter: config.adapter,
    panelData: config.panelData,
    panels: config.panels.map((panel) => ({ id: panel.id, kind: panel.kind })),
  });
}

/** React host registration slice (createCanvasHost panels + tenant). */
export function toReactHostConfig(config: CareerHostConfig): {
  tenant: string;
  persona: PartialCanvasTenantConfig['persona'];
  labels?: PartialCanvasTenantConfig['labels'];
  panelData?: PartialCanvasTenantConfig['panelData'];
  panels: CareerHostConfig['panels'];
  panelIds: CareerHostConfig['panelIds'];
  tools: CareerHostConfig['tools'];
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

export { createCareerTools, type CareerToolRuntime } from './tools';
export { createCareerPanelDefinitions } from './panels';
export { createCareerPersonaScaffold } from './persona';
export type { CareerPackExtensions } from './extension-points';
