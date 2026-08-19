/**
 * The tldraw implementation of the canvas engine SPI (src/engine/types).
 * A thin adapter over the existing whiteboard internals: panel
 * shapes go through `panelShapeApi` (the single entry point agent tools
 * already use), snapshots ride the editor's native snapshot support, and
 * camera ops map onto tldraw camera options.
 *
 * Binding model: `WhiteboardShell` owns the editor lifecycle and calls
 * `panelShapeApi.bindEditor` on mount. Consumers attach the same editor
 * to a handle via `attachEditor` (or `tryAttachBoundEditor` to pick up
 * an already bound one). Panel opening and layout import queue through
 * `panelShapeApi` while unbound, so requests are never dropped; geometry
 * and camera reads require attachment.
 */
import type { Editor, HistoryEntry, TLRecord, TLShapeId, TLShapePartial } from 'tldraw';
import { createShapeId } from 'tldraw';
import type {
  CameraState,
  CanvasMode,
  EngineCapabilities,
  EngineEventMap,
  EngineHandle,
  EnginePanelPlacement,
  PanelInstanceId,
  PlaceOptions,
  Rect,
  ViewportInfo,
  WorkspaceLayoutRecord,
} from '../../engine/types';
import type { JsonObject } from '../../panels/types';
import { isPanelPinned, readPanelOrigin } from '../../panels/provenance';
import type { DigestShapeSlice } from '../../agents/engineBridge';
import { clampCameraForMode, DEFAULT_CANVAS_MODE } from './canvasMode';
import {
  closePanelInCanvas,
  getEditor,
  loadWhiteboardSnapshot,
  openPanelInCanvas,
} from './shapes/panelShapeApi';
import { getDigestShapeSlice as getBoundDigestShapeSlice } from './digest/digestShapeBridge';

/** How long the camera must hold still before `camera:settled` fires. */
const CAMERA_SETTLE_MS = 200;

export interface WhiteboardEngineHandle extends EngineHandle {
  /**
   * Bind a mounted tldraw editor. Fires `ready` once and starts change
   * observation. Returns a detach function that unbinds this editor and
   * clears all listeners.
   */
  attachEditor(editor: Editor): () => void;
  /** Attach the editor already bound in `panelShapeApi`, when there is one. */
  tryAttachBoundEditor(): boolean;
  /**
   * Digest shape slice summarizing canvas marks on the bound editor.
   * Null before an editor is attached. The DOM workspace
   * engine implements the same method and always returns null, since it
   * declares `capabilities.draw: false` and hosts no canvas shapes.
   */
  getDigestShapeSlice(): DigestShapeSlice | null;
}

interface PanelShapeProps {
  w: number;
  h: number;
  panelId: string;
  minimized: boolean;
  data: Record<string, unknown>;
}

/**
 * Structural view of a panel shape record. The repo does not augment
 * tldraw's global shape map with the custom `panel` type (intersecting
 * with the `TLShape` union collapses to never), so recognition returns
 * this shape through a widening cast instead of a type predicate.
 */
interface PanelShapeRecord {
  typeName: 'shape';
  id: TLShapeId;
  type: 'panel';
  x: number;
  y: number;
  index: string;
  props: PanelShapeProps;
}

function asPanelShape(record: unknown): PanelShapeRecord | null {
  if (!record || typeof record !== 'object') return null;
  const candidate = record as { typeName?: unknown; type?: unknown };
  if (candidate.typeName !== 'shape' || candidate.type !== 'panel') return null;
  return record as PanelShapeRecord;
}

function panelShapeId(id: PanelInstanceId): TLShapeId {
  return createShapeId(`panel:${id}`);
}

function shapeRect(shape: PanelShapeRecord): Rect {
  return { x: shape.x, y: shape.y, w: shape.props.w, h: shape.props.h };
}

