/**
 * Shared embed config source fields for Lit elements and JS API mounts.
 */
export interface EmbedConfigHostFields {
  configUrl: string;
  panelDataUrl: string;
  anonKey: string;
  apiEndpoint: string;
  configPath: string;
}

export function hasEmbedConfigSource(host: EmbedConfigHostFields): boolean {
  return Boolean(
    host.configUrl.trim() ||
      host.panelDataUrl.trim() ||
      (host.anonKey.trim() && host.apiEndpoint.trim()));
}

export function embedConfigSourceChanged(
  changed: Map<string, unknown>): boolean {
  return (
    changed.has('configUrl') ||
    changed.has('panelDataUrl') ||
    changed.has('anonKey') ||
    changed.has('apiEndpoint') ||
    changed.has('configPath')
  );
}

export function buildEmbedConfigSourceInput(
  host: EmbedConfigHostFields,
  fetchFn: typeof fetch): {
  configUrl: string;
  panelDataUrl: string;
  fetchFn: typeof fetch;
  anonKey?: string;
  apiBaseUrl?: string;
  configPath?: string;
} {
  return {
    configUrl: host.configUrl,
    panelDataUrl: host.panelDataUrl,
    fetchFn,...(host.anonKey.trim() ? { anonKey: host.anonKey.trim() }: {}),...(host.apiEndpoint.trim() ? { apiBaseUrl: host.apiEndpoint.trim() }: {}),...(host.configPath.trim() ? { configPath: host.configPath.trim() }: {}),
  };
}
