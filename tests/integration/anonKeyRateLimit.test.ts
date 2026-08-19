/**
 * anon-key rate limiting.
 *
 * Automated check: over-limit key gets a structured rate_limited refusal, not a hang.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AnonKeyRateLimitedError,
  RATE_LIMITED_CODE,
  buildRateLimitedRefusal,
  clearAnonKeyRateLimitResolverForTests,
  createInMemoryAnonKeyRateLimiter,
  isRateLimitedRefusal,
  parseRetryAfterMs,
  registerAnonKeyRateLimitResolver,
} from '../../src/embed/rateLimit';
import {
  AnonKeyLookupCache,
  fetchTenantEmbedConfigByAnonKey,
  resetAnonKeyLookupCache,
} from '../../src/embed/tenantLookup';
import type { EmbedFetchFn } from '../../src/embed/types/embedConfig';
import tenantFixture from '../fixtures/embed-config-anon-lookup.json';

function mockFetch(body: unknown, status = 200, headers: Record<string, string> = {}): EmbedFetchFn {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name: string) {
        const key = Object.keys(headers).find(
          (entry) => entry.toLowerCase() === name.toLowerCase());
        return key ? headers[key] : null;
      },
    },
    json: async () => body,
  })) as unknown as EmbedFetchFn;
}

describe('anon-key rate limiting', () => {
  beforeEach(() => {
    resetAnonKeyLookupCache();
    clearAnonKeyRateLimitResolverForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetAnonKeyLookupCache();
    clearAnonKeyRateLimitResolverForTests();
  });

  it('buildRateLimitedRefusal matches the structured rate_limited shape', () => {
    const refusal = buildRateLimitedRefusal({
      anonKey: 'pk_live_abuse_key',
      denied: {
        allowed: false,
        retryAfterMs: 30_000,
        limit: 10,
        windowMs: 60_000,
      },
    });

    expect(isRateLimitedRefusal(refusal)).toBe(true);
    expect(refusal).toMatchObject({
      code: RATE_LIMITED_CODE,
      retryAfterMs: 30_000,
      limit: 10,
      windowMs: 60_000,
      anonKeyHint: 'pk_live_…',
    });
    expect(refusal.message).toContain('rate limit');
  });

  it('parseRetryAfterMs reads seconds and defaults safely', () => {
    expect(parseRetryAfterMs('30')).toBe(30_000);
    expect(parseRetryAfterMs(null)).toBe(60_000);
    expect(parseRetryAfterMs('not-a-date')).toBe(60_000);
  });

  it('host resolver refusal rejects immediately without fetch (no hang)', async () => {
    const limiter = createInMemoryAnonKeyRateLimiter({
      maxRequests: 1,
      windowMs: 60_000,
      now: () => 1_000,
    });
    registerAnonKeyRateLimitResolver(limiter);

    const fetchFn = mockFetch(tenantFixture);
    const input = {
      anonKey: 'pk_live_test',
      apiBaseUrl: '/api',
      fetchFn,
      cache: new AnonKeyLookupCache({ ttlMs: 60_000, now: () => 1_000 }),
    };

    await fetchTenantEmbedConfigByAnonKey(input);

    const started = Date.now();
    await expect(fetchTenantEmbedConfigByAnonKey(input)).rejects.toBeInstanceOf(
      AnonKeyRateLimitedError);
    expect(Date.now() - started).toBeLessThan(250);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('HTTP 429 maps to structured rate_limited refusal', async () => {
    const fetchFn = mockFetch({ error: 'too many requests' }, 429, {
      'Retry-After': '45',
    });

    await expect(
      fetchTenantEmbedConfigByAnonKey({
        anonKey: 'pk_live_test',
        apiBaseUrl: '/api',
        fetchFn,
        cache: new AnonKeyLookupCache(),
      })).rejects.toMatchObject({
      code: RATE_LIMITED_CODE,
      refusal: {
        code: RATE_LIMITED_CODE,
        retryAfterMs: 45_000,
      },
    });
  });

  it('emits embed telemetry with RATE_LIMITED when sink registered', async () => {
    const events: unknown[] = [];
    const { registerEmbedTelemetryEmit, clearEmbedTelemetryEmitForTests } = await import(
      '../../src/telemetry/embedBridge'
    );
    registerEmbedTelemetryEmit((event) => {
      events.push(event);
    });

    registerAnonKeyRateLimitResolver(() => ({
      allowed: false,
      retryAfterMs: 15_000,
      limit: 5,
      windowMs: 60_000,
    }));

    await expect(
      fetchTenantEmbedConfigByAnonKey({
        anonKey: 'pk_live_test',
        apiBaseUrl: '/api',
        fetchFn: mockFetch(tenantFixture),
        cache: new AnonKeyLookupCache({ ttlMs: 60_000, now: () => 1_000 }),
      })).rejects.toBeInstanceOf(AnonKeyRateLimitedError);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      family: 'embed',
      operation: 'tenant_lookup',
      outcome: 'refused',
      errorCodes: ['RATE_LIMITED'],
    });

    clearEmbedTelemetryEmitForTests();
  });
});
