/**
 * Script-tag data-attribute JS-API parity readers for anon-key lookup.
 *** Canonical attribute on custom elements (`anon-key`). */
export const ANON_KEY_ATTR = 'anon-key';

/** Placeholder attribute for auto-mount scan (`data-anon-key`). */
export const DATA_ANON_KEY_ATTR = 'data-anon-key';

/** Optional override for lookup route (`config-path`). */
export const CONFIG_PATH_ATTR = 'config-path';

export const DATA_CONFIG_PATH_ATTR = 'data-config-path';

export const API_ENDPOINT_ATTR = 'api-endpoint';

export const DATA_API_ENDPOINT_ATTR = 'data-api-endpoint';

function readNonEmptyAttribute(source: Element, name: string): string | undefined {
  const raw = source.getAttribute(name)?.trim();
  return raw && raw.length > 0 ? raw: undefined;
}

/** Read anon key from element — `anon-key` wins over `data-anon-key`. */
export function readAnonKeyFromElement(element: Element): string | undefined {
  return (
    readNonEmptyAttribute(element, ANON_KEY_ATTR) ??
    readNonEmptyAttribute(element, DATA_ANON_KEY_ATTR)
  );
}

export function readConfigPathFromElement(element: Element): string | undefined {
  return (
    readNonEmptyAttribute(element, CONFIG_PATH_ATTR) ??
    readNonEmptyAttribute(element, DATA_CONFIG_PATH_ATTR)
  );
}

export function readApiEndpointFromElement(element: Element): string | undefined {
  return (
    readNonEmptyAttribute(element, API_ENDPOINT_ATTR) ??
    readNonEmptyAttribute(element, DATA_API_ENDPOINT_ATTR)
  );
}

export interface EmbedAnonKeyLookupSnapshot {
  anonKey: string;
  apiBaseUrl: string;
  configPath?: string;
}

/**
 * Resolve anon-key lookup inputs from a host element.
 * Returns null when lookup cannot run (missing key or api base).
 */
export function readAnonKeyLookupFromElement(
  element: Element,
  defaults?: { apiBaseUrl?: string }): EmbedAnonKeyLookupSnapshot | null {
  const anonKey = readAnonKeyFromElement(element);
  if (!anonKey) return null;

  const apiBaseUrl =
    readApiEndpointFromElement(element) ?? defaults?.apiBaseUrl?.trim() ?? '';
  if (!apiBaseUrl) return null;

  const configPath = readConfigPathFromElement(element);
  return {
    anonKey,
    apiBaseUrl,...(configPath ? { configPath }: {}),
  };
}

/** Read anon key from the executing script tag (`data-anon-key`). */
export function readAnonKeyFromCurrentScript(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const script = document.currentScript;
  if (!(script instanceof HTMLScriptElement)) return undefined;
  return script.dataset.anonKey?.trim() || undefined;
}

export interface ScriptTagEmbedHints {
  anonKey?: string;
  apiEndpoint?: string;
  configPath?: string;
  container?: string;
}

/** Parse white-label hints from the current `<script>` tag. */
export function readScriptTagEmbedHints(): ScriptTagEmbedHints | null {
  if (typeof document === 'undefined') return null;
  const script = document.currentScript;
  if (!(script instanceof HTMLScriptElement)) return null;

  const anonKey = script.dataset.anonKey?.trim() || undefined;
  const apiEndpoint = script.dataset.apiEndpoint?.trim() || undefined;
  const configPath = script.dataset.configPath?.trim() || undefined;
  const container = script.dataset.container?.trim() || undefined;

  if (!anonKey && !apiEndpoint && !configPath && !container) {
    return null;
  }

  return {...(anonKey ? { anonKey }: {}),...(apiEndpoint ? { apiEndpoint }: {}),...(configPath ? { configPath }: {}),...(container ? { container }: {}),
  };
}
