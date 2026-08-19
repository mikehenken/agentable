/**
 * Store-level contract for `createDataLifecycle` (02 section 6, 05
 * section 1), exercised against the instrumented mock adapter with real
 * async timing: cache keying, in-flight dedupe, abort on last release
 * and on invalidate, the single `unavailable` retry, remote-change
 * stale-vs-silent-refetch, and disposal.
 */
import { describe, expect, it } from 'vitest';
import { createDataLifecycle, sourceCacheKey, stableStringify } from '../../src/panels/renderer';
import type { PanelScope } from '../../src/panels/types';
import { createMockDataAdapter } from '../helpers/mockDataAdapter';

const SCOPE_A: PanelScope = { contextId: 'site-1', entityId: 'page-1' };
const SCOPE_B: PanelScope = { contextId: 'site-2', entityId: 'page-9' };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('cache key construction', () => {
  it('serializes params with sorted keys so property order never splits the cache', () => {
    const a = sourceCacheKey({ source: 's', params: { a: 1, b: [2, { d: 4, c: 3 }] } }, SCOPE_A);
    const b = sourceCacheKey({ source: 's', params: { b: [2, { c: 3, d: 4 }], a: 1 } }, SCOPE_A);
    expect(a).toBe(b);
  });

  it('separates entries by source, params, and both scope keys', () => {
    const base = sourceCacheKey({ source: 's', params: { q: 1 } }, SCOPE_A);
    expect(sourceCacheKey({ source: 't', params: { q: 1 } }, SCOPE_A)).not.toBe(base);
    expect(sourceCacheKey({ source: 's', params: { q: 2 } }, SCOPE_A)).not.toBe(base);
    expect(sourceCacheKey({ source: 's', params: { q: 1 } }, SCOPE_B)).not.toBe(base);
    expect(
      sourceCacheKey({ source: 's', params: { q: 1 } }, { contextId: 'site-1' })).not.toBe(base);
  });

  it('stableStringify round-trips primitives and nested structures deterministically', () => {
    expect(stableStringify(undefined)).toBe('null');
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify({ b: 'x', a: [1, true, null] })).toBe('{"a":[1,true,null],"b":"x"}');
  });
});

describe('fetch, cache, and dedupe', () => {
  it('fetches once and shares data across concurrent consumers of the same key', async () => {
    const adapter = createMockDataAdapter();
    const lifecycle = createDataLifecycle({ adapter });
    const first = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    const second = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);

    expect(first.key).toBe(second.key);
    expect(first.getSnapshot().status).toBe('loading');
    await adapter.whenIdle();
    await sleep(1);

    expect(adapter.queryCount('jobs')).toBe(1);
    expect(first.getSnapshot().data).toBe('jobs-v0');
    expect(second.getSnapshot()).toBe(first.getSnapshot());
    lifecycle.dispose();
  });

  it('keys separately per params and scope and fetches each key once', async () => {
    const adapter = createMockDataAdapter();
    const lifecycle = createDataLifecycle({ adapter });
    lifecycle.acquire({ source: 'jobs', params: { track: 'design' } }, SCOPE_A);
    lifecycle.acquire({ source: 'jobs', params: { track: 'eng' } }, SCOPE_A);
    lifecycle.acquire({ source: 'jobs', params: { track: 'design' } }, SCOPE_B);
    await adapter.whenIdle();

    expect(adapter.queryCount('jobs')).toBe(3);
    lifecycle.dispose();
  });

  it('serves cached data to a remounting consumer without a new query', async () => {
    const adapter = createMockDataAdapter();
    const lifecycle = createDataLifecycle({ adapter });
    const first = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    await adapter.whenIdle();
    await sleep(1);
    first.release();

    const second = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    expect(second.getSnapshot().status).toBe('success');
    expect(second.getSnapshot().data).toBe('jobs-v0');
    expect(adapter.queryCount('jobs')).toBe(1);
    lifecycle.dispose();
  });

  it('dedupes refetch: concurrent calls share one in-flight query and one promise', async () => {
    const adapter = createMockDataAdapter();
    const lifecycle = createDataLifecycle({ adapter });
    const handle = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    await adapter.whenIdle();
    await sleep(1);

    const p1 = handle.refetch();
    const p2 = handle.refetch();
    expect(p2).toBe(p1);
    await p1;
    expect(adapter.queryCount('jobs')).toBe(2);
    lifecycle.dispose();
  });

  it('keeps current data visible during a silent refetch (no loading flash)', async () => {
    const adapter = createMockDataAdapter();
    const lifecycle = createDataLifecycle({ adapter });
    const handle = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    await adapter.whenIdle();
    await sleep(1);

    const refetching = handle.refetch();
    const during = handle.getSnapshot();
    expect(during.status).toBe('success');
    expect(during.data).toBe('jobs-v0');
    expect(during.inFlight).toBe(true);
    await refetching;
    expect(handle.getSnapshot().data).toBe('jobs-v1');
    lifecycle.dispose();
  });
});

