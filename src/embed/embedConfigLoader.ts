/**
 * Fetch and parse embed config-url documents and anon-key tenant lookup.
 */
import type { EmbedConfigDocument, EmbedFetchFn } from './types/embedConfig';
import {
  fetchLegacyPanelDataUrl,
  resolvePanelDataFromAdapter,
} from './adapters/resolveAdapterPanelData';
import type { RawPanelDataPayload } from '../config/panelDataNormalize';
import {
  AnonKeyTenantLookupError,
  fetchTenantEmbedConfigByAnonKey,
  hasAnonKeyTenantLookup,
} from './tenantLookup';

export async function fetchEmbedConfigDocument(
  configUrl: string,
  fetchFn: EmbedFetchFn,
): Promise<EmbedConfigDocument> {
  if (!configUrl.trim()) {
    throw new Error('config-url is empty');
  }
  const response = await fetchFn(configUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null) {
    throw new Error('config-url response is not a JSON object');
  }
  return body as EmbedConfigDocument;
}

export interface ResolvedEmbedPanelData {
  configDoc: EmbedConfigDocument | null;
  panelDataRaw: RawPanelDataPayload | null;
  /** True when tenant config came from anon-key lookup (not config-url). */
  anonKeyLookup?: boolean;
}

export interface EmbedConfigSourceInput {
  configUrl: string;
  panelDataUrl: string;
  fetchFn: EmbedFetchFn;
  /** Public embed anon key — used when config-url is empty. */
  anonKey?: string;
  /** Base URL for anon-key lookup (embed `api-endpoint`). */
  apiBaseUrl?: string;
  /** Override lookup route (default `/agentable/embed/config`). */
  configPath?: string;
}

async function resolvePanelDataFromConfigDoc(
  configDoc: EmbedConfigDocument,
  fetchFn: EmbedFetchFn,
): Promise<RawPanelDataPayload | null> {
  if (configDoc.adapter) {
    return resolvePanelDataFromAdapter(configDoc.adapter, fetchFn);
  }
  if (configDoc.panelData) {
    return configDoc.panelData;
  }
  return null;
}

/**
 * Resolve tenant config + panel-data.
 *
 * Precedence: `config-url` > anon-key tenant lookup > legacy `panel-data-url`.
 */
export async function resolveEmbedPanelData(
  input: EmbedConfigSourceInput,
): Promise<ResolvedEmbedPanelData> {
  const { configUrl, panelDataUrl, fetchFn } = input;

  if (configUrl.trim()) {
    const configDoc = await fetchEmbedConfigDocument(configUrl, fetchFn);
    const panelDataRaw = await resolvePanelDataFromConfigDoc(configDoc, fetchFn);
    return { configDoc, panelDataRaw };
  }

  if (
    hasAnonKeyTenantLookup({
      anonKey: input.anonKey,
      apiBaseUrl: input.apiBaseUrl,
    })
  ) {
    const lookup = await fetchTenantEmbedConfigByAnonKey({
      anonKey: input.anonKey!.trim(),
      apiBaseUrl: input.apiBaseUrl!.trim(),
      configPath: input.configPath,
      fetchFn,
    });
    const configDoc = lookup.document;
    const panelDataRaw = await resolvePanelDataFromConfigDoc(configDoc, fetchFn);
    return { configDoc, panelDataRaw, anonKeyLookup: true };
  }

  if (panelDataUrl.trim()) {
    const panelDataRaw = await fetchLegacyPanelDataUrl(panelDataUrl, fetchFn);
    return { configDoc: null, panelDataRaw };
  }

  return { configDoc: null, panelDataRaw: null };
}

export { AnonKeyTenantLookupError };
