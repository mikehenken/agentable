/**
 * createCanvasHost: the panel system's runtime entry point. The host owns
 * lifecycle (readiness, workspace restore), the persistence seam, the
 * panel registry, and the shared data store (`host.data`), and drives the
 * canvas exclusively through an engine handle, so nothing in this module
 * knows which engine implementation is mounted.
 */
import type { EngineLifecycleHandle } from '../engine/types';
import { emitAgUiStatePatch } from '../canvas/protocol/ag-ui';
import { createPanelRegistry, type PanelRegistry } from './registry';
import { registerHostActions, type ToolDefinition } from './tools';
import { createDataLifecycle } from './renderer/dataLifecycle';
import type { DataAdapter, DataLifecycle } from './renderer/types';
import type {
  CatalogEntry,
  JsonObject,
  PanelChromeOptions,
  PanelDefinition,
  PanelScope,
} from './types';
import { defaultCatalog } from './spec';

/**
 * The engine contract now lives in src/engine (panel system spec section
 * 14, D37). The host consumes the lifecycle slice; these re-exports keep
 * the established public names for existing consumers, `EngineHandle`
 * here being the slice `createCanvasHost` requires rather than the full
 * SPI handle of the same name in src/engine.
 */
export type { EngineLifecycleEvent } from '../engine/types';
export type { EngineLifecycleHandle as EngineHandle } from '../engine/types';

/** Caller-facing options for `host.panels.open`. */
export interface PanelOpenOptions {
  /** Host-defined scope the panel instance binds to. */
  scope?: PanelScope;
  /** Typed chrome options, replacing the reserved `__*` data keys. */
  chrome?: PanelChromeOptions;
  /** Instance data, persisted with the panel container. JSON only. */
  data?: JsonObject;
  /** Override the engine's default placement. */
  position?: { x: number; y: number };
  /** Override the panel's default size. */
  size?: { w: number; h: number };
  /** Move the camera to reveal the panel after placing it. */
  focus?: boolean;
}

/** What the engine receives when the host opens a panel. */
export interface PanelOpenRequest extends PanelOpenOptions {
  panelId: string;
}

/** Registry access plus the open entry point, exposed as `host.panels`. */
export interface CanvasHostPanels extends PanelRegistry {
  /**
   * Open a registered panel. Rejects for ids missing from the registry,
   * for hosts already disposed, and for engines without panel placement;
   * otherwise waits for engine readiness and resolves once the engine
   * has accepted the placement request. The typed `PanelHandle` facade
   * from the panel system spec arrives with the panel handle work.
   */
  open(id: string, options?: PanelOpenOptions): Promise<void>;
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
  /**
   * Any engine exposing the lifecycle slice. Full SPI engines (the
   * `EngineHandle` from src/engine) satisfy this structurally.
   */
  engine: EngineLifecycleHandle;
  persistence?: WorkspacePersistenceAdapter;
  /**
   * Host `DataAdapter` for panel source bindings. When provided, the host
   * owns one shared `createDataLifecycle` store exposed as
   * `host.data.lifecycle`. Omit for hosts that do not yet mount
   * schema-panel data (panel open / restore still work).
   */
  adapter?: DataAdapter;
  /**
   * Panels available on this host. `kind: 'react'` definitions wrap the
   * loader shape shells register today (`reactPanelDefinitions` converts
   * an existing loader map). On id collision the later definition wins.
   */
  panels?: readonly PanelDefinition[];
  /**
   * Host-supplied agent tools, merged into the shared tool registry for
   * this host's lifetime and removed again on `dispose`. A host action
   * sharing a built-in tool's name replaces that tool (see panels/tools
   * for the full collision policy).
   */
  hostActions?: readonly ToolDefinition[];
  /**
   * Host-supplied catalog overrides or additions. If not provided,
   * the host will use the default v1 catalog under the hood.
   */
  catalog?: ReadonlyMap<string, CatalogEntry>;
}

/**
 * Framework-owned data seam on the host (02 section 8). `invalidate`
 * clears matching cache entries, refetches every mounted consumer of
 * that source, and emits an AG-UI state patch so host bridges and agent
 * sessions learn about the change without bespoke refreshKey bridges.
 */
