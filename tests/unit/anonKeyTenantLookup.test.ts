import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AnonKeyLookupCache,
  AnonKeyTenantLookupError,
  ANON_KEY_HEADER,
  DEFAULT_EMBED_CONFIG_PATH,
  buildAnonKeyTenantLookupUrl,
  fetchTenantEmbedConfigByAnonKey,
  hasAnonKeyTenantLookup,
  resetAnonKeyLookupCache,
  sanitizeEmbedConfigDocument,
} from '../../src/embed/tenantLookup';
import type { EmbedFetchFn } from '../../src/embed/types/embedConfig';
import tenantFixture from '../fixtures/embed-config-anon-lookup.json';
import panelData from '../fixtures/panel-data-minimal.json';

function mockFetch(body: unknown, status = 200): EmbedFetchFn {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as EmbedFetchFn;
}

describe('anonKeyTenantLookup', () => {
  beforeEach(() => {
    resetAnonKeyLookupCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetAnonKeyLookupCache();
  });

  it('buildAnonKeyTenantLookupUrl encodes anon key query param', () => {
    const url = buildAnonKeyTenantLookupUrl({
      apiBaseUrl: '/api',
      anonKey: 'pk_live_test',
    });
    expect(url).toBe('/api/agentable/embed/config?anonKey=pk_live_test');
  });

  it('hasAnonKeyTenantLookup requires anon key and api base', () => {
    expect(hasAnonKeyTenantLookup({ anonKey: 'pk', apiBaseUrl: '/api' })).toBe(true);
    expect(hasAnonKeyTenantLookup({ anonKey: '', apiBaseUrl: '/api' })).toBe(false);
    expect(hasAnonKeyTenantLookup({ anonKey: 'pk', apiBaseUrl: '' })).toBe(false);
  });

  it('fetchTenantEmbedConfigByAnonKey returns sanitized tenant document', async () => {
    const fetchFn = mockFetch(tenantFixture);
    const result = await fetchTenantEmbedConfigByAnonKey({
      anonKey: 'pk_live_test',
      apiBaseUrl: '/api',
      fetchFn,
      cache: new AnonKeyLookupCache,
    });

    expect(result.cacheHit).toBe(false);
    expect(result.document.tenant).toBe('sandals-white-label');
    expect(result.document.primaryColor).toBe('#0077B6');
    expect(result.document.persona?.assistantName).toBe('Sandy');
    expect('auth' in result.document).toBe(false);
    expect('secretApiKey' in result.document).toBe(false);
    expect(fetchFn).toHaveBeenCalledWith(
      '/api/agentable/embed/config?anonKey=pk_live_test',
      expect.objectContaining({
        headers: expect.objectContaining({
          [ANON_KEY_HEADER]: 'pk_live_test',
        }),
      }));
  });

  it('uses TTL cache on repeated lookup', async () => {
    const fetchFn = mockFetch(tenantFixture);
    const cache = new AnonKeyLookupCache({ ttlMs: 60_000, now: () => 1_000 });

    const first = await fetchTenantEmbedConfigByAnonKey({
      anonKey: 'pk_live_test',
      apiBaseUrl: '/api',
      fetchFn,
      cache,
    });
    const second = await fetchTenantEmbedConfigByAnonKey({
      anonKey: 'pk_live_test',
      apiBaseUrl: '/api',
      fetchFn,
      cache,
    });

    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(1);
  });

  it('expires cache entries after TTL', async () => {
    let now = 1_000;
    const fetchFn = mockFetch(tenantFixture);
    const cache = new AnonKeyLookupCache({ ttlMs: 500, now: () => now });

    await fetchTenantEmbedConfigByAnonKey({
      anonKey: 'pk_live_test',
      apiBaseUrl: '/api',
      fetchFn,
      cache,
    });

    now = 2_000;
    await fetchTenantEmbedConfigByAnonKey({
      anonKey: 'pk_live_test',
      apiBaseUrl: '/api',
      fetchFn,
      cache,
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('throws AnonKeyTenantLookupError on HTTP failure', async () => {
    const fetchFn = mockFetch({ error: 'not found' }, 404);
    await expect(
      fetchTenantEmbedConfigByAnonKey({
        anonKey: 'pk_bad',
        apiBaseUrl: '/api',
        fetchFn,
        cache: new AnonKeyLookupCache,
      })).rejects.toMatchObject({
      code: 'http_error',
      status: 404,
    });
  });

  it('throws when anon key is empty', async () => {
    await expect(
      fetchTenantEmbedConfigByAnonKey({
        anonKey: ' ',
        apiBaseUrl: '/api',
        fetchFn: mockFetch(tenantFixture),
      })).rejects.toBeInstanceOf(AnonKeyTenantLookupError);
  });

  it('respects custom config-path', async () => {
    const fetchFn = mockFetch(tenantFixture);
    await fetchTenantEmbedConfigByAnonKey({
      anonKey: 'pk_live_test',
      apiBaseUrl: 'https://api.example.com',
      configPath: '/v1/embed/config',
      fetchFn,
      cache: new AnonKeyLookupCache,
    });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.example.com/v1/embed/config?anonKey=pk_live_test',
      expect.any(Object));
  });
});

describe('sanitizeEmbedConfigDocument', () => {
  it('strips forbidden top-level credential keys', () => {
    const sanitized = sanitizeEmbedConfigDocument({
      tenant: 'acme',
      serviceRoleKey: 'secret',
      GEMINI_API_KEY: 'AIzaSy1234567890abcdefghijklmnop',
    });
    expect(sanitized?.tenant).toBe('acme');
    expect(sanitized).not.toHaveProperty('serviceRoleKey');
    expect(sanitized).not.toHaveProperty('GEMINI_API_KEY');
  });

  it('keeps adapter static dataUrl references', () => {
    const sanitized = sanitizeEmbedConfigDocument({
      adapter: { kind: 'static', dataUrl: '/data/jobs.json' },
    });
    expect(sanitized?.adapter).toEqual({ kind: 'static', dataUrl: '/data/jobs.json' });
  });

  it('rejects non-object payloads', () => {
    expect(sanitizeEmbedConfigDocument(null)).toBeNull();
    expect(sanitizeEmbedConfigDocument('bad')).toBeNull();
  });
});

describe('resolveEmbedPanelData anon-key integration', () => {
  it('config-url wins over anon-key lookup', async () => {
    const { resolveEmbedPanelData } = await import('../../src/embed/embedConfigLoader');
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('embed-config-static')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ tenant: 'config-url-wins', panelData }),
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as unknown as EmbedFetchFn;

    const result = await resolveEmbedPanelData({
      configUrl: '/fixtures/embed-config-static.json',
      panelDataUrl: '',
      anonKey: 'pk_live_test',
      apiBaseUrl: '/api',
      fetchFn,
    });

    expect(result.configDoc?.tenant).toBe('config-url-wins');
    expect(result.anonKeyLookup).toBeUndefined();
  });

  it('anon-key lookup resolves adapter panel data when config-url empty', async () => {
    const { resolveEmbedPanelData } = await import('../../src/embed/embedConfigLoader');
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/agentable/embed/config')) {
        return { ok: true, status: 200, json: async () => tenantFixture };
      }
      if (url.includes('panel-data-minimal')) {
        return { ok: true, status: 200, json: async () => panelData };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }) as unknown as EmbedFetchFn;

    const result = await resolveEmbedPanelData({
      configUrl: '',
      panelDataUrl: '',
      anonKey: 'pk_live_test',
      apiBaseUrl: '/api',
      fetchFn,
    });

    expect(result.anonKeyLookup).toBe(true);
    expect(result.configDoc?.tenant).toBe('sandals-white-label');
    expect(result.panelDataRaw?.jobs).toHaveLength(1);
  });
});

describe('DEFAULT_EMBED_CONFIG_PATH', () => {
  it('matches house white-label route', () => {
    expect(DEFAULT_EMBED_CONFIG_PATH).toBe('/agentable/embed/config');
  });
});
