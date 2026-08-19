/**
 * @docs/development/ARCHITECTURE.md
 * Whiteboard barrel — public surface for the whiteboard prototype.
 *
 * Exports:
 *   - `WhiteboardShell` — eager export for direct consumers (tests, the
 *     CareerWhiteboard wrapper, anyone happy to bundle tldraw upfront).
 *   - `LazyWhiteboardShell` — `React.lazy()` wrapper that defers the
 *     tldraw + WhiteboardShell chunk until first render. Use this in
 *     route components so /career-canvas-whiteboard streams its tldraw
 *     bundle on demand instead of in the main app chunk.
 *   - `prefetchWhiteboardShell` — fires the same dynamic import without
 *     awaiting. Hook this to nav-link hover and to `voiceKernel.start()`
 *     so the chunk is warm by the time the user lands on the route or
 *     the agent's first tool call fires.
 *   - `panelShapeApi` re-exports — `openPanelInCanvas` etc. consumed by
 *     the shared canvasTools registry, no module-deep imports needed.
 *
 * The Lit shell embed path doesn't go through this barrel — embed bundles
 * keep the existing absolute-positioned canvas. The whiteboard is React-
 * only by design.
 */
import { lazy, type ComponentType } from 'react';
import type { WhiteboardShellProps } from './WhiteboardShell';

/** Eager export. Pulls tldraw into the consumer's bundle. */
export { WhiteboardShell } from './WhiteboardShell';
export type { WhiteboardShellProps, WhiteboardLayoutMode } from './WhiteboardShell';
export { minimalTldrawUiComponents } from './minimalTldrawUiComponents';
export { createWhiteboardTldrawUiComponents } from './createWhiteboardTldrawUiComponents';
export {
  CANVAS_SITE_ACTIONS_PANEL_EVENT,
  SITE_ACTIONS_TOOL_ID,
  type CanvasSiteActionsPanelEventDetail,
} from './tools/siteActionsEvents';
export {
  CANVAS_LAYERS_PANEL_EVENT,
  LAYERS_TOOL_ID,
  type CanvasLayersPanelEventDetail,
} from './tools/layersEvents';
export {
  TEXT_SEARCH_ACTION_ID,
  textSearchTldrawOverrides,
} from './textSearch/textSearchTldrawOverrides';
export {
  closeCanvasTextSearch,
  openCanvasTextSearch,
  showTextSearchAtom,
  textSearchQueryAtom,
} from './textSearch/textSearchStore';
export {
  getShapeLabel,
  getShapeSearchText,
  searchCanvasText,
  focusShapeInCanvas,
  type CanvasTextSearchResult,
} from './utils/shapeTextUtils';

/**
 * Lazy WhiteboardShell. The dynamic import resolves to the same module as
 * the eager export — Vite chunk-dedupes so you can mix-and-match per
 * route.
 */
export const LazyWhiteboardShell = lazy(async () => {
  const mod = await import('./WhiteboardShell');
  return { default: mod.WhiteboardShell as ComponentType<WhiteboardShellProps> };
});

/**
 * Prefetch the tldraw + WhiteboardShell chunk. Idempotent (the import
 * cache dedupes). Returns the resolved module so callers can chain off
 * it; failure rejection is swallowed because the visible failure path is
 * the user actually navigating, where Suspense + ErrorBoundary handle it.
 *
 * Wire-up suggestions:
 *   - Hook to nav-link `onPointerEnter` / `onFocus` so hovering the
 *     whiteboard nav warms the chunk.
 *   - Hook to `voiceKernel.start()` so a tool call landing in the load
 *     window has a shorter wait — the editor is more likely to be bound
 *     by the time `panelShapeApi.openPanelInCanvas` fires.
 */
export function prefetchWhiteboardShell(): Promise<unknown> {
  return import('./WhiteboardShell').catch((err) => {
    if (
      typeof process !== 'undefined' &&
      process.env?.NODE_ENV !== 'production'
    ) {
      // eslint-disable-next-line no-console
      console.debug('[whiteboard] prefetch failed', err);
    }
  });
}

// Engine SPI implementation (src/engine/types). The one engine
// handle factory this package ships; hosts pass the handle to
// `createCanvasHost` and attach the editor on shell mount.
export {
  createWhiteboardEngine,
  WHITEBOARD_ENGINE_CAPABILITIES,
  type WhiteboardEngineHandle,
} from './engine';

// Imperative driver — re-exported so canvasTools and tests don't need to
// reach into the `shapes/` subdirectory.
export {
  bindEditor,
  unbindEditor,
  getEditor,
  loadWhiteboardSnapshot,
  openPanelInCanvas,
  closePanelInCanvas,
  focusPanelInCanvas,
  groupPanelsInCanvas,
  updatePanelProps,
  updatePanelChrome,
  __resetPanelShapeApiForTests__,
  type OpenPanelOptions,
} from './shapes/panelShapeApi';

export {
  assignPanelsToContextGroup,
  assignPanelsToSiteGroup,
  contextGroupFrameId,
  resolveSiteIdFromPanelData,
  resolveSiteContextFromSelection,
  findSiteContextGroupForShape,
  getContextGroupMeta,
  CONTEXT_META_KEY,
  CONTEXT_FRAME_PADDING,
  ensurePanelInSiteContextFrame,
  fitContextGroupFrameToContent,
  fitSiteContextGroupForShape,
  collectPanelShapeIdsFromStoreDiff,
  type ContextGroupKind,
  type ContextGroupRef,
  type ContextGroupMeta,
  type ResolvedSiteContextGroup,
} from './context/contextGroupApi';

