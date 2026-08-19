/**
 * DOM workspace engine SPI implementation.
 *
 * Second canvas engine alongside tldraw: `camera: none` (fixed viewport),
 * CSS grid/flex regions with react-resizable-panels splits, tab strips per
 * region, and sidebar drawer collapse at responsive breakpoints.
 */
import type {
  CameraState,
  CanvasMode,
  EngineCapabilities,
  EngineEventMap,
  EngineHandle,
  EngineMountOptions,
  EnginePanelPlacement,
  PanelInstanceId,
  PlaceOptions,
  Rect,
  ViewportInfo,
  WorkspaceLayoutRecord,
} from '../../engine/types';
import type { JsonObject } from '../../panels/types';
import {
  DEFAULT_PANEL_SIZE,
  domPanelRecordToJson,
  domRegionFromEnginePlacement,
  exportLayoutFromSnapshot,
  importLayoutIntoSnapshot,
  panelDataFromRequest,
  snapshotFromNativeExport,
} from './layoutCodec';
import { computeDomPanelVisibilityRatio, buildDomDigestCompilerInput } from './digestAttention';
import { BrowserAttentionSignalController } from './browserAttentionSignalController';
import {
  createEmptyDomLayoutSnapshot,
  layoutXFromRegionId,
  type DomLayoutSnapshot,
  type DomPanelRecord,
  type DomRegionId,
} from './types';
import type { DigestCompilerInput, DigestUser } from '../../agents/digest';
import type { DigestShapeSlice } from '../../agents/engineBridge';
import type { ReactiveControllerHost } from '@lit/reactive-element/reactive-controller.js';

/** Fixed camera for engines with no pan/zoom surface (camera: none). */
export const DOM_FIXED_CAMERA: CameraState = { x: 0, y: 0, zoom: 1 };

/** DOM engine declares no spatial-drawing capabilities (/). */
export const DOM_ENGINE_CAPABILITIES: EngineCapabilities = {
  frames: false,
  draw: false,
  minimap: false,
  infinitePan: false,
  nativeSnapshots: false,
};

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

export interface DomEngineHandle extends EngineHandle {
  /** Subscribe to layout snapshot updates for the React shell bridge. */
  subscribe(listener: () => void): () => void;
  /** Current DOM layout snapshot used by DomWorkspaceShell. */
  getDomLayout(): DomLayoutSnapshot;
  /** Panel ids from the latest selection:changed event (digest focused tier). */
  getSelectedPanelIds(): PanelInstanceId[];
  /** Digest compiler input slice with attention tiers from tab/visibility. */
  getDigestCompilerInput(user: DigestUser): Pick<DigestCompilerInput, 'user' | 'contexts'>;
  /**
   * Digest shape slice (/). The DOM workspace engine declares
   * no spatial-drawing capability (`capabilities.draw: false`) and
   * hosts no canvas shapes, so this always returns null; the tldraw engine
   * implements the same method with real canvas marks.
   */
  getDigestShapeSlice(): DigestShapeSlice | null;
  setActiveTab(regionId: DomRegionId, tabIndex: number): void;
  setSidebarDrawerOpen(open: boolean): void;
  setSidebarSplit(size: number): void;
}

let singletonForTests: DomEngineHandle | null = null;

export function __resetDomEngineForTests__(): void {
  singletonForTests?.destroy();
  singletonForTests = null;
}