/** UI zoom menu steps when wheel/pinch zoom is locked (bounded career embeds). */
export const WHITEBOARD_UI_ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/** Applies tldraw camera options for the SPI canvas mode contract. */
export function applyCanvasModeToEditor(editor: Editor, mode: CanvasMode): void {
  switch (mode.kind) {
    case 'infinite':
      editor.setCameraOptions({
        isLocked: false,
        wheelBehavior: 'pan',
        constraints: undefined,
      });
      return;
    case 'fixed':
      editor.setCameraOptions({ isLocked: true });
      return;
    case 'bounded': {
      const zoom = mode.zoom;
      const zoomOptions =
        zoom === 'locked'
          ? {
              wheelBehavior: 'pan' as const,
              // Lock wheel/pinch only — bottom-left zoom control stays usable.
              zoomSteps: [...WHITEBOARD_UI_ZOOM_STEPS],
            }: zoom !== undefined
            ? { wheelBehavior: 'zoom' as const, zoomSteps: buildZoomSteps(zoom) }: { wheelBehavior: 'zoom' as const };
      editor.setCameraOptions({
        isLocked: false,...zoomOptions,
        constraints: {
          bounds: { x: 0, y: 0, w: mode.bounds.w, h: mode.bounds.h },
          behavior: mode.behavior ?? 'contain',
          padding: { x: 0, y: 0 },
          origin: { x: 0.5, y: 0.5 },
          initialZoom: 'fit-max-100',
          baseZoom: 'default',
        },
      });
      return;
    }
  }
}

function buildZoomSteps(range: { min: number; max: number }): number[] {
  const steps = [range.min, range.max];
  if (range.min < 1 && range.max > 1) {
    steps.splice(1, 0, 1);
  }
  return steps;
}

type ListenerSets = {
  [E in keyof EngineEventMap]: Set<(payload: EngineEventMap[E]) => void>;
};

function createListenerSets(): ListenerSets {
  return {
    ready: new Set(),
    change: new Set(),
    'panel:moved': new Set(),
    'panel:resized': new Set(),
    'panel:removed': new Set(),
    'selection:changed': new Set(),
    'camera:settled': new Set(),
  };
}

/** tldraw has every optional engine feature; the flags are all true. */
export const WHITEBOARD_ENGINE_CAPABILITIES: EngineCapabilities = {
  frames: true,
  draw: true,
  minimap: true,
  infinitePan: true,
  nativeSnapshots: true,
};

export interface CreateWhiteboardEngineOptions {
  /** When false, agent draw/perception tools refuse (career concierge canvases). Default: true. */
  drawingEnabled?: boolean;
}

