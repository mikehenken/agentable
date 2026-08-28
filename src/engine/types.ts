/**
 * Canvas engine SPI (panel system spec section 14, decisions).
 *
 * The contract every drawing engine implements for the panel framework:
 * mounting, lifecycle signals, panel container geometry, camera control,
 * engine-neutral workspace layout export/import, viewport info for the
 * digest, and capability flags for engine-only features. Everything above
 * the engine (host, panels runtime, tools, chrome) consumes these types
 * and speaks plain data; no engine-specific type (tldraw or otherwise)
 * appears here. The tldraw implementation lives in src/engines/tldraw/, the
 * only directory allowed to import tldraw (CI-enforced boundary rule).
 *
 * This module is types-only by design: it must be importable from any
 * layer without pulling engine code into the bundle.
 */
import type {
  JsonObject,
  PanelChromeOptions,
  PanelScope,
  SpecOrigin,
} from '../panels/types';

/**
 * Identifies one mounted panel instance on the engine surface. The v1
 * whiteboard engine keys instances by panel definition id (one instance
 * per id); engines with multi-instance support mint unique ids.
 */
export type PanelInstanceId = string;

/** Axis-aligned rectangle in engine page coordinates. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Engine-neutral camera state. `zoom` is a scale factor where 1 is 100%. */
export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Camera behavior contract (spec section 9). `infinite` is the
 * default free canvas; `bounded` constrains the camera to a fixed page
 * area; `fixed` disables pan and zoom entirely while panels inside stay
 * interactive.
 */
export type CanvasMode =
  | { kind: 'infinite' }
  | {
      kind: 'bounded';
      bounds: { w: number; h: number };
      behavior?: 'contain' | 'inside';
      zoom?: { min: number; max: number } | 'locked';
      showEdge?: boolean;
    }
  | { kind: 'fixed' };

/** Options for `EngineHandle.placePanel`. */
export interface PlaceOptions {
  /** Move the camera to reveal the placed panel. Defaults to false. */
  focus?: boolean;
  /**
   * Snap the rect to the engine's layout grid. Defaults to false because
   * placement math above the engine hands over final coordinates.
   */
  snapGrid?: boolean;
}

/**
 * Digest input describing what the user currently sees: the visible page
 * rect, the zoom level, and per-panel visibility as the fraction of each
 * panel's area inside the viewport (0 fully offscreen, 1 fully visible).
 */
export interface ViewportInfo {
  visibleRect: Rect;
  zoom: number;
  panelVisibility: Record<PanelInstanceId, number>;
}

/**
 * Lifecycle signals the host consumes. `ready` fires once per handle when
 * the underlying editor is bound and can accept commands. `change`
 * reports user-driven content or layout mutations and never fires before
 * `ready`; programmatic writes such as a snapshot import must not emit
 * it, otherwise every restore would immediately persist itself back.
 */
export type EngineLifecycleEvent = 'ready' | 'change';

/**
 * Every event an engine can emit, keyed by name with its payload type.
 * Lifecycle events carry no payload; the remaining events report
 * user-driven panel geometry changes, selection, and camera settle.
 */
export interface EngineEventMap {
  ready: void;
  change: void;
  'panel:moved': { id: PanelInstanceId; rect: Rect };
  'panel:resized': { id: PanelInstanceId; rect: Rect };
  'panel:removed': { id: PanelInstanceId };
  'selection:changed': { ids: PanelInstanceId[] };
  'camera:settled': { camera: CameraState };
}

/**
 * Flags for engine-only features. Hosts and packs gate on these and must
 * degrade sensibly when a flag is false; nothing above the SPI may assume
 * a capability ( ).
 */
export interface EngineCapabilities {
  /** Context frames that group panels and move together. */
  frames: boolean;
  /** Freehand drawing and annotation on the surface. */
  draw: boolean;
  /** A minimap of the workspace. */
  minimap: boolean;
  /** Unbounded panning in infinite mode. */
  infinitePan: boolean;
  /**
   * A native snapshot format richer than layout records (for the tldraw
   * engine: drawings, frames, camera). When false, workspace restore
   * relies on layout records alone.
   */
  nativeSnapshots: boolean;
}

