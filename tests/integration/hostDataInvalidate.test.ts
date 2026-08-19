/**
 *: `host.data.invalidate` fans out refetches across every mounted
 * consumer of a source and emits an AG-UI state patch on the existing
 * `landi:ag-ui-state-patch` bus (no parallel protocol).
 */
import { describe, expect, it } from 'vitest';
import {
  AG_UI_STATE_PATCH_EVENT,
  type AgUiStatePatchEventDetail,
} from '../../src/canvas/protocol/ag-ui';
import {
  AG_UI_DATA_INVALIDATE_PATH_PREFIX,
  createCanvasHost,
  type EngineHandle,
  type EngineLifecycleEvent,
} from '../../src/panels/host';
import type { JsonObject, PanelScope } from '../../src/panels/types';
import { createMockDataAdapter } from '../helpers/mockDataAdapter';

const SCOPE: PanelScope = { contextId: 'site-1' };
const SCOPE_B: PanelScope = { contextId: 'site-2' };

class FakeEngine implements EngineHandle {
  private ready = true;
  private listeners: Record<EngineLifecycleEvent, Set<() => void>> = {
    ready: new Set(),
    change: new Set(),
  };

  isReady(): boolean {
    return this.ready;
  }

  on(event: EngineLifecycleEvent, listener: () => void): () => void {
    this.listeners[event].add(listener);
    return () => {
      this.listeners[event].delete(listener);
    };
  }

  exportSnapshot(): JsonObject {
    return {};
  }

