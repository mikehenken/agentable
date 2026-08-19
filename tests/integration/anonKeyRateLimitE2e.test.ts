/**
 * e2e: over-limit anon key gets structured refusal, not a hang.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../../src/embed/agentable-canvas';
import type { AgentableCanvasElement } from '../../src/embed/agentable-canvas';
import type { EmbedConfigReloadDetail } from '../../src/embed/configReloadDetail';
import { RATE_LIMITED_CODE } from '../../src/embed/rateLimit';
import {
  clearAnonKeyRateLimitResolverForTests,
  createInMemoryAnonKeyRateLimiter,
  registerAnonKeyRateLimitResolver,
} from '../../src/embed/rateLimit';
import { resetAnonKeyLookupCache } from '../../src/embed/tenantLookup';
import tenantFixture from '../fixtures/embed-config-anon-lookup.json';
import panelData from '../fixtures/panel-data-minimal.json';
import {
  clearEmbedTelemetryEmitForTests,
  registerEmbedTelemetryEmit,
  type TelemetryEvent,
} from '../../src/telemetry';

async function waitForMicrotasks(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe(' anon-key rate limit e2e', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearAnonKeyRateLimitResolverForTests();
    clearEmbedTelemetryEmitForTests();
    resetAnonKeyLookupCache();

    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('embed/config')) {
        return {
          ok: true,
          status: 200,
          json: async () => tenantFixture,
        };
      }
      if (url.includes('panel-data')) {
        return {
          ok: true,
          status: 200,
          json: async () => panelData,
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    clearAnonKeyRateLimitResolverForTests();
    clearEmbedTelemetryEmitForTests();
    resetAnonKeyLookupCache();
  });

  it('over-limit key gets structured rate_limited refusal immediately, not a hang', async () => {
    const telemetryEvents: TelemetryEvent[] = [];
    registerEmbedTelemetryEmit((event) => {
      telemetryEvents.push(event);
    });

    const limiter = createInMemoryAnonKeyRateLimiter({
      maxRequests: 1,
      windowMs: 60_000,
      now: () => 10_000,
    });
    registerAnonKeyRateLimitResolver(limiter);

    const el = document.createElement('agentable-canvas') as AgentableCanvasElement;
    el.setAttribute('data-skip-react-mount', '');
    el.setAttribute('anon-key', 'pk_over_limit');
    el.setAttribute('api-endpoint', '/api');
    document.body.appendChild(el);

    await waitForMicrotasks();

    const callsAfterBootstrap = fetchMock.mock.calls.length;
    expect(callsAfterBootstrap).toBeGreaterThanOrEqual(1);

    let reloadDetail: EmbedConfigReloadDetail | undefined;
    el.addEventListener('agentable:config-reloaded', (event) => {
      reloadDetail = (event as CustomEvent<EmbedConfigReloadDetail>).detail;
    });

    const started = performance.now();
    await el.reload();
    const elapsedMs = performance.now() - started;

    expect(elapsedMs).toBeLessThan(500);
    expect(reloadDetail?.ok).toBe(false);
    expect(reloadDetail?.code).toBe(RATE_LIMITED_CODE);
    expect(typeof reloadDetail?.retryAfterMs).toBe('number');
    expect(reloadDetail?.retryAfterMs).toBeGreaterThan(0);
    expect(fetchMock.mock.calls.length).toBe(callsAfterBootstrap);

    const embedRefusal = telemetryEvents.find(
      (event) => event.family === 'embed' && event.outcome === 'refused');
    expect(embedRefusal?.errorCodes).toEqual(['RATE_LIMITED']);
  });
});