/**
 * Engine-neutral record of one panel's placement, written on every layout
 * change alongside whatever native snapshot the engine keeps. Restoring a
 * workspace needs only these records plus panel definitions; the native
 * snapshot is an enhancement, never the sole source of truth.
 */
export interface WorkspaceLayoutRecord {
  /** Panel definition id this placement belongs to. */
  panelId: string;
  /** Context frame or workspace context the panel sits in, when any. */
  contextId: string | null;
  /** Dock or grid position in engine page coordinates. */
  position: { x: number; y: number };
  size: { w: number; h: number };
  /** Whether the user pinned the panel against auto-arrange. */
  pinned: boolean;
  /** Who placed the panel: the host (including user actions) or an agent. */
  origin: SpecOrigin;
}

/**
 * What an engine receives when the host opens a panel by id and lets the
 * engine compute placement. Mirrors the host's `PanelOpenRequest`; the
 * host call site enforces the alignment at compile time.
 */
export interface EnginePanelPlacement {
  panelId: string;
  scope?: PanelScope;
  chrome?: PanelChromeOptions;
  data?: JsonObject;
  position?: { x: number; y: number };
  size?: { w: number; h: number };
  focus?: boolean;
}

/**
 * The minimal engine surface `createCanvasHost` needs: readiness, change
 * observation, native snapshot transport, and optional panel opening.
 * Full engines implement `EngineHandle`; hosts embedding a custom surface
 * may implement just this slice.
 */
export interface EngineLifecycleHandle {
  /** True once the underlying editor is bound. */
  isReady(): boolean;
  /** Subscribe to a lifecycle event. Returns an unsubscribe function. */
  on(event: EngineLifecycleEvent, listener: () => void): () => void;
  /** Serialize the engine's native workspace snapshot for persistence. */
  exportSnapshot(): JsonObject;
  /** Load a previously persisted native snapshot onto the bound editor. */
  importSnapshot(snapshot: JsonObject): void;
  /**
   * Place a registered panel on the surface, creating its container or
   * refocusing an existing one. Optional because not every engine hosts
   * panel containers; `host.panels.open` rejects on engines without it
   * rather than dropping the request silently.
   */
  openPanel?(request: EnginePanelPlacement): void;
}

/**
 * The full engine SPI. The engine draws panel containers and reports
 * geometry; layout math above the SPI computes placement and the engine
 * applies it. tldraw types appear in no part of this contract.
 */
export interface EngineHandle extends EngineLifecycleHandle {
  /** Subscribe to any engine event. Returns an unsubscribe function. */
  on<E extends keyof EngineEventMap>(
    event: E,
    listener: (payload: EngineEventMap[E]) => void): () => void;

  placePanel(id: PanelInstanceId, rect: Rect, opts?: PlaceOptions): void;
  resizePanel(id: PanelInstanceId, rect: Rect): void;
  removePanel(id: PanelInstanceId): void;
  setZOrder(id: PanelInstanceId, z: 'front' | 'back' | number): void;

  getCamera(): CameraState;
  setCamera(state: CameraState, opts?: { animate?: boolean }): void;
  setMode(mode: CanvasMode): void;
  zoomTo(rect: Rect, opts?: { inset?: number }): void;

  exportLayout(): WorkspaceLayoutRecord[];
  importLayout(records: WorkspaceLayoutRecord[]): void;

  getViewportInfo(): ViewportInfo;

  capabilities: EngineCapabilities;
  destroy(): void;
}

/** Options an engine receives at mount time. */
export interface EngineMountOptions {
  /** Initial camera behavior. Defaults to `{ kind: 'infinite' }`. */
  mode?: CanvasMode;
}

/**
 * An installable engine: mounts onto a container element and returns the
 * live handle. Engines whose rendering is owned by a component tree (the
 * v1 tldraw engine mounts through React) expose a handle factory instead
 * and bind the editor when their component mounts.
 */
export interface CanvasEngine {
  mount(container: HTMLElement, opts?: EngineMountOptions): EngineHandle;
}
