/**
 * Anon-key tenant embed config lookup (D44 / P9-T6).
 *
 * Fetches a public tenant config document via anon/public key — no service role
 * or provider secrets in the client bundle (G3).
 */
import type { EmbedConfigDocument, EmbedFetchFn } from '../types/embedConfig';
import {
  assertAnonKeyRateAllowed,
  parseRetryAfterMs,
  throwRateLimitedFromHttp429,
} from '../rateLimit';
import {
  AnonKeyLookupCache,
  getAnonKeyLookupCache,
} from './anonKeyLookupCache';
import { sanitizeEmbedConfigDocument } from './sanitizeEmbedConfigDocument';

/** Default path appended to `api-endpoint` for white-label lookup. */
export const DEFAULT_EMBED_CONFIG_PATH = '/agentable/embed/config';

export const ANON_KEY_HEADER = 'X-Agentable-Anon-Key';

export interface AnonKeyTenantLookupInput {
  anonKey: string;
  /** Base API origin/path — typically the embed `api-endpoint` attribute. */
  apiBaseUrl: string;
  /** Relative config route; default {@link DEFAULT_EMBED_CONFIG_PATH}. */
  configPath?: string;
  fetchFn?: EmbedFetchFn;
  cache?: AnonKeyLookupCache;
  signal?: AbortSignal;
}

export interface AnonKeyTenantLookupResult {
  document: EmbedConfigDocument;
  cacheHit: boolean;
  status: number;
}

export class AnonKeyTenantLookupError extends Error {
  readonly code: 'missing_anon_key' | 'missing_api_base' | 'http_error' | 'invalid_json';
  readonly status?: number;

  constructor(
    code: AnonKeyTenantLookupError['code'],
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = 'AnonKeyTenantLookupError';
    this.code = code;
    this.status = status;
  }
}

export function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.trim().replace(/\/$/, '');
}

export function normalizeConfigPath(configPath: string | undefined): string {
  const path = (configPath ?? DEFAULT_EMBED_CONFIG_PATH).trim();
  if (!path) return DEFAULT_EMBED_CONFIG_PATH;
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Build the tenant lookup URL. Query param + header both carry the anon key so
 * hosts can authenticate either way.
 */
export function buildAnonKeyTenantLookupUrl(input: {
  apiBaseUrl: string;
  configPath?: string;
  anonKey: string;
}): string {
  const base = normalizeApiBaseUrl(input.apiBaseUrl);
  const path = normalizeConfigPath(input.configPath);
  const url = new URL(`${base}${path}`, 'http://localhost');
  url.searchParams.set('anonKey', input.anonKey.trim());
  return `${base}${path}?${url.searchParams.toString()}`;
}

export function hasAnonKeyTenantLookup(input: {
  anonKey?: string;
  apiBaseUrl?: string;
}): boolean {
  return Boolean(input.anonKey?.trim() && input.apiBaseUrl?.trim());
}

/**
 * Fetch tenant embed config by anon/public key with TTL caching and sanitization.
 */
export async function fetchTenantEmbedConfigByAnonKey(
  input: AnonKeyTenantLookupInput,
): Promise<AnonKeyTenantLookupResult> {
  const anonKey = input.anonKey.trim();
  if (!anonKey) {
    throw new AnonKeyTenantLookupError('missing_anon_key', 'anon-key is empty');
  }
  const apiBaseUrl = input.apiBaseUrl.trim();
  if (!apiBaseUrl) {
    throw new AnonKeyTenantLookupError('missing_api_base', 'api-endpoint is empty');
  }

  const configPath = normalizeConfigPath(input.configPath);
  const cache = input.cache ?? getAnonKeyLookupCache();
  const cacheKey = cache.buildKey({ apiBaseUrl, configPath, anonKey });

  await assertAnonKeyRateAllowed({
    anonKey,
    ctx: {
      operation: 'tenant_lookup',
      apiBaseUrl,
    },
  });

  const cached = cache.get(cacheKey);
  if (cached) {
    return { document: cached, cacheHit: true, status: 200 };
  }

  const fetchFn = input.fetchFn ?? fetch.bind(globalThis);
  const url = buildAnonKeyTenantLookupUrl({ apiBaseUrl, configPath, anonKey });
  const response = await fetchFn(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      [ANON_KEY_HEADER]: anonKey,
    },
    signal: input.signal,
  });

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfterMs = parseRetryAfterMs(response.headers.get('Retry-After'));
      throwRateLimitedFromHttp429({
        anonKey,
        retryAfterMs,
        operation: 'tenant_lookup',
      });
    }
    throw new AnonKeyTenantLookupError(
      'http_error',
      `anon-key tenant lookup failed: HTTP ${response.status}`,
      response.status,
    );
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new AnonKeyTenantLookupError('invalid_json', 'anon-key tenant lookup returned invalid JSON');
  }

  const document = sanitizeEmbedConfigDocument(raw) ?? {};
  cache.set(cacheKey, document);
  return { document, cacheHit: false, status: response.status };
}
