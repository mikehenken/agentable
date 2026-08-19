/**
 * Resolve panel definitions + DataAdapter for `<agentable-panel>` from merged
 * embed config (config-url, attributes, inline adapter data).
 */
import {
  CAREER_PANEL_IDS,
  CAREER_SOURCE_NAMES,
  createCareerPanelDefinitions,
  createStaticCareerAdapter,
  MINIMAL_CAREER_DATASET,
  validateCareerDataset,
  type StaticCareerDatasetInput,
} from '../../../packages/career-pack/src/index';
import {
  SUPPORT_INBOX_PANEL_IDS,
  SUPPORT_INBOX_SOURCE_NAMES,
  createSupportInboxPanelDefinitions,
  createStaticSupportInboxAdapter,
  MINIMAL_SUPPORT_DATASET,
  validateSupportDataset,
  type StaticSupportInboxDatasetInput,
} from '../../../packages/support-inbox-pack/src/index';
import type { RawPanelDataPayload } from '../../config/panelDataNormalize';
import type { EmbedConfigDocument } from '../types/embedConfig';
import type { DataAdapter } from '../../panels/renderer';
import type { PanelDefinition } from '../../panels/types';
import { createPanelRegistry } from '../../panels/registry';

export interface ResolveEmbedPanelHostInput {
  panelId: string;
  configDocument: EmbedConfigDocument | null;
  panelDataRaw: RawPanelDataPayload | null;
  tenant: string;
  fetchFn?: typeof fetch;
}

export interface ResolvedEmbedPanelHost {
  panelId: string;
  definition: PanelDefinition;
  definitions: readonly PanelDefinition[];
  adapter: DataAdapter;
  adapterSources: readonly string[];
  instanceId: string;
}

export class EmbedPanelResolutionError extends Error {
  readonly code: 'PANEL_UNKNOWN' | 'PANEL_SPEC_INVALID' | 'ADAPTER_MISSING';

  constructor(code: EmbedPanelResolutionError['code'], message: string) {
    super(message);
    this.name = 'EmbedPanelResolutionError';
    this.code = code;
  }
}

type EmbedPackKind = 'career' | 'support-inbox';

function resolvePackKind(panelId: string): EmbedPackKind | null {
  if (SUPPORT_INBOX_PANEL_IDS.includes(panelId as (typeof SUPPORT_INBOX_PANEL_IDS)[number])) {
    return 'support-inbox';
  }
  if (CAREER_PANEL_IDS.includes(panelId as (typeof CAREER_PANEL_IDS)[number])) {
    return 'career';
  }
  return null;
}

function panelDefinitionsForKind(kind: EmbedPackKind): readonly PanelDefinition[] {
  return kind === 'support-inbox'
    ? createSupportInboxPanelDefinitions(): createCareerPanelDefinitions();
}

function mergeDefinitionsFromConfig(
  base: readonly PanelDefinition[],
  configDocument: EmbedConfigDocument | null): readonly PanelDefinition[] {
  if (!configDocument?.panels?.length) {
    return base;
  }
  const byId = new Map(base.map((definition) => [definition.id, definition]));
  for (const entry of configDocument.panels) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as { id?: unknown; kind?: unknown };
    if (typeof record.id !== 'string' || !byId.has(record.id)) {
      continue;
    }
  }
  return Object.freeze([...byId.values()]);
}

function normalizeCareerDataset(raw: unknown): StaticCareerDatasetInput {
  const validated = validateCareerDataset(raw);
  if (validated.ok) {
    return validated.data;
  }
  throw new EmbedPanelResolutionError(
    'ADAPTER_MISSING',
    'Inline adapter data is not a valid career dataset document.');
}

function normalizeSupportDataset(raw: unknown): StaticSupportInboxDatasetInput {
  const validated = validateSupportDataset(raw);
  if (validated.ok) {
    return validated.data;
  }
  throw new EmbedPanelResolutionError(
    'ADAPTER_MISSING',
    'Inline adapter data is not a valid support inbox dataset document.');
}