export function createDomEngine(): DomEngineHandle {
  let snapshot = createEmptyDomLayoutSnapshot();
  let ready = false;
  let suppressChange = false;
  const containerWidth = 1440;
  const containerHeight = 900;
  let selectedIds: PanelInstanceId[] = [];
  const listeners = createListenerSets();
  const layoutListeners = new Set<() => void>;

   // Minimal ReactiveControllerHost so BrowserAttentionSignalController (a
   // Lit ReactiveController) can drive live tab-focus/document-visibility
   // signals without the DOM engine itself being a LitElement.
  const attentionControllerHost: ReactiveControllerHost = {
    addController: () => {},
    removeController: () => {},
    requestUpdate: () => {
      notifyLayout();
    },
    updateComplete: Promise.resolve(true),
  };
  const attentionSignals = new BrowserAttentionSignalController(attentionControllerHost);

  const emit = <E extends keyof EngineEventMap>(
    event: E,
    payload: EngineEventMap[E]): void => {
    for (const listener of [...listeners[event]]) {
      listener(payload);
    }
  };

  const notifyLayout = (): void => {
    for (const listener of [...layoutListeners]) {
      listener();
    }
  };

  const emitChangeUnlessSuppressed = (): void => {
    if (!suppressChange) {
      emit('change', undefined);
    }
    notifyLayout();
  };

  const panelRect = (panel: DomPanelRecord): Rect => ({
    x: layoutXFromRegionId(panel.regionId) * 1000,
    y: panel.tabIndex * 100,
    w: panel.size.w,
    h: panel.size.h,
  });

  const findPanel = (panelId: PanelInstanceId): DomPanelRecord | undefined =>
    snapshot.panels.find((panel) => panel.panelId === panelId);

  const nextTabIndex = (regionId: DomRegionId): number => {
    const regionPanels = snapshot.panels.filter((panel) => panel.regionId === regionId);
    if (regionPanels.length === 0) return 0;
    return Math.max(...regionPanels.map((panel) => panel.tabIndex)) + 1;
  };

  const upsertPanel = (
    panelId: PanelInstanceId,
    partial: Partial<DomPanelRecord> & Pick<DomPanelRecord, 'regionId' | 'tabIndex' | 'size'>): DomPanelRecord => {
    const existing = findPanel(panelId);
    const next: DomPanelRecord = existing
      ? {...existing,...partial, panelId }: {
          panelId,
          regionId: partial.regionId,
          tabIndex: partial.tabIndex,
          size: partial.size,
          pinned: partial.pinned ?? false,
          contextId: partial.contextId ?? null,
          data: partial.data ?? {},
        };
    snapshot = {...snapshot,
      panels: existing
        ? snapshot.panels.map((panel) => (panel.panelId === panelId ? next: panel)): [...snapshot.panels, next],
    };
    return next;
  };

  const handle: DomEngineHandle = {
    isReady: () => ready,

    subscribe(listener: () => void): () => void {
      layoutListeners.add(listener);
      return () => {
        layoutListeners.delete(listener);
      };
    },

    getDomLayout: () => snapshot,

    getSelectedPanelIds: () => [...selectedIds],

    getDigestCompilerInput(user: DigestUser) {
      return buildDomDigestCompilerInput(snapshot, user, {
        selectedPanelIds: selectedIds,
        signals: attentionSignals.signals,
      });
    },

    getDigestShapeSlice(): DigestShapeSlice | null {
      return null;
    },

    setActiveTab(regionId: DomRegionId, tabIndex: number): void {
      snapshot = {...snapshot,
        activeTab: {...snapshot.activeTab, [regionId]: Math.max(0, tabIndex) },
      };
      emitChangeUnlessSuppressed();
    },

    setSidebarDrawerOpen(open: boolean): void {
      snapshot = {...snapshot, sidebarDrawerOpen: open };
      emitChangeUnlessSuppressed();
    },

    setSidebarSplit(size: number): void {
      snapshot = {...snapshot, sidebarSplit: size };
      emitChangeUnlessSuppressed();
    },

    on<E extends keyof EngineEventMap>(
      event: E,
      listener: (payload: EngineEventMap[E]) => void): () => void {
      listeners[event].add(listener);
      return () => {
        listeners[event].delete(listener);
      };
    },

    exportSnapshot(): JsonObject {
      return {
        version: snapshot.version,
        panels: snapshot.panels.map(domPanelRecordToJson),
        sidebarSplit: snapshot.sidebarSplit,
        activeTab: snapshot.activeTab,
        sidebarDrawerOpen: snapshot.sidebarDrawerOpen,
      };
    },

    importSnapshot(raw: JsonObject): void {
      suppressChange = true;
      try {
        const parsed = snapshotFromNativeExport(raw);
        if (parsed) {
          snapshot = parsed;
        }
      } finally {
        suppressChange = false;
      }
      notifyLayout();
    },

    openPanel(request: EnginePanelPlacement): void {
      const regionId: DomRegionId = domRegionFromEnginePlacement(request);
      const tabIndex =
        request.order !== undefined
          ? Math.max(0, Math.trunc(request.order)): request.position !== undefined
            ? Math.max(0, Math.trunc(request.position.y)): nextTabIndex(regionId);
      const size = request.size ?? DEFAULT_PANEL_SIZE;
      const data = panelDataFromRequest(request.data);
      upsertPanel(request.panelId, {
        regionId,
        tabIndex,
        size,
        data,
        contextId: typeof data.contextRef === 'string' ? data.contextRef: null,
        pinned: false,
      });
      snapshot = {...snapshot,
        activeTab: {...snapshot.activeTab, [regionId]: tabIndex },
      };
      emitChangeUnlessSuppressed();
      if (request.focus) {
        selectedIds = [request.panelId];
        emit('selection:changed', { ids: selectedIds });
      }
    },

    placePanel(id: PanelInstanceId, rect: Rect, opts?: PlaceOptions): void {
      const regionId: DomRegionId = rect.x >= 500 ? 'sidebar': 'main';
      const tabIndex = Math.max(0, Math.trunc(rect.y / 100));
      const panel = upsertPanel(id, {
        regionId,
        tabIndex,
        size: { w: rect.w, h: rect.h },
        data: findPanel(id)?.data ?? {},
        contextId: findPanel(id)?.contextId ?? null,
        pinned: findPanel(id)?.pinned ?? false,
      });
      emit('panel:moved', { id, rect: panelRect(panel) });
      emitChangeUnlessSuppressed();
      if (opts?.focus) {
        selectedIds = [id];
        emit('selection:changed', { ids: selectedIds });
      }
    },

    resizePanel(id: PanelInstanceId, rect: Rect): void {
      const existing = findPanel(id);
      if (!existing) return;
      const panel = upsertPanel(id, {...existing,
        size: { w: rect.w, h: rect.h },
      });
      emit('panel:resized', { id, rect: panelRect(panel) });
      emitChangeUnlessSuppressed();
    },

    removePanel(id: PanelInstanceId): void {
      if (!findPanel(id)) return;
      snapshot = {...snapshot,
        panels: snapshot.panels.filter((panel) => panel.panelId !== id),
      };
      selectedIds = selectedIds.filter((selected) => selected !== id);
      emit('panel:removed', { id });
      emitChangeUnlessSuppressed();
    },

    setZOrder(id: PanelInstanceId, z: 'front' | 'back' | number): void {
      const index = snapshot.panels.findIndex((panel) => panel.panelId === id);
      if (index < 0) return;
      const panels = [...snapshot.panels];
      const [panel] = panels.splice(index, 1);
      if (!panel) return;
      if (z === 'front') {
        panels.push(panel);
      } else if (z === 'back') {
        panels.unshift(panel);
      } else {
        const slot = Math.max(0, Math.min(Math.trunc(z), panels.length));
        panels.splice(slot, 0, panel);
      }
      snapshot = {...snapshot, panels };
      emitChangeUnlessSuppressed();
    },

    getCamera: () => DOM_FIXED_CAMERA,

    setCamera: () => {
       // camera: none — no-op
    },

    setMode: (mode: CanvasMode) => {
      if (mode.kind !== 'fixed') {
         // DOM engine only supports fixed viewport; coerce silently.
      }
    },

    zoomTo: () => {
       // camera: none — no-op
    },

    exportLayout: () => exportLayoutFromSnapshot(snapshot),

    importLayout(records: WorkspaceLayoutRecord[]): void {
      snapshot = importLayoutIntoSnapshot(snapshot, records);
      emitChangeUnlessSuppressed();
    },

    getViewportInfo:(): ViewportInfo => {
      const panelVisibility: Record<PanelInstanceId, number> = {};
      for (const panel of snapshot.panels) {
        panelVisibility[panel.panelId] = computeDomPanelVisibilityRatio(panel, snapshot);
      }
      return {
        visibleRect: { x: 0, y: 0, w: containerWidth, h: containerHeight },
        zoom: 1,
        panelVisibility,
      };
    },

    capabilities: DOM_ENGINE_CAPABILITIES,

    destroy(): void {
      ready = false;
      attentionSignals.hostDisconnected();
      for (const set of Object.values(listeners)) {
        set.clear();
      }
      layoutListeners.clear();
    },
  };

  const markReady = (): void => {
    if (ready) return;
    ready = true;
    attentionSignals.hostConnected();
    emit('ready', undefined);
  };

  markReady();
  singletonForTests = handle;
  return handle;
}

export interface DomEngineMountResult {
  handle: DomEngineHandle;
  unmount: () => void;
}

/**
 * Imperative mount for tests and non-React hosts. React consumers should
 * prefer `<DomWorkspaceShell engine={createDomEngine} />`.
 */
export function mountDomEngine(
  container: HTMLElement,
  renderShell: (handle: DomEngineHandle, container: HTMLElement) => DomEngineMountResult['unmount'],
  opts?: EngineMountOptions): DomEngineMountResult {
  const handle = createDomEngine();
  if (opts?.mode !== undefined) {
    handle.setMode(opts.mode);
  }
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.minHeight = '0';
  const unmountShell = renderShell(handle, container);
  return {
    handle: handle,
    unmount: () => {
      unmountShell();
      handle.destroy();
    },
  };
}

/** CanvasEngine SPI factory lives in domCanvasEngine.ts (React mount). */
