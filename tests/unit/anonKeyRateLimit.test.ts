/**
 * anon-key rate limiting unit coverage.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AnonKeyRateLimitedError,
  RATE_LIMITED_CODE,
  assertAnonKeyRateAllowed,
  buildRateLimitedRefusal,
  clearAnonKeyRateLimitResolverForTests,
  createInMemoryAnonKeyRateLimiter,
  isAnonKeyRateLimitedError,
  isRateLimitedRefusal,
  parseRetryAfterMs,
  registerAnonKeyRateLimitResolver,
} from '../../src/embed/rateLimit';
import {
  buildEmbedConfigReloadDetail,
} from '../../src/embed/configReloadDetail';
import {
  fetchTenantEmbedConfigByAnonKey,
  resetAnonKeyLookupCache,
} from '../../src/embed/tenantLookup';
import {
  clearEmbedTelemetryEmitForTests,
  registerEmbedTelemetryEmit,
  type TelemetryEvent,
} from '../../src/telemetry';
import tenantFixture from '../fixtures/embed-config-anon-lookup.json';

describe('anonKeyRateLimit ', () => {
  beforeEach(() => {
    clearAnonKeyRateLimitResolverForTests();
    clearEmbedTelemetryEmitForTests();
    resetAnonKeyLookupCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearAnonKeyRateLimitResolverForTests();
    clearEmbedTelemetryEmitForTests();
    resetAnonKeyLookupCache();
  });

  it('buildRateLimitedRefusal returns structured rate_limited shape', () => {
    const refusal = buildRateLimitedRefusal({
      anonKey: 'pk_live_test_key',
      denied: {
        allowed: false,
        retryAfterMs: 5_000,
        limit: 10,
        windowMs: 60_000,
      },
    });

    expect(refusal.code).toBe(RATE_LIMITED_CODE);
    expect(refusal.retryAfterMs).toBe(5_000);
    expect(refusal.limit).toBe(10);
    expect(refusal.windowMs).toBe(60_000);
    expect(refusal.anonKeyHint).toBe('pk_live_…');
    expect(isRateLimitedRefusal(refusal)).toBe(true);
  });

  it('parseRetryAfterMs handles seconds and defaults', () => {
    expect(parseRetryAfterMs(null)).toBe(60_000);
    expect(parseRetryAfterMs('2', 1_000)).toBe(2_000);
  });

  it('in-memory limiter denies after maxRequests in window', async () => {
    const limiter = createInMemoryAnonKeyRateLimiter({
      maxRequests: 2,
      windowMs: 10_000,
      now: () => 1_000,
    });
    registerAnonKeyRateLimitResolver(limiter);

    await assertAnonKeyRateAllowed({
      anonKey: 'pk_burst',
      ctx: { operation: 'tenant_lookup', apiBaseUrl: '/api' },
    });
    await assertAnonKeyRateAllowed({
      anonKey: 'pk_burst',
      ctx: { operation: 'tenant_lookup', apiBaseUrl: '/api' },
    });

    await expect(
      assertAnonKeyRateAllowed({
        anonKey: 'pk_burst',
        ctx: { operation: 'tenant_lookup', apiBaseUrl: '/api' },
      })).rejects.toBeInstanceOf(AnonKeyRateLimitedError);
  });

  it('assertAnonKeyRateAllowed emits embed telemetry with RATE_LIMITED', async () => {
    const events: TelemetryEvent[] = [];
    registerEmbedTelemetryEmit((event) => {
      events.push(event);
    });

    registerAnonKeyRateLimitResolver(() => ({
      allowed: false,
      retryAfterMs: 250,
      limit: 1,
      windowMs: 1_000,
    }));

    await expect(
      assertAnonKeyRateAllowed({
        anonKey: 'pk_denied',
        ctx: { operation: 'tenant_lookup' },
      })).rejects.toMatchObject({
      code: RATE_LIMITED_CODE,
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.family).toBe('embed');
    expect(events[0]).toMatchObject({
      outcome: 'refused',
      operation: 'tenant_lookup',
      errorCodes: ['RATE_LIMITED'],
    });
  });

  it('fetchTenantEmbedConfigByAnonKey maps HTTP 429 to structured refusal', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 429,
      headers: {
        get: (name: string) => (name === 'Retry-After' ? '3': null),
      },
      json: async () => ({}),
    }));

    await expect(
      fetchTenantEmbedConfigByAnonKey({
        anonKey: 'pk_429',
        apiBaseUrl: '/api',
        fetchFn: fetchFn as unknown as typeof fetch,
      })).rejects.toSatisfy((error: unknown) => isAnonKeyRateLimitedError(error));
  });

  it('buildEmbedConfigReloadDetail surfaces rate_limited on config reload', () => {
    const refusal = buildRateLimitedRefusal({
      anonKey: 'pk_reload',
      denied: { allowed: false, retryAfterMs: 1_500, limit: 5, windowMs: 60_000 },
    });
    const detail = buildEmbedConfigReloadDetail(false, new AnonKeyRateLimitedError(refusal));

    expect(detail.ok).toBe(false);
    expect(detail.code).toBe(RATE_LIMITED_CODE);
    expect(detail.retryAfterMs).toBe(1_500);
    expect(detail.limit).toBe(5);
  });

  it('allows lookup when no resolver registered', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => tenantFixture,
    }));

    const result = await fetchTenantEmbedConfigByAnonKey({
      anonKey: 'pk_ok',
      apiBaseUrl: '/api',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.document.tenant).toBe('sandals-white-label');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