function resolveDatasetInput(
  kind: EmbedPackKind,
  panelId: string,
  configDocument: EmbedConfigDocument | null,
  panelDataRaw: RawPanelDataPayload | null): StaticCareerDatasetInput | StaticSupportInboxDatasetInput {
  if (configDocument?.adapter?.kind === 'static') {
    if (configDocument.adapter.data !== undefined) {
      return kind === 'support-inbox'
        ? normalizeSupportDataset(configDocument.adapter.data): normalizeCareerDataset(configDocument.adapter.data);
    }
    if (configDocument.adapter.dataUrl?.trim()) {
      return { url: configDocument.adapter.dataUrl.trim() };
    }
  }
  if (configDocument?.adapter?.kind === 'http' && configDocument.adapter.baseUrl.trim()) {
    return { url: configDocument.adapter.baseUrl.trim() };
  }
  if (panelDataRaw !== null) {
    const supportValidated = validateSupportDataset(panelDataRaw);
    if (supportValidated.ok) {
      return supportValidated.data;
    }
    return kind === 'support-inbox'
      ? normalizeSupportDataset(panelDataRaw): normalizeCareerDataset(panelDataRaw);
  }
  if (configDocument?.panelData) {
    return kind === 'support-inbox'
      ? normalizeSupportDataset(configDocument.panelData): normalizeCareerDataset(configDocument.panelData);
  }
  if (kind === 'support-inbox') {
    return MINIMAL_SUPPORT_DATASET;
  }
  if (CAREER_PANEL_IDS.includes(panelId as (typeof CAREER_PANEL_IDS)[number])) {
    return MINIMAL_CAREER_DATASET;
  }
  throw new EmbedPanelResolutionError(
    'ADAPTER_MISSING',
    'Panel embed requires adapter data via config-url adapter, panel-data-url, or inline panelData.');
}

function createAdapterForKind(
  kind: EmbedPackKind,
  datasetInput: StaticCareerDatasetInput | StaticSupportInboxDatasetInput,
  tenant: string,
  fetchFn: typeof fetch): DataAdapter {
  if (kind === 'support-inbox') {
    return createStaticSupportInboxAdapter(datasetInput as StaticSupportInboxDatasetInput, {
      persistenceKey: tenant || 'default',
      fetchFn,
    });
  }
  return createStaticCareerAdapter(datasetInput as StaticCareerDatasetInput, {
    persistenceKey: tenant || 'default',
    fetchFn,
  });
}

/** Resolve a single panel surface + shared host wiring for adapter lifecycle. */
export function resolveEmbedPanelHost(input: ResolveEmbedPanelHostInput): ResolvedEmbedPanelHost {
  const panelId = input.panelId.trim();
  if (!panelId) {
    throw new EmbedPanelResolutionError('PANEL_UNKNOWN', 'Panel id is empty.');
  }

  const packKind = resolvePackKind(panelId);
  if (packKind === null) {
    throw new EmbedPanelResolutionError(
      'PANEL_UNKNOWN',
      `No pack registered for panel id "${panelId}". Known career ids: ${CAREER_PANEL_IDS.join(', ')}; support ids: ${SUPPORT_INBOX_PANEL_IDS.join(', ')}.`);
  }

  const definitions = mergeDefinitionsFromConfig(panelDefinitionsForKind(packKind), input.configDocument);
  const registry = createPanelRegistry(definitions);
  const definition = registry.get(panelId);

  if (definition === undefined) {
    const known = registry.ids().join(', ') || '(none)';
    throw new EmbedPanelResolutionError(
      'PANEL_UNKNOWN',
      `No panel registered for id "${panelId}". Known ids: ${known}.`);
  }

  const fetchFn = input.fetchFn ?? fetch.bind(globalThis);
  const datasetInput = resolveDatasetInput(
    packKind,
    panelId,
    input.configDocument,
    input.panelDataRaw);
  const adapter = createAdapterForKind(packKind, datasetInput, input.tenant, fetchFn);

  const adapterSources =
    packKind === 'support-inbox'
      ? [...SUPPORT_INBOX_SOURCE_NAMES]: definition.kind === 'spec'
        ? [...CAREER_SOURCE_NAMES]: CAREER_PANEL_IDS.includes(panelId as (typeof CAREER_PANEL_IDS)[number])
          ? [...CAREER_SOURCE_NAMES]: [];

  return {
    panelId,
    definition,
    definitions,
    adapter,
    adapterSources,
    instanceId: `embed-${panelId}`,
  };
}
