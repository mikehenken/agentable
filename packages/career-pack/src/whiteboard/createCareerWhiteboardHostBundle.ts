/**
 * Career whiteboard host bundle — createCanvasHost + engine for embed/React paths.
 */
import type { PartialCanvasTenantConfig } from '../../../../src/config/CanvasContext';
import type { RawPanelDataPayload } from '../../../../src/config/panelDataNormalize';
import type { NavItemConfig } from '../../../../src/components/chrome/navItems';
import { createWhiteboardEngine, type WhiteboardEngineHandle } from '../../../../src/engines/tldraw/engine';
import { openPanelInCanvas, closeNavPanelsExcept } from '../../../../src/engines/tldraw/shapes/panelShapeApi';
import {
  DEFAULT_WHITEBOARD_PANEL_REGISTRY,
  resolveWhiteboardPanelLoaders,
  type WhiteboardPanelRegistry,
} from '../../../../src/engines/tldraw/shapes/whiteboardPanelRegistry';
import { createCanvasHost, type CanvasHost } from '../../../../src/panels/host';
import { registerHostActions } from '../../../../src/panels/tools';
import type { PanelDefinition } from '../../../../src/panels/types';
import type { DataAdapter } from '../../../../src/panels/renderer';
import { usePanelIntentStore } from '../../../../src/stores/panelIntentStore';
import type { EmbedConfigDocument, EmbedPanelSpecRef } from '../../../../src/embed/types/embedConfig';
import { createStaticCareerAdapter, type StaticCareerDatasetInput } from '../adapters/staticCareerAdapter';
import { validateCareerDataset } from '../schema/careerDatasetSchema';
import { CAREER_PANEL_IDS, CAREER_SOURCE_NAMES } from '../constants';
import type { CareerDataset } from '../types';
import { isCareerDatasetPanelPayload } from '../adapters/careerDatasetToPanelData';
import { HELIOS_CAREER_DATASET } from '../fixtures/helios-dataset';
import { ARCHIPELAGO_CAREER_DATASET } from '../fixtures/archipelago-dataset';
import { createCareerPanelDefinitions } from '../panels';
import { createCareerPack, createCareerTools, type CareerToolRuntime } from '../pack';
import { careerNavItemsToNavConfig } from './careerNavItems';
import { applyCareerWhiteboardLayoutHints } from './careerWhiteboardLayoutHints';
import { bindCareerToolbarCustomActions } from './bindCareerToolbarCustomActions';
import { resetWhiteboardLayoutHints } from '../../../../src/engines/tldraw/layout/whiteboardLayoutConfig';

export interface CareerWhiteboardHostBundle {
  host: CanvasHost;
  engine: WhiteboardEngineHandle;
  navItems: NavItemConfig[];
  panelLoaders: WhiteboardPanelRegistry;
  adapterSources: readonly string[];
  disposeToolbarActions: () => void;
  /** Unregister career domain tools (separate from panel-tool host dispose). */
  unregisterCareerTools: () => void;
}

export interface CreateCareerWhiteboardHostBundleInput {
  configDocument: EmbedConfigDocument | null;
  tenantConfig: PartialCanvasTenantConfig;
  panelDataRaw: RawPanelDataPayload | null;
  tenant: string;
  fetchFn?: typeof fetch;
}

function readPanelSpecRefs(
  configDocument: EmbedConfigDocument | null): readonly EmbedPanelSpecRef[] {
  if (!configDocument?.panels?.length) {
    return [];
  }
  const refs: EmbedPanelSpecRef[] = [];
  for (const entry of configDocument.panels) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const record = entry as { id?: unknown; kind?: unknown };
    if (typeof record.id !== 'string' || record.id.trim().length === 0) {
      continue;
    }
    refs.push({
      id: record.id.trim(),...(typeof record.kind === 'string' ? { kind: record.kind }: {}),
    });
  }
  return refs;
}

function mergeCareerDefinitions(
  configDocument: EmbedConfigDocument | null): readonly PanelDefinition[] {
  const base = createCareerPanelDefinitions();
  const refs = readPanelSpecRefs(configDocument);
  if (refs.length === 0) {
    return base;
  }
  const allowed = new Set(refs.map((ref) => ref.id));
  const filtered = base.filter((definition) => allowed.has(definition.id));
  return filtered.length > 0 ? filtered : base;
}

function resolveTenantFixtureDataset(tenant: string): CareerDataset | null {
  const normalized = tenant.trim().toLowerCase();
  if (normalized === 'archipelago') {
    return ARCHIPELAGO_CAREER_DATASET;
  }
  if (normalized === 'helios') {
    return HELIOS_CAREER_DATASET;
  }
  return null;
}

