/**
 * createCanvasHost: the panel system's runtime entry point. The host owns
 * lifecycle (readiness, workspace restore), the persistence seam, and the
 * panel registry, and drives the canvas exclusively through an engine
 * handle, so nothing in this module knows which engine implementation is
 * mounted.
 */
import { createPanelRegistry, type PanelRegistry } from './registry';
import { registerHostActions, type ToolDefinition } from './tools';
import type {
  JsonObject,
  PanelChromeOptions,
  PanelDefinition,
  PanelScope,
} from './types';

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
  /**
   * Place a registered panel on the canvas, creating its container or
   * refocusing an existing one. Optional because not every engine hosts
   * panel containers; `host.panels.open` rejects on engines without it
   * rather than dropping the request silently.
   */
  openPanel?(request: PanelOpenRequest): void;
}

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
  engine: EngineHandle;
  persistence?: WorkspacePersistenceAdapter;
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
}

export interface CanvasHost {
  /** Registered panels: lookup plus the open entry point. */
  panels: CanvasHostPanels;
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
   * Removes this host's actions from the tool registry, stops observing
   * engine changes, and flushes any scheduled save. Lifecycle promises
   * already handed out settle on their own terms; restores that have not
   * reached the engine yet are abandoned.
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
  const registry = createPanelRegistry(options.panels ?? []);
  const unregisterHostActions = options.hostActions?.length
    ? registerHostActions(options.hostActions)
    : null;

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
    unregisterHostActions?.();
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
    panels: {
      open: openPanel,
      has: registry.has,
      get: registry.get,
      ids: registry.ids,
      definitions: registry.definitions,
    },
    whenReady: () => ready,
    whenRestoreSettled,
    dispose,
  };
}