describe('abort behavior', () => {
  it('aborts the in-flight query when the last consumer releases', async () => {
    const adapter = createMockDataAdapter({ latencyMs: 50 });
    const lifecycle = createDataLifecycle({ adapter });
    const handle = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    expect(adapter.queries[0]?.outcome).toBe('pending');

    handle.release();
    expect(adapter.queries[0]?.signal.aborted).toBe(true);
    expect(adapter.abortedCount('jobs')).toBe(1);

    // Nothing usable was cached, so a remount starts a fresh query.
    const again = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    expect(again.getSnapshot().status).toBe('loading');
    await adapter.whenIdle();
    await sleep(1);
    expect(adapter.queryCount('jobs')).toBe(2);
    expect(again.getSnapshot().data).toBe('jobs-v1');
    lifecycle.dispose();
  });

  it('does not abort while another consumer still holds the binding', async () => {
    const adapter = createMockDataAdapter({ latencyMs: 40 });
    const lifecycle = createDataLifecycle({ adapter });
    const first = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    const second = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);

    first.release();
    expect(adapter.queries[0]?.signal.aborted).toBe(false);
    await adapter.whenIdle();
    await sleep(1);
    expect(second.getSnapshot().data).toBe('jobs-v0');
    lifecycle.dispose();
  });

  it('an aborted fetch never writes its result back into the cache', async () => {
    const adapter = createMockDataAdapter({ latencyMs: 30 });
    const lifecycle = createDataLifecycle({ adapter });
    const handle = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    handle.release();
    await sleep(60);

    const fresh = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    // v0 was aborted; the remount fetch is v1 and must be what lands.
    await adapter.whenIdle();
    await sleep(1);
    expect(fresh.getSnapshot().data).toBe('jobs-v1');
    lifecycle.dispose();
  });

  it('dispose aborts everything in flight and detaches remote subscriptions', async () => {
    const adapter = createMockDataAdapter({ latencyMs: 50 });
    const lifecycle = createDataLifecycle({ adapter });
    lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    lifecycle.acquire({ source: 'paths' }, SCOPE_A);
    expect(adapter.subscriberCount()).toBe(2);

    lifecycle.dispose();
    expect(adapter.abortedCount()).toBe(2);
    expect(adapter.subscriberCount()).toBe(0);
    expect(() => lifecycle.acquire({ source: 'jobs' }, SCOPE_A)).toThrow(/disposed/);
  });
});

