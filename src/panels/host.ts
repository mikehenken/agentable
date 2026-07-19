/**
 * createCanvasHost: the panel system's runtime entry point. The host owns
 * lifecycle (readiness, workspace restore) and the persistence seam, and
 * drives the canvas exclusively through an engine handle, so nothing in
 * this module knows which engine implementation is mounted.
 */
import type { JsonObject, PanelScope } from './types';

/**
 * Lifecycle signals the host consumes from the engine. `ready` fires once
 * per handle when the underlying editor is bound and can accept commands.
 * `change` reports user-driven content or layout mutations and never fires
 * before `ready`; programmatic writes such as a snapshot import must not
 * emit it, otherwise every restore would immediately persist itself back.
 */
export type EngineLifecycleEvent = 'ready' | 'change';

/**
 * The slice of the engine contract the host needs today: a readiness
 * signal plus native snapshot transport. The full CanvasEngine SPI (panel
 * containers, camera, capabilities) is specified in the panel system spec
 * section 14 and lands in src/engine with the SPI task; this type migrates
 * there and existing consumers keep the same shape.
 */
export interface EngineHandle {
  /** True once the underlying editor is bound. */
  isReady(): boolean;
  /** Subscribe to a lifecycle event. Returns an unsubscribe function. */
  on(event: EngineLifecycleEvent, listener: () => void): () => void;
  /** Serialize the engine's native workspace snapshot for persistence. */
  exportSnapshot(): JsonObject;
  /** Load a previously persisted native snapshot onto the bound editor. */
  importSnapshot(snapshot: JsonObject): void;
}

/**
 * Storage seam for workspace snapshots. `load` answers the restore
 * question for one scope: a stored snapshot, or null when nothing was
 * persisted. `save` receives the current snapshot together with the most
 * recently requested restore scope, or null when no restore was requested
 * on this host, so adapters can route scopeless saves to a default slot.
 */
export interface WorkspacePersistenceAdapter {
  load(scope: PanelScope): Promise<JsonObject | null>;
  save(scope: PanelScope | null, snapshot: JsonObject): Promise<void>;
}

export interface CreateCanvasHostOptions {
  engine: EngineHandle;
  persistence?: WorkspacePersistenceAdapter;
}

export interface CanvasHost {
  /** Resolves once the engine reports readiness, then stays resolved. */
  whenReady(): Promise<void>;
  /**
   * Resolves once the restore question for `scope` is settled: the engine
   * became ready, the persistence adapter was consulted, and any stored
   * snapshot was imported. The first call per scope starts the restore;
   * repeat calls share its promise, so the adapter loads each scope once.
   * Resolves without touching the engine when no adapter is configured or
   * nothing was stored. A failed load or import is logged and still
   * settles, leaving the workspace usable on a blank canvas.
   */
  whenRestoreSettled(scope: PanelScope): Promise<void>;
  /**
   * Stops observing engine changes and flushes any scheduled save.
   * Lifecycle promises already handed out settle on their own terms;
   * restores that have not reached the engine yet are abandoned.
   */
  dispose(): void;
}

/** Matches the debounce the whiteboard snapshot sync used before the host owned saving. */
const SAVE_DEBOUNCE_MS = 1200;

function scopeKey(scope: PanelScope): string {
  return JSON.stringify([scope.contextId ?? null, scope.entityId ?? null]);
}

export function createCanvasHost(options: CreateCanvasHostOptions): CanvasHost {
  const { engine, persistence } = options;

  const ready = new Promise<void>((resolve) => {
    if (engine.isReady()) {
      resolve();
      return;
    }
    const off = engine.on('ready', () => {
      off();
      resolve();
    });
  });

  const restores = new Map<string, Promise<void>>();
  const pendingRestores = new Set<Promise<void>>();
  let activeScope: PanelScope | null = null;
  let disposed = false;

  const runRestore = async (scope: PanelScope): Promise<void> => {
    await ready;
    if (disposed || !persistence) return;
    try {
      const snapshot = await persistence.load(scope);
      if (snapshot !== null && !disposed) {
        engine.importSnapshot(snapshot);
      }
    } catch (err) {
      console.error('[canvasHost] workspace restore failed', scope, err);
    }
  };

  const whenRestoreSettled = (scope: PanelScope): Promise<void> => {
    const frozen: PanelScope = { contextId: scope.contextId, entityId: scope.entityId };
    activeScope = frozen;
    const key = scopeKey(frozen);
    const existing = restores.get(key);
    if (existing) return existing;
    const restore = runRestore(frozen);
    restores.set(key, restore);
    pendingRestores.add(restore);
    void restore.then(() => {
      pendingRestores.delete(restore);
    });
    return restore;
  };

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let saveChain: Promise<void> = Promise.resolve();

  const flushSave = (): void => {
    saveTimer = null;
    if (!persistence) return;
    saveChain = saveChain.then(async () => {
      // Never persist over a workspace whose restore is still in flight;
      // drain until quiescent because a scope switch can start another
      // restore during the wait, and exporting before that one settles
      // would save the previous scope's canvas under the new scope's key.
      while (pendingRestores.size > 0) {
        await Promise.all([...pendingRestores]);
      }
      const scope = activeScope;
      try {
        const snapshot = engine.exportSnapshot();
        await persistence.save(scope, snapshot);
      } catch (err) {
        console.error('[canvasHost] workspace save failed', scope, err);
      }
    });
  };

  const scheduleSave = (): void => {
    if (disposed) return;
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
  };

  const offChange = persistence ? engine.on('change', scheduleSave) : null;

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    offChange?.();
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      flushSave();
    }
  };

  return {
    whenReady: () => ready,
    whenRestoreSettled,
    dispose,
  };
}