export {
  listSiteContextLayers,
  resolveSelectedSiteContextLayerId,
  selectSiteContextLayer,
  toggleSiteContextLayerVisibility,
  deleteSiteContextLayer,
  isSiteContextLayerVisible,
  type SiteContextLayer,
} from './context/siteContextLayersApi';

export {
  repairAllInvalidSiteContextLayouts,
  repairSiteContextFrameLayout,
  isSiteContextLayoutInvalid,
  siteContextFrameIdForSite,
} from './context/siteContextLayoutRepair';

export {
  autoArrangeSiteContextPanels,
  autoArrangeSiteContextPanelsByFrameId,
  autoArrangeAllSiteContextPanels,
  hasSiteContextPanels,
} from './context/siteContextAutoArrange';

export {
  enterSiteWorkspaceMode,
  type SiteWorkspaceModeOptions,
} from './context/siteWorkspaceMode';

export {
  CANVAS_GLOBAL_PANEL_IDS,
  isCanvasGlobalPanel,
  ejectGlobalPanelsFromSiteFrames,
  filterSiteContextPanelIds,
  isPanelInsideSiteContextFrame,
} from './context/canvasGlobalPanels';

export {
  PANEL_DOCK_META_KEY,
  DOCK_HIT_THRESHOLD,
  getPanelDock,
  setPanelDock,
  hitTestPanelDock,
  previewPanelDockHighlight,
  applyPanelDock,
  resolveDock,
  resolveDockTree,
  cascadeDockedPanelsInFrame,
  collectDockedPanelsInFrame,
  getFrameInnerRect,
  type PanelDock,
  type PanelDockTarget,
  type PanelDockEdge,
  type DockTreeNode,
  type DockTreePlacement,
  type DockZoneHighlight,
} from './context/panelDockEngine';

export {
  buildAdminSiteDockTree,
  sizesFromPlacements,
  type SiteDockPresetOptions,
} from './context/siteContextDockPresets';

export { usePanelDocking } from './hooks/usePanelDocking';

export {
  computeInitialSiteContextLayout,
  computePanelPlacementInSiteContext,
  resolveInsertionSiteContext,
  defaultSitePanelSize,
  SITE_CHAT_WIDTH,
  SITE_BRIEF_WIDTH,
  SITE_PREVIEW_WIDTH,
  SITE_PREVIEW_HEIGHT,
  SITE_FILE_MANAGER_WIDTH,
  SITE_FILE_MANAGER_HEIGHT,
  SITE_CONTEXT_PANEL_GAP,
  SITE_CONTEXT_VIEWPORT_INSET,
  type SiteContextPanelKind,
  type SiteContextPanelPlacement,
  type SiteContextLayoutOptions,
} from './context/siteContextPanelLayout';

export {
  CANVAS_SITE_CONTEXT_TOOLBAR_EVENT,
  emitSiteContextToolbarAction,
  type SiteContextToolbarAction,
  type SiteContextToolbarEventDetail,
  type SiteContextToolbarPanelId,
} from './context/siteContextToolbarEvents';

export { configureWhiteboardSnap } from './hooks/configureWhiteboardSnap';

export { GRID_SIZE, snapToGrid, snapRect } from '../canvas/panelLayoutEngine';

export {
  GRID_COLUMNS,
  GRID_ROW_HEIGHT,
  GRID_GUTTER,
  GRID_REFERENCE_WIDTH,
  createGridSpec,
  getPanelGridSpan,
  gridPlacementToRect,
  gridSpanToSize,
  findNextGridSlot,
  SITE_PANEL_GRID_SPANS,
  type GridSpec,
  type GridCellPlacement,
  type GridPanelSpan,
} from '../canvas/gridLayout';

export {
  useFrameContextStore,
  getActiveContextRef,
  WHITEBOARD_PALETTE_ENTITIES,
} from './context/frameContextStore';

// Registry types — consumers (tests, alternative tenants) need these
// to define their own panel registries.
export {
  DEFAULT_WHITEBOARD_PANEL_REGISTRY,
  type WhiteboardPanelRegistry,
  type WhiteboardPanelLoader,
  type WhiteboardPanelProps,
} from './shapes/whiteboardPanelRegistry';

// Shape util — re-exported so consumers wanting to register the shape
// against a custom tldraw editor instance (e.g. for tests) don't need to
// reach into `shapes/`.
export {
  attachPanelScrollWheelIsolation,
  findScrollableWheelTarget,
  handlePanelWheelCapture,
  HORIZONTAL_WHEEL_PANEL_IDS,
  panelCapturesHorizontalWheel,
  panelScrollWheelCaptureProps,
  usePanelScrollWheelIsolation,
  type PanelWheelCaptureOptions,
} from './shapes/panelScrollWheel';

export {
  AG_UI_STATE_PATCH_EVENT,
  emitAgUiStatePatch,
  type AgUiStatePatch,
  type AgUiStatePatchEventDetail,
} from '../canvas/protocol/ag-ui';
export {
  CANVAS_RESTORE_SNAPSHOT_EVENT,
  type CanvasRestoreSnapshotEventDetail,
} from './snapshot/canvasSnapshotEvents';