function resolveCareerDatasetInput(
  input: CreateCareerWhiteboardHostBundleInput): StaticCareerDatasetInput {
  const { configDocument, panelDataRaw, tenantConfig } = input;
  const tenant = (input.tenantConfig.tenant ?? input.tenant).trim().toLowerCase();

  if (configDocument?.adapter?.kind === 'static') {
    if (configDocument.adapter.data !== undefined) {
      const validated = validateCareerDataset(configDocument.adapter.data);
      if (validated.ok) {
        return validated.data;
      }
    }
    if (configDocument.adapter.dataUrl?.trim()) {
      return { url: configDocument.adapter.dataUrl.trim() };
    }
  }
  if (configDocument?.adapter?.kind === 'http' && configDocument.adapter.baseUrl.trim()) {
    return { url: configDocument.adapter.baseUrl.trim() };
  }
  if (panelDataRaw !== null) {
    const validated = validateCareerDataset(panelDataRaw);
    if (validated.ok) {
      return validated.data;
    }
    if (!isCareerDatasetPanelPayload(panelDataRaw)) {
      const fixture = resolveTenantFixtureDataset(tenant);
      if (fixture !== null) {
        return fixture;
      }
    }
  }
  if (tenantConfig.panelData !== undefined) {
    const validated = validateCareerDataset(tenantConfig.panelData);
    if (validated.ok) {
      return validated.data;
    }
    const tenantFixture = resolveTenantFixtureDataset(tenant);
    if (tenantFixture !== null) {
      return tenantFixture;
    }
  }
  const fixture = resolveTenantFixtureDataset(tenant);
  if (fixture !== null) {
    return fixture;
  }
  return { url: '' };
}

function createWhiteboardCareerToolRuntime(): CareerToolRuntime {
  const navPanelIds = [...CAREER_PANEL_IDS, 'chat', 'settings', 'voice'];
  return {
    openPanel: (panelId) => {
      closeNavPanelsExcept(panelId, navPanelIds);
      openPanelInCanvas(panelId, {
        focus: true,
        preserveZoom: true,
        reposition: false,
        chrome: { minimized: false },
      });
      return { ok: true, result: `Opened ${panelId}.` };
    },
    setOpenPositionsIntent: (intent) => {
      usePanelIntentStore.getState().setOpenPositionsIntent(intent);
    },
    setResourcesIntent: (intent) => {
      usePanelIntentStore.getState().setResourcesIntent(intent);
    },
    setGrowthPathsIntent: (intent) => {
      usePanelIntentStore.getState().setGrowthPathsIntent(intent);
    },
  };
}

/** Known career tenants when config omits an explicit panels array. */
export const KNOWN_CAREER_TENANT_IDS: ReadonlySet<string> = new Set(['archipelago', 'helios']);

export function shouldRegisterCareerWhiteboardPanels(
  input: CreateCareerWhiteboardHostBundleInput): boolean {
  const refs = readPanelSpecRefs(input.configDocument);
  if (refs.some((ref) => (CAREER_PANEL_IDS as readonly string[]).includes(ref.id))) {
    return true;
  }
  const payload = input.panelDataRaw ?? input.tenantConfig.panelData ?? null;
  if (payload !== null) {
    const hasJobs = Array.isArray(payload.jobs) && payload.jobs.length > 0;
    const hasPaths = Array.isArray(payload.growthPaths) && payload.growthPaths.length > 0;
    const hasResources = Array.isArray(payload.resources) && payload.resources.length > 0;
    if (hasJobs || hasPaths || hasResources) {
      return true;
    }
  }
  const tenant = (input.tenantConfig.tenant ?? input.tenant).trim().toLowerCase();
  return tenant.length > 0 && KNOWN_CAREER_TENANT_IDS.has(tenant);
}

export function createCareerWhiteboardHostBundle(
  input: CreateCareerWhiteboardHostBundleInput): CareerWhiteboardHostBundle {
  applyCareerWhiteboardLayoutHints();
  const tenant = input.tenantConfig.tenant ?? input.tenant ?? 'career-default';
  const fetchFn = input.fetchFn ?? fetch.bind(globalThis);
  const definitions = mergeCareerDefinitions(input.configDocument);
  const datasetInput = resolveCareerDatasetInput(input);
  const adapter: DataAdapter = createStaticCareerAdapter(datasetInput, {
    persistenceKey: tenant,
    fetchFn,
  });
  const engine = createWhiteboardEngine({ drawingEnabled: true });
  const toolRuntime = createWhiteboardCareerToolRuntime();
  const careerTools = createCareerTools(toolRuntime);
  // Register career tools outside `createCanvasHost` so `host.dispose()` (e.g.
  // React Strict Mode remount) does not strip prefetch/executeTool routing while
  // the whiteboard shell is still mounted. Bundle dispose unregisters explicitly.
  const unregisterCareerTools = registerHostActions(careerTools);
  const host = createCanvasHost({
    engine,
    adapter,
    panels: definitions,
    hostActions: [],
  });

  const pack = createCareerPack({ tenant });
  const registeredIds = new Set(definitions.map((definition) => definition.id));
  const navItems = careerNavItemsToNavConfig(pack.navItems, registeredIds);
  const panelLoaders = resolveWhiteboardPanelLoaders(host, DEFAULT_WHITEBOARD_PANEL_REGISTRY);
  const disposeToolbarActions = bindCareerToolbarCustomActions();

  return {
    host,
    engine,
    navItems,
    panelLoaders,
    adapterSources: CAREER_SOURCE_NAMES,
    disposeToolbarActions,
    unregisterCareerTools,
  };
}

export function disposeCareerWhiteboardHostBundle(bundle: CareerWhiteboardHostBundle | null): void {
  if (bundle === null) {
    return;
  }
  bundle.disposeToolbarActions();
  bundle.unregisterCareerTools();
  bundle.host.dispose();
  resetWhiteboardLayoutHints();
}