describe('invalidate', () => {
  it('aborts an in-flight query and starts a fresh one for mounted bindings', async () => {
    const adapter = createMockDataAdapter({ latencyMs: 40 });
    const lifecycle = createDataLifecycle({ adapter });
    const handle = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);

    lifecycle.invalidate('jobs');
    expect(adapter.abortedCount('jobs')).toBe(1);
    expect(adapter.queryCount('jobs')).toBe(2);
    await adapter.whenIdle();
    await sleep(1);
    expect(handle.getSnapshot().data).toBe('jobs-v1');
    lifecycle.dispose();
  });

  it('clears data so mounted bindings show loading again, then repopulates', async () => {
    const adapter = createMockDataAdapter();
    const lifecycle = createDataLifecycle({ adapter });
    const handle = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    await adapter.whenIdle();
    await sleep(1);
    expect(handle.getSnapshot().data).toBe('jobs-v0');

    lifecycle.invalidate('jobs');
    expect(handle.getSnapshot().status).toBe('loading');
    expect(handle.getSnapshot().data).toBeUndefined();
    await adapter.whenIdle();
    await sleep(1);
    expect(handle.getSnapshot().data).toBe('jobs-v1');
    lifecycle.dispose();
  });

  it('drops unmounted cache entries instead of refetching them', async () => {
    const adapter = createMockDataAdapter();
    const lifecycle = createDataLifecycle({ adapter });
    const handle = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    await adapter.whenIdle();
    await sleep(1);
    handle.release();

    lifecycle.invalidate('jobs');
    expect(adapter.queryCount('jobs')).toBe(1);
    expect(lifecycle.peek({ source: 'jobs' }, SCOPE_A).status).toBe('idle');
    lifecycle.dispose();
  });

  it('honors a partial scope filter and leaves other scopes untouched', async () => {
    const adapter = createMockDataAdapter();
    const lifecycle = createDataLifecycle({ adapter });
    lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    lifecycle.acquire({ source: 'jobs' }, SCOPE_B);
    lifecycle.acquire({ source: 'paths' }, SCOPE_A);
    await adapter.whenIdle();
    await sleep(1);
    expect(adapter.queryCount()).toBe(3);

    lifecycle.invalidate('jobs', { contextId: 'site-1' });
    await adapter.whenIdle();
    await sleep(1);
    expect(adapter.queryCount('jobs')).toBe(3);
    expect(adapter.queryCount('paths')).toBe(1);
    lifecycle.dispose();
  });

  it('invokes onInvalidate after cache work with the same arguments', () => {
    const adapter = createMockDataAdapter();
    const calls: Array<{ source: string; scope?: PanelScope }> = [];
    const lifecycle = createDataLifecycle({
      adapter,
      onInvalidate: (source, scope) => {
        calls.push(scope !== undefined ? { source, scope } : { source });
      },
    });
    lifecycle.invalidate('jobs', { contextId: 'site-1' });
    expect(calls).toEqual([{ source: 'jobs', scope: { contextId: 'site-1' } }]);
    lifecycle.invalidate('paths');
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual({ source: 'paths' });
    lifecycle.dispose();
    lifecycle.invalidate('jobs');
    expect(calls).toHaveLength(2);
  });
});

describe('retry policy', () => {
  it('retries exactly once on unavailable and then succeeds', async () => {
    const adapter = createMockDataAdapter({
      plan: (ref, _scope, callIndex) =>
        callIndex === 0
          ? { error: { code: 'unavailable', message: 'try later' } }: { data: `${ref.source}-recovered` },
    });
    const lifecycle = createDataLifecycle({ adapter, retryBackoffMs: 5 });
    const handle = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);

    await sleep(80);
    expect(adapter.queryCount('jobs')).toBe(2);
    expect(handle.getSnapshot().status).toBe('success');
    expect(handle.getSnapshot().data).toBe('jobs-recovered');
    lifecycle.dispose();
  });

  it('gives up after the single retry when unavailable persists', async () => {
    const adapter = createMockDataAdapter({
      plan: () => ({ error: { code: 'unavailable', message: 'still down' } }),
    });
    const lifecycle = createDataLifecycle({ adapter, retryBackoffMs: 5 });
    const handle = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);

    await sleep(80);
    expect(adapter.queryCount('jobs')).toBe(2);
    expect(handle.getSnapshot().status).toBe('error');
    expect(handle.getSnapshot().error?.code).toBe('unavailable');
    lifecycle.dispose();
  });

  it('does not retry other error codes', async () => {
    const adapter = createMockDataAdapter({
      plan: () => ({ error: { code: 'forbidden', message: 'no access' } }),
    });
    const lifecycle = createDataLifecycle({ adapter, retryBackoffMs: 5 });
    const handle = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);

    await sleep(60);
    expect(adapter.queryCount('jobs')).toBe(1);
    expect(handle.getSnapshot().error?.code).toBe('forbidden');
    lifecycle.dispose();
  });
});

