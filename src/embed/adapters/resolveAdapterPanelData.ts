/**
 * Static and HTTP embed adapters — resolve panel-data payloads for the Lit shell.
 */
import type { RawPanelDataPayload } from '../../config/panelDataNormalize';
import type {
  EmbedAdapterConfig,
  EmbedFetchFn,
  StaticEmbedAdapterConfig,
  HttpEmbedAdapterConfig,
} from '../types/embedConfig';

async function fetchJsonDocument(
  url: string,
  fetchFn: EmbedFetchFn): Promise<RawPanelDataPayload> {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null) {
    throw new Error('Adapter response is not a JSON object');
  }
  return body as RawPanelDataPayload;
}

function assertStaticAdapter(
  adapter: EmbedAdapterConfig): asserts adapter is StaticEmbedAdapterConfig {
  if (adapter.kind !== 'static') {
    throw new Error(`Expected static adapter, got "${adapter.kind}"`);
  }
}

function assertHttpAdapter(
  adapter: EmbedAdapterConfig): asserts adapter is HttpEmbedAdapterConfig {
  if (adapter.kind !== 'http') {
    throw new Error(`Expected http adapter, got "${adapter.kind}"`);
  }
}

/** Resolve panel data from a declared embed adapter. */
export async function resolvePanelDataFromAdapter(
  adapter: EmbedAdapterConfig,
  fetchFn: EmbedFetchFn): Promise<RawPanelDataPayload> {
  if (adapter.kind === 'static') {
    assertStaticAdapter(adapter);
    if (adapter.data !== undefined) {
      return adapter.data;
    }
    if (adapter.dataUrl) {
      return fetchJsonDocument(adapter.dataUrl, fetchFn);
    }
    throw new Error('Static adapter requires `data` or `dataUrl`');
  }

  assertHttpAdapter(adapter);
  if (!adapter.baseUrl.trim()) {
    throw new Error('HTTP adapter requires non-empty `baseUrl`');
  }
  return fetchJsonDocument(adapter.baseUrl, fetchFn);
}

/** Moss legacy: fetch a raw panel-data JSON document from panel-data-url. */
export async function fetchLegacyPanelDataUrl(
  panelDataUrl: string,
  fetchFn: EmbedFetchFn): Promise<RawPanelDataPayload> {
  if (!panelDataUrl.trim()) {
    throw new Error('panel-data-url is empty');
  }
  return fetchJsonDocument(panelDataUrl, fetchFn);
}