export function createWhiteboardEngine(
  options: CreateWhiteboardEngineOptions = {}): WhiteboardEngineHandle {
  const drawingEnabled = options.drawingEnabled !== false;
  const capabilities: EngineCapabilities = {...WHITEBOARD_ENGINE_CAPABILITIES,
    draw: drawingEnabled,
  };
  let editor: Editor | null = null;
  let currentMode: CanvasMode = DEFAULT_CANVAS_MODE;
  let ready = false;
  let suppressChange = false;
  let storeUnsubscribe: (() => void) | undefined;
  let cameraSettleTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = createListenerSets();

  const emit = <E extends keyof EngineEventMap>(
    event: E,
    payload: EngineEventMap[E]): void => {
    for (const listener of [...listeners[event]]) {
      listener(payload);
    }
  };

  const requireEditor = (operation: string): Editor => {
    if (!editor) {
      throw new Error(`[whiteboardEngine] ${operation} requires an attached editor`);
    }
    return editor;
  };

  const readCamera = (bound: Editor): CameraState => {
    const camera = bound.getCamera();
    return { x: camera.x, y: camera.y, zoom: camera.z };
  };

  const scheduleCameraSettle = (bound: Editor): void => {
    if (cameraSettleTimer !== null) {
      clearTimeout(cameraSettleTimer);
    }
    cameraSettleTimer = setTimeout(() => {
      cameraSettleTimer = null;
      emit('camera:settled', { camera: readCamera(bound) });
    }, CAMERA_SETTLE_MS);
  };

  const selectedPanelIds = (bound: Editor, shapeIds: readonly string[]): PanelInstanceId[] => {
    const ids: PanelInstanceId[] = [];
    for (const shapeId of shapeIds) {
      const panel = asPanelShape(bound.getShape(shapeId as TLShapeId));
      if (panel) {
        ids.push(panel.props.panelId);
      }
    }
    return ids;
  };

  const handleStoreEntry = (
    bound: Editor,
    changes: HistoryEntry<TLRecord>['changes']): void => {
    for (const [prev, next] of Object.values(changes.updated)) {
      const nextPanel = asPanelShape(next);
      const prevPanel = asPanelShape(prev);
      if (nextPanel && prevPanel) {
        const rect = shapeRect(nextPanel);
        if (prevPanel.x !== nextPanel.x || prevPanel.y !== nextPanel.y) {
          emit('panel:moved', { id: nextPanel.props.panelId, rect });
        }
        if (
          prevPanel.props.w !== nextPanel.props.w ||
          prevPanel.props.h !== nextPanel.props.h
        ) {
          emit('panel:resized', { id: nextPanel.props.panelId, rect });
        }
        continue;
      }
      if (next.typeName === 'camera') {
        scheduleCameraSettle(bound);
        continue;
      }
      if (next.typeName === 'instance_page_state' && prev.typeName === 'instance_page_state') {
        const prevIds = prev.selectedShapeIds;
        const nextIds = next.selectedShapeIds;
        const sameSelection =
          prevIds.length === nextIds.length &&
          prevIds.every((id, index) => id === nextIds[index]);
        if (!sameSelection) {
          emit('selection:changed', { ids: selectedPanelIds(bound, nextIds) });
        }
      }
    }
    for (const removed of Object.values(changes.removed)) {
      const removedPanel = asPanelShape(removed);
      if (removedPanel) {
        emit('panel:removed', { id: removedPanel.props.panelId });
      }
    }
  };

  const detach = (bound: Editor): void => {
    if (editor !== bound) return;
    storeUnsubscribe?.();
    storeUnsubscribe = undefined;
    if (cameraSettleTimer !== null) {
      clearTimeout(cameraSettleTimer);
      cameraSettleTimer = null;
    }
    editor = null;
    ready = false;
    for (const set of Object.values(listeners)) {
      set.clear();
    }
  };

  const attachEditor = (bound: Editor): (() => void) => {
    if (editor === bound) {
      return () => detach(bound);
    }
    storeUnsubscribe?.();
    editor = bound;
    if (!ready) {
      ready = true;
      emit('ready', undefined);
    }
    storeUnsubscribe = bound.store.listen(
      (entry) => {
        if (!suppressChange) {
          emit('change', undefined);
        }
        handleStoreEntry(bound, entry.changes);
      },
      { source: 'user', scope: 'all' });
    return () => detach(bound);
  };

  return {
    isReady: () => ready,

    on<E extends keyof EngineEventMap>(
      event: E,
      listener: (payload: EngineEventMap[E]) => void): () => void {
      listeners[event].add(listener);
      return () => {
        listeners[event].delete(listener);
      };
    },

    exportSnapshot(): JsonObject {
      if (!editor) return {};
      return editor.getSnapshot() as unknown as JsonObject;
    },

    importSnapshot(snapshot: JsonObject): void {
      suppressChange = true;
      try {
        loadWhiteboardSnapshot(snapshot);
      } finally {
        suppressChange = false;
      }
    },

    getDigestShapeSlice(): DigestShapeSlice | null {
      return getBoundDigestShapeSlice();
    },

    openPanel(request: EnginePanelPlacement): void {
      openPanelInCanvas(request.panelId, {
        focus: request.focus,
        position: request.position,
        size: request.size,
        panelProps: request.data,
        chrome: request.chrome,
      });
    },

    placePanel(id: PanelInstanceId, rect: Rect, opts?: PlaceOptions): void {
      openPanelInCanvas(id, {
        position: { x: rect.x, y: rect.y },
        size: { w: rect.w, h: rect.h },
        focus: opts?.focus ?? false,
        snapGrid: opts?.snapGrid ?? false,
      });
    },

    resizePanel(id: PanelInstanceId, rect: Rect): void {
      const bound = requireEditor('resizePanel');
      const shapeId = panelShapeId(id);
      if (!asPanelShape(bound.getShape(shapeId))) return;
      // The repo does not augment tldraw's shape map with the custom
      // `panel` type, so the partial widens past the default union, the
      // same convention panelShapeApi uses for panel shape writes.
      const partial = {
        id: shapeId,
        type: 'panel',
        x: rect.x,
        y: rect.y,
        props: { w: rect.w, h: rect.h },
      };
      bound.updateShape(partial as unknown as TLShapePartial);
    },

    removePanel(id: PanelInstanceId): void {
      closePanelInCanvas(id);
    },

    setZOrder(id: PanelInstanceId, z: 'front' | 'back' | number): void {
      const bound = requireEditor('setZOrder');
      const shapeId = panelShapeId(id);
      if (!bound.getShape(shapeId)) return;
      if (z === 'front') {
        bound.bringToFront([shapeId]);
        return;
      }
      if (z === 'back') {
        bound.sendToBack([shapeId]);
        return;
      }
      // Numeric z is a stacking position among panel shapes, back to
      // front. Extremes map to the native reorder ops; interior targets
      // stack above the panel currently occupying the slot below.
      const panels = bound.getCurrentPageShapes().map(asPanelShape).filter((panel): panel is PanelShapeRecord => panel !== null).filter((panel) => panel.id !== shapeId).sort((a, b) => (a.index < b.index ? -1: a.index > b.index ? 1: 0));
      const slot = Math.max(0, Math.min(Math.trunc(z), panels.length));
      if (slot === 0) {
        bound.sendToBack([shapeId]);
        return;
      }
      bound.sendToBack([shapeId]);
      for (let step = 0; step < slot; step += 1) {
        bound.bringForward([shapeId]);
      }
    },

    getCamera(): CameraState {
      return readCamera(requireEditor('getCamera'));
    },

    setCamera(state: CameraState, opts?: { animate?: boolean }): void {
      if (currentMode.kind === 'fixed') {
        return;
      }
      const bound = requireEditor('setCamera');
      const viewport = bound.getViewportScreenBounds();
      const clamped = clampCameraForMode(currentMode, state, {
        w: viewport.w,
        h: viewport.h,
      });
      bound.setCamera(
        { x: clamped.x, y: clamped.y, z: clamped.zoom },
        opts?.animate ? { animation: { duration: 350 } }: undefined);
    },

    setMode(mode: CanvasMode): void {
      currentMode = mode;
      applyCanvasModeToEditor(requireEditor('setMode'), mode);
    },

    zoomTo(rect: Rect, opts?: { inset?: number }): void {
      const bound = requireEditor('zoomTo');
      bound.zoomToBounds(rect, {...(opts?.inset !== undefined ? { inset: opts.inset }: {}),
        animation: { duration: 350 },
      });
    },

    exportLayout(): WorkspaceLayoutRecord[] {
      if (!editor) return [];
      const records: WorkspaceLayoutRecord[] = [];
      for (const shape of editor.getCurrentPageShapes()) {
        const panel = asPanelShape(shape);
        if (!panel) continue;
        const data = panel.props.data;
        const contextRef = data.contextRef;
        records.push({
          panelId: panel.props.panelId,
          contextId: typeof contextRef === 'string' ? contextRef: null,
          position: { x: panel.x, y: panel.y },
          size: { w: panel.props.w, h: panel.props.h },
          pinned: isPanelPinned(data),
          origin: readPanelOrigin(data),
        });
      }
      return records;
    },

    importLayout(records: WorkspaceLayoutRecord[]): void {
      for (const record of records) {
        openPanelInCanvas(record.panelId, {
          position: record.position,
          size: record.size,
          focus: false,
          snapGrid: false,
          assignToSiteGroup: false,
          panelProps: {...(record.contextId !== null ? { contextRef: record.contextId }: {}),...(record.origin === 'agent' ? { origin: 'agent' }: {}),
          },
        });
      }
    },

    getViewportInfo(): ViewportInfo {
      const bound = requireEditor('getViewportInfo');
      const viewport = bound.getViewportPageBounds();
      const panelVisibility: Record<PanelInstanceId, number> = {};
      for (const shape of bound.getCurrentPageShapes()) {
        const panel = asPanelShape(shape);
        if (!panel) continue;
        const bounds = bound.getShapePageBounds(panel.id);
        if (!bounds) continue;
        const overlapW = Math.max(
          0,
          Math.min(bounds.x + bounds.w, viewport.x + viewport.w) -
            Math.max(bounds.x, viewport.x));
        const overlapH = Math.max(
          0,
          Math.min(bounds.y + bounds.h, viewport.y + viewport.h) -
            Math.max(bounds.y, viewport.y));
        const area = bounds.w * bounds.h;
        panelVisibility[panel.props.panelId] =
          area > 0 ? (overlapW * overlapH) / area: 0;
      }
      return {
        visibleRect: { x: viewport.x, y: viewport.y, w: viewport.w, h: viewport.h },
        zoom: bound.getZoomLevel(),
        panelVisibility,
      };
    },

    capabilities,

    destroy(): void {
      if (editor) {
        detach(editor);
        return;
      }
      for (const set of Object.values(listeners)) {
        set.clear();
      }
    },

    attachEditor,

    tryAttachBoundEditor(): boolean {
      const bound = getEditor();
      if (!bound) return false;
      attachEditor(bound);
      return true;
    },
  };
}
