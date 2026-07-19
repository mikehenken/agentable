/**
 * Lifecycle and persistence contract of `createCanvasHost`.
 *
 * A fake engine handle drives every scenario; nothing here touches tldraw
 * or the whiteboard internals. The suite pins the ordering guarantees the
 * host promises its callers: `whenReady` settles on engine readiness,
 * `whenRestoreSettled` settles only after ready plus a completed restore
 * attempt, restores run once per scope, and saves are debounced, ordered
 * after every in-flight restore including ones that start mid-hold, and
 * survive both export and adapter failures.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createCanvasHost,
  type EngineHandle,
  type EngineLifecycleEvent,
  type WorkspacePersistenceAdapter,
} from '../../src/panels/host';
import type { JsonObject, PanelScope } from '../../src/panels/types';

const SAVE_DEBOUNCE_MS = 1200;

class FakeEngine implements EngineHandle {
  snapshot: JsonObject = { shapes: ['current'] };
  imported: JsonObject[] = [];
  importError: Error | null = null;
  exportError: Error | null = null;
  private ready = false;
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
    if (this.exportError) throw this.exportError;
    return this.snapshot;
  }

  importSnapshot(snapshot: JsonObject): void {
    if (this.importError) throw this.importError;
    this.imported.push(snapshot);
    this.snapshot = snapshot;
  }

  becomeReady(): void {
    this.ready = true;
    for (const listener of [...this.listeners.ready]) listener();
  }

  emitChange(): void {
    for (const listener of [...this.listeners.change]) listener();
  }
}

interface AdapterOverrides {
  load?: WorkspacePersistenceAdapter['load'];
  save?: WorkspacePersistenceAdapter['save'];
}

function makeAdapter(overrides: AdapterOverrides = {}) {
  return {
    load: vi.fn(overrides.load ?? (async () => null)),
    save: vi.fn(overrides.save ?? (async () => undefined)),
  };
}

async function flushMicrotasks(rounds = 10): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await Promise.resolve();
  }
}

async function settled(promise: Promise<unknown>): Promise<boolean> {
  const marker = Symbol('pending');
  const result = await Promise.race([promise, Promise.resolve(marker)]);
  return result !== marker;
}

const scopeA: PanelScope = { contextId: 'ctx-a', entityId: 'ent-1' };
const scopeB: PanelScope = { contextId: 'ctx-b' };

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('whenReady', () => {
  it('resolves immediately when the engine is already ready', async () => {
    const engine = new FakeEngine();
    engine.becomeReady();
    const host = createCanvasHost({ engine });
    await expect(host.whenReady()).resolves.toBeUndefined();
  });

  it('stays pending until the engine reports ready', async () => {
    const engine = new FakeEngine();
    const host = createCanvasHost({ engine });
    const readyPromise = host.whenReady();

    await flushMicrotasks();
    expect(await settled(readyPromise)).toBe(false);

    engine.becomeReady();
    await expect(readyPromise).resolves.toBeUndefined();
  });

  it('returns the same settled promise on repeat calls', async () => {
    const engine = new FakeEngine();
    const host = createCanvasHost({ engine });
    expect(host.whenReady()).toBe(host.whenReady());
    engine.becomeReady();
    await expect(host.whenReady()).resolves.toBeUndefined();
  });
});

describe('whenRestoreSettled', () => {
  it('does not consult the adapter before the engine is ready', async () => {
    const engine = new FakeEngine();
    const adapter = makeAdapter();
    const host = createCanvasHost({ engine, persistence: adapter });
    const restorePromise = host.whenRestoreSettled(scopeA);

    await flushMicrotasks();
    expect(adapter.load).not.toHaveBeenCalled();
    expect(await settled(restorePromise)).toBe(false);

    engine.becomeReady();
    await restorePromise;
    expect(adapter.load).toHaveBeenCalledTimes(1);
    expect(adapter.load).toHaveBeenCalledWith(scopeA);
  });

  it('resolves after whenReady, with the loaded snapshot imported first', async () => {
    const engine = new FakeEngine();
    const stored: JsonObject = { shapes: ['persisted'] };
    const adapter = makeAdapter({ load: async () => stored });
    const host = createCanvasHost({ engine, persistence: adapter });

    const order: string[] = [];
    void host.whenReady().then(() => order.push('ready'));
    const restorePromise = host.whenRestoreSettled(scopeA).then(() => {
      order.push('restore-settled');
    });

    engine.becomeReady();
    await restorePromise;
    await flushMicrotasks();

    expect(order).toEqual(['ready', 'restore-settled']);
    expect(engine.imported).toEqual([stored]);
  });

  it('runs the restore once per scope and shares the promise', async () => {
    const engine = new FakeEngine();
    engine.becomeReady();
    const adapter = makeAdapter();
    const host = createCanvasHost({ engine, persistence: adapter });

    const first = host.whenRestoreSettled(scopeA);
    const second = host.whenRestoreSettled({ ...scopeA });
    expect(second).toBe(first);

    await first;
    await host.whenRestoreSettled(scopeA);
    expect(adapter.load).toHaveBeenCalledTimes(1);
  });

  it('restores distinct scopes independently', async () => {
    const engine = new FakeEngine();
    engine.becomeReady();
    const adapter = makeAdapter();
    const host = createCanvasHost({ engine, persistence: adapter });

    await Promise.all([host.whenRestoreSettled(scopeA), host.whenRestoreSettled(scopeB)]);
    expect(adapter.load).toHaveBeenCalledTimes(2);
    expect(adapter.load).toHaveBeenCalledWith(scopeA);
    expect(adapter.load).toHaveBeenCalledWith(scopeB);
  });

  it('settles without touching the engine when no adapter is configured', async () => {
    const engine = new FakeEngine();
    engine.becomeReady();
    const host = createCanvasHost({ engine });

    await host.whenRestoreSettled(scopeA);
    expect(engine.imported).toEqual([]);
  });

  it('skips the import when nothing was persisted', async () => {
    const engine = new FakeEngine();
    engine.becomeReady();
    const adapter = makeAdapter({ load: async () => null });
    const host = createCanvasHost({ engine, persistence: adapter });

    await host.whenRestoreSettled(scopeA);
    expect(engine.imported).toEqual([]);
  });

  it('settles despite a failing load, leaving the canvas untouched', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const engine = new FakeEngine();
    engine.becomeReady();
    const adapter = makeAdapter({
      load: async () => {
        throw new Error('storage offline');
      },
    });
    const host = createCanvasHost({ engine, persistence: adapter });

    await expect(host.whenRestoreSettled(scopeA)).resolves.toBeUndefined();
    expect(engine.imported).toEqual([]);
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it('settles despite a failing import', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const engine = new FakeEngine();
    engine.becomeReady();
    engine.importError = new Error('snapshot schema mismatch');
    const adapter = makeAdapter({ load: async () => ({ shapes: [] }) });
    const host = createCanvasHost({ engine, persistence: adapter });

    await expect(host.whenRestoreSettled(scopeA)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledOnce();
  });
});

describe('persisted saves', () => {
  it('debounces engine changes into one save with the active scope', async () => {
    vi.useFakeTimers();
    const engine = new FakeEngine();
    engine.becomeReady();
    const adapter = makeAdapter();
    const host = createCanvasHost({ engine, persistence: adapter });
    await host.whenRestoreSettled(scopeA);

    engine.emitChange();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS - 1);
    expect(adapter.save).not.toHaveBeenCalled();

    engine.emitChange();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS - 1);
    expect(adapter.save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(adapter.save).toHaveBeenCalledTimes(1);
    expect(adapter.save).toHaveBeenCalledWith(scopeA, engine.snapshot);
  });

  it('saves with a null scope before any restore was requested', async () => {
    vi.useFakeTimers();
    const engine = new FakeEngine();
    engine.becomeReady();
    const adapter = makeAdapter();
    createCanvasHost({ engine, persistence: adapter });

    engine.emitChange();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(adapter.save).toHaveBeenCalledTimes(1);
    expect(adapter.save).toHaveBeenCalledWith(null, engine.snapshot);
  });

  it('holds a save until an in-flight restore settles', async () => {
    vi.useFakeTimers();
    const engine = new FakeEngine();
    engine.becomeReady();
    let releaseLoad: (snapshot: JsonObject) => void = () => undefined;
    const adapter = makeAdapter({
      load: () =>
        new Promise<JsonObject | null>((resolve) => {
          releaseLoad = resolve;
        }),
    });
    const host = createCanvasHost({ engine, persistence: adapter });
    const restorePromise = host.whenRestoreSettled(scopeA);
    await flushMicrotasks();

    engine.emitChange();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(adapter.save).not.toHaveBeenCalled();

    const stored: JsonObject = { shapes: ['persisted'] };
    releaseLoad(stored);
    await restorePromise;
    engine.snapshot = { shapes: ['persisted', 'edited'] };
    await flushMicrotasks();

    expect(adapter.save).toHaveBeenCalledTimes(1);
    expect(adapter.save).toHaveBeenCalledWith(scopeA, engine.snapshot);
  });

  it('drains a restore that starts during the hold before saving', async () => {
    vi.useFakeTimers();
    const engine = new FakeEngine();
    engine.becomeReady();
    const releases = new Map<string, (snapshot: JsonObject | null) => void>();
    const adapter = makeAdapter({
      load: (scope) =>
        new Promise<JsonObject | null>((resolve) => {
          releases.set(scope.contextId ?? '', resolve);
        }),
    });
    const host = createCanvasHost({ engine, persistence: adapter });

    const restoreA = host.whenRestoreSettled(scopeA);
    await flushMicrotasks();

    engine.emitChange();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);

    // Context switch while the flush is already holding for restore A.
    const restoreB = host.whenRestoreSettled(scopeB);
    await flushMicrotasks();

    releases.get('ctx-a')?.({ shapes: ['a-stored'] });
    await restoreA;
    await flushMicrotasks();
    // Saving here would persist scope A's canvas under scope B's key.
    expect(adapter.save).not.toHaveBeenCalled();

    releases.get('ctx-b')?.({ shapes: ['b-stored'] });
    await restoreB;
    await flushMicrotasks();

    expect(adapter.save).toHaveBeenCalledTimes(1);
    expect(adapter.save).toHaveBeenCalledWith(scopeB, { shapes: ['b-stored'] });
  });

  it('keeps saving after exportSnapshot throws', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const engine = new FakeEngine();
    engine.becomeReady();
    const adapter = makeAdapter();
    createCanvasHost({ engine, persistence: adapter });

    engine.exportError = new Error('editor torn down');
    engine.emitChange();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(adapter.save).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledOnce();

    engine.exportError = null;
    engine.emitChange();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(adapter.save).toHaveBeenCalledTimes(1);
    expect(adapter.save).toHaveBeenCalledWith(null, engine.snapshot);
  });

  it('keeps saving after an adapter failure', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const engine = new FakeEngine();
    engine.becomeReady();
    let failNext = true;
    const adapter = makeAdapter({
      save: async () => {
        if (failNext) {
          failNext = false;
          throw new Error('write rejected');
        }
      },
    });
    createCanvasHost({ engine, persistence: adapter });

    engine.emitChange();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(errorSpy).toHaveBeenCalledOnce();

    engine.emitChange();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(adapter.save).toHaveBeenCalledTimes(2);
  });
});

describe('dispose', () => {
  it('flushes a scheduled save instead of dropping it', async () => {
    vi.useFakeTimers();
    const engine = new FakeEngine();
    engine.becomeReady();
    const adapter = makeAdapter();
    const host = createCanvasHost({ engine, persistence: adapter });

    engine.emitChange();
    host.dispose();
    await flushMicrotasks();
    expect(adapter.save).toHaveBeenCalledTimes(1);
    expect(adapter.save).toHaveBeenCalledWith(null, engine.snapshot);
  });

  it('stops observing engine changes', async () => {
    vi.useFakeTimers();
    const engine = new FakeEngine();
    engine.becomeReady();
    const adapter = makeAdapter();
    const host = createCanvasHost({ engine, persistence: adapter });

    host.dispose();
    engine.emitChange();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS * 2);
    expect(adapter.save).not.toHaveBeenCalled();
  });

  it('abandons a restore that has not reached the engine yet', async () => {
    const engine = new FakeEngine();
    const stored: JsonObject = { shapes: ['persisted'] };
    const adapter = makeAdapter({ load: async () => stored });
    const host = createCanvasHost({ engine, persistence: adapter });
    const restorePromise = host.whenRestoreSettled(scopeA);

    host.dispose();
    engine.becomeReady();
    await restorePromise;
    expect(adapter.load).not.toHaveBeenCalled();
    expect(engine.imported).toEqual([]);
  });
});