describe('remote change wiring', () => {
  it('refetches silently when no consumer is dirty', async () => {
    const adapter = createMockDataAdapter();
    const lifecycle = createDataLifecycle({ adapter });
    const handle = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    await adapter.whenIdle();
    await sleep(1);

    adapter.emitRemoteChange('jobs');
    expect(handle.getSnapshot().stale).toBe(false);
    await adapter.whenIdle();
    await sleep(1);
    expect(adapter.queryCount('jobs')).toBe(2);
    expect(handle.getSnapshot().data).toBe('jobs-v1');
    lifecycle.dispose();
  });

  it('turns stale instead of refetching while a consumer is dirty', async () => {
    const adapter = createMockDataAdapter();
    const lifecycle = createDataLifecycle({ adapter });
    const handle = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    await adapter.whenIdle();
    await sleep(1);

    handle.setDirty('form-1', true);
    adapter.emitRemoteChange('jobs');
    expect(handle.getSnapshot().stale).toBe(true);
    expect(handle.getSnapshot().data).toBe('jobs-v0');
    await sleep(40);
    expect(adapter.queryCount('jobs')).toBe(1);
    lifecycle.dispose();
  });

  it('an explicit refetch resolves the stale flag with fresh data', async () => {
    const adapter = createMockDataAdapter();
    const lifecycle = createDataLifecycle({ adapter });
    const handle = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    await adapter.whenIdle();
    await sleep(1);
    handle.setDirty('form-1', true);
    adapter.emitRemoteChange('jobs');
    expect(handle.getSnapshot().stale).toBe(true);

    await handle.refetch();
    expect(handle.getSnapshot().stale).toBe(false);
    expect(handle.getSnapshot().data).toBe('jobs-v1');
    lifecycle.dispose();
  });

  it('clearing the last dirty owner while stale triggers the deferred silent refetch', async () => {
    const adapter = createMockDataAdapter();
    const lifecycle = createDataLifecycle({ adapter });
    const handle = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    await adapter.whenIdle();
    await sleep(1);
    handle.setDirty('form-1', true);
    adapter.emitRemoteChange('jobs');
    expect(handle.getSnapshot().stale).toBe(true);

    handle.setDirty('form-1', false);
    await adapter.whenIdle();
    await sleep(1);
    expect(adapter.queryCount('jobs')).toBe(2);
    expect(handle.getSnapshot().stale).toBe(false);
    expect(handle.getSnapshot().data).toBe('jobs-v1');
    lifecycle.dispose();
  });

  it('releasing a dirty consumer drops its dirty ownership', async () => {
    const adapter = createMockDataAdapter();
    const lifecycle = createDataLifecycle({ adapter });
    const dirtyHandle = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    const watcher = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    await adapter.whenIdle();
    await sleep(1);

    dirtyHandle.setDirty('form-1', true);
    dirtyHandle.release();
    adapter.emitRemoteChange('jobs');
    await adapter.whenIdle();
    await sleep(1);
    // With the dirty consumer gone the change refetches silently.
    expect(watcher.getSnapshot().stale).toBe(false);
    expect(adapter.queryCount('jobs')).toBe(2);
    lifecycle.dispose();
  });
});

describe('snapshots', () => {
  it('keeps snapshot identity stable between changes', async () => {
    const adapter = createMockDataAdapter();
    const lifecycle = createDataLifecycle({ adapter });
    const handle = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    await adapter.whenIdle();
    await sleep(1);

    const a = handle.getSnapshot();
    const b = handle.getSnapshot();
    expect(b).toBe(a);
    await handle.refetch();
    expect(handle.getSnapshot()).not.toBe(a);
    lifecycle.dispose();
  });

  it('peek never creates cache entries', () => {
    const adapter = createMockDataAdapter();
    const lifecycle = createDataLifecycle({ adapter });
    expect(lifecycle.peek({ source: 'jobs' }, SCOPE_A).status).toBe('idle');
    expect(lifecycle.getVersion({ source: 'jobs' }, SCOPE_A)).toBe(0);
    expect(adapter.queryCount()).toBe(0);
    lifecycle.dispose();
  });

  it('notifies subscribed listeners on every state transition', async () => {
    const adapter = createMockDataAdapter();
    const lifecycle = createDataLifecycle({ adapter });
    const handle = lifecycle.acquire({ source: 'jobs' }, SCOPE_A);
    const seen: string[] = [];
    handle.subscribe(() => {
      seen.push(handle.getSnapshot().status);
    });
    await adapter.whenIdle();
    await sleep(1);
    expect(seen).toContain('success');
    lifecycle.dispose();
  });
});