export interface CanvasHostData {
  /**
   * Shared per-host data lifecycle. Non-null when `createCanvasHost`
   * received an `adapter`. SpecRenderer and other consumers acquire
   * bindings from this store so invalidate fans out across them.
   */
  readonly lifecycle: DataLifecycle | null;
  /**
   * Clear matching cache entries and refetch every mounted binding for
   * `source`. Always emits an AG-UI `/data/<source>` patch (source:
   * `host`), including when no adapter was configured.
   */
  invalidate(source: string, scope?: PanelScope): void;
}

export interface CanvasHost {
  /**
   * The resolved catalog instance in use.
   */
  catalog: ReadonlyMap<string, CatalogEntry>;
  panels: CanvasHostPanels;
  /** Data lifecycle + invalidate (02 section 8, P1-T5). */
  data: CanvasHostData;
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
   * Removes this host's actions from the tool registry, disposes the data
   * lifecycle, stops observing engine changes, and flushes any scheduled
   * save. Lifecycle promises already handed out settle on their own
   * terms; restores that have not reached the engine yet are abandoned.
   */
  dispose(): void;
}

/** AG-UI path prefix for data-source invalidation announcements. */
export const AG_UI_DATA_INVALIDATE_PATH_PREFIX = '/data/';

function emitDataInvalidatePatch(source: string, scope?: PanelScope): void {
  const value: JsonObject = {
    invalidatedAt: new Date().toISOString(),
  };
  if (scope !== undefined) {
    const scoped: JsonObject = {};
    if (scope.contextId !== undefined) scoped.contextId = scope.contextId;
    if (scope.entityId !== undefined) scoped.entityId = scope.entityId;
    value.scope = scoped;
  }
  emitAgUiStatePatch(
    [{ op: 'replace', path: `${AG_UI_DATA_INVALIDATE_PATH_PREFIX}${source}`, value }],
    { source: 'host' },
  );
}


/** Matches the debounce the whiteboard snapshot sync used before the host owned saving. */
const SAVE_DEBOUNCE_MS = 1200;

function scopeKey(scope: PanelScope): string {
  return JSON.stringify([scope.contextId ?? null, scope.entityId ?? null]);
}

export function createCanvasHost(options: CreateCanvasHostOptions): CanvasHost {
  const { engine, persistence } = options;
  const catalog = options.catalog ?? defaultCatalog;
  const registry = createPanelRegistry(options.panels ?? []);
  const unregisterHostActions = options.hostActions?.length
    ? registerHostActions(options.hostActions)
    : null;
  let disposed = false;

  const dataLifecycle: DataLifecycle | null =
    options.adapter !== undefined
      ? createDataLifecycle({
          adapter: options.adapter,
          onInvalidate: emitDataInvalidatePatch,
        })
      : null;

  const data: CanvasHostData = {
    lifecycle: dataLifecycle,
    invalidate(source: string, scope?: PanelScope): void {
      if (disposed) return;
      if (dataLifecycle !== null) {
        dataLifecycle.invalidate(source, scope);
        return;
      }
      emitDataInvalidatePatch(source, scope);
    },
  };

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
    unregisterHostActions?.();
    dataLifecycle?.dispose();
    offChange?.();
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      flushSave();
    }
  };

  const openPanel = async (
    id: string,
    openOptions: PanelOpenOptions = {},
  ): Promise<void> => {
    if (!registry.has(id)) {
      throw new Error(`no panel registered for id "${id}"`);
    }
    await ready;
    if (disposed) {
      throw new Error(`host disposed before panel "${id}" could open`);
    }
    if (!engine.openPanel) {
      throw new Error('engine does not implement panel placement');
    }
    engine.openPanel({ panelId: id, ...openOptions });
  };

  return {
    catalog,
    panels: {
      open: openPanel,
      has: registry.has,
      get: registry.get,
      ids: registry.ids,
      definitions: registry.definitions,
    },
    data,
    whenReady: () => ready,
    whenRestoreSettled,
    dispose,
  };
}