  importSnapshot(): void {}
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function listenAgUiPatches(): {
  events: AgUiStatePatchEventDetail[];
  stop: () => void;
} {
  const events: AgUiStatePatchEventDetail[] = [];
  const handler = (event: Event): void => {
    const detail = (event as CustomEvent<AgUiStatePatchEventDetail>).detail;
    if (detail !== undefined) events.push(detail);
  };
  window.addEventListener(AG_UI_STATE_PATCH_EVENT, handler);
  return {
    events,
    stop: () => window.removeEventListener(AG_UI_STATE_PATCH_EVENT, handler),
  };
}

describe('host.data.invalidate fan-out', () => {
  it('refetches every mounted consumer of one source (shared + distinct params)', async () => {
    const adapter = createMockDataAdapter({ latencyMs: 10 });
    const host = createCanvasHost({ engine: new FakeEngine(), adapter });
    const lifecycle = host.data.lifecycle;
    expect(lifecycle).not.toBeNull();
    if (lifecycle === null) return;

    // Two listeners on the same cache entry (shared key).
    const sharedA = lifecycle.acquire({ source: 'career.jobs' }, SCOPE);
    const sharedB = lifecycle.acquire({ source: 'career.jobs' }, SCOPE);
    // A third consumer of the same source with different params (own entry).
    const otherParams = lifecycle.acquire(
      { source: 'career.jobs', params: { track: 'eng' } },
      SCOPE,
    );
    // Unrelated source must stay untouched.
    const paths = lifecycle.acquire({ source: 'career.paths' }, SCOPE);

    await adapter.whenIdle();
    await sleep(1);
    expect(adapter.queryCount('career.jobs')).toBe(2);
    expect(adapter.queryCount('career.paths')).toBe(1);
    expect(sharedA.getSnapshot().data).toBe('career.jobs-v0');
    expect(sharedB.getSnapshot().data).toBe('career.jobs-v0');
    expect(otherParams.getSnapshot().data).toBe('career.jobs-v1');
    expect(paths.getSnapshot().data).toBe('career.paths-v0');

    const versionsBefore = {
      shared: lifecycle.getVersion({ source: 'career.jobs' }, SCOPE),
      other: lifecycle.getVersion(
        { source: 'career.jobs', params: { track: 'eng' } },
        SCOPE,
      ),
      paths: lifecycle.getVersion({ source: 'career.paths' }, SCOPE),
    };

    host.data.invalidate('career.jobs');
    await adapter.whenIdle();
    await sleep(1);

    // One refetch per mounted jobs entry (shared key + params key).
    expect(adapter.queryCount('career.jobs')).toBe(4);
    expect(adapter.queryCount('career.paths')).toBe(1);
    expect(sharedA.getSnapshot().data).toBe('career.jobs-v2');
    expect(sharedB.getSnapshot().data).toBe('career.jobs-v2');
    expect(otherParams.getSnapshot().data).toBe('career.jobs-v3');
    expect(paths.getSnapshot().data).toBe('career.paths-v0');
    expect(lifecycle.getVersion({ source: 'career.jobs' }, SCOPE)).toBeGreaterThan(
      versionsBefore.shared,
    );
    expect(
      lifecycle.getVersion({ source: 'career.jobs', params: { track: 'eng' } }, SCOPE),
    ).toBeGreaterThan(versionsBefore.other);
    expect(lifecycle.getVersion({ source: 'career.paths' }, SCOPE)).toBe(
      versionsBefore.paths,
    );

    sharedA.release();
    sharedB.release();
    otherParams.release();
    paths.release();
    host.dispose();
  });

  it('scope-filtered invalidate leaves other scopes alone while still fanning out', async () => {
    const adapter = createMockDataAdapter({ latencyMs: 10 });
    const host = createCanvasHost({ engine: new FakeEngine(), adapter });
    const lifecycle = host.data.lifecycle;
    expect(lifecycle).not.toBeNull();
    if (lifecycle === null) return;

    const a1 = lifecycle.acquire({ source: 'career.jobs' }, SCOPE);
    const a2 = lifecycle.acquire(
      { source: 'career.jobs', params: { q: 'x' } },
      SCOPE,
    );
    const b1 = lifecycle.acquire({ source: 'career.jobs' }, SCOPE_B);
    await adapter.whenIdle();
    await sleep(1);
    expect(adapter.queryCount('career.jobs')).toBe(3);

    host.data.invalidate('career.jobs', { contextId: 'site-1' });
    await adapter.whenIdle();
    await sleep(1);

    expect(adapter.queryCount('career.jobs')).toBe(5);
    expect(a1.getSnapshot().data).toBe('career.jobs-v3');
    expect(a2.getSnapshot().data).toBe('career.jobs-v4');
    expect(b1.getSnapshot().data).toBe('career.jobs-v2');

    a1.release();
    a2.release();
    b1.release();
    host.dispose();
  });
});

describe('host.data.invalidate AG-UI emission', () => {
  it('emits landi:ag-ui-state-patch with /data/<source> on invalidate', async () => {
    const adapter = createMockDataAdapter({ latencyMs: 5 });
    const host = createCanvasHost({ engine: new FakeEngine(), adapter });
    const lifecycle = host.data.lifecycle;
    expect(lifecycle).not.toBeNull();
    if (lifecycle === null) return;

    const handle = lifecycle.acquire({ source: 'site.files' }, SCOPE);
    await adapter.whenIdle();

    const { events, stop } = listenAgUiPatches();
    try {
      host.data.invalidate('site.files', { contextId: 'site-1', entityId: 'page-9' });
      expect(events).toHaveLength(1);
      const detail = events[0];
      expect(detail?.source).toBe('host');
      expect(detail?.patches).toHaveLength(1);
      const patch = detail?.patches[0];
      expect(patch?.op).toBe('replace');
      expect(patch?.path).toBe(`${AG_UI_DATA_INVALIDATE_PATH_PREFIX}site.files`);
      expect(patch?.value).toMatchObject({
        scope: { contextId: 'site-1', entityId: 'page-9' },
      });
      expect(typeof (patch?.value as { invalidatedAt?: unknown }).invalidatedAt).toBe(
        'string',
      );
    } finally {
      stop();
      handle.release();
      host.dispose();
    }
  });

  it('emits AG-UI patch even when no DataAdapter is configured', () => {
    const host = createCanvasHost({ engine: new FakeEngine() });
    expect(host.data.lifecycle).toBeNull();

    const { events, stop } = listenAgUiPatches();
    try {
      host.data.invalidate('career.jobs');
      expect(events).toHaveLength(1);
      expect(events[0]?.source).toBe('host');
      expect(events[0]?.patches[0]?.path).toBe(
        `${AG_UI_DATA_INVALIDATE_PATH_PREFIX}career.jobs`,
      );
    } finally {
      stop();
      host.dispose();
    }
  });

  it('lifecycle.invalidate through the host store also emits AG-UI', async () => {
    const adapter = createMockDataAdapter({ latencyMs: 5 });
    const host = createCanvasHost({ engine: new FakeEngine(), adapter });
    const lifecycle = host.data.lifecycle;
    expect(lifecycle).not.toBeNull();
    if (lifecycle === null) return;

    const handle = lifecycle.acquire({ source: 'career.jobs' }, SCOPE);
    await adapter.whenIdle();

    const { events, stop } = listenAgUiPatches();
    try {
      // SpecRenderer and other store consumers call lifecycle.invalidate
      // directly; the host-owned store still emits via onInvalidate.
      lifecycle.invalidate('career.jobs');
      expect(events).toHaveLength(1);
      expect(events[0]?.patches[0]?.path).toBe(
        `${AG_UI_DATA_INVALIDATE_PATH_PREFIX}career.jobs`,
      );
    } finally {
      stop();
      handle.release();
      host.dispose();
    }
  });

  it('does not emit after dispose', () => {
    const host = createCanvasHost({ engine: new FakeEngine() });
    host.dispose();
    const { events, stop } = listenAgUiPatches();
    try {
      host.data.invalidate('career.jobs');
      expect(events).toHaveLength(0);
    } finally {
      stop();
    }
  });
});
