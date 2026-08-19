/**
 * @docs/development/ARCHITECTURE.md
 * Whiteboard barrel — public surface for the whiteboard prototype.
 *
 * Exports:
 * - `WhiteboardShell` — eager export for direct consumers (tests, the
 * CareerWhiteboard wrapper, anyone happy to bundle tldraw upfront).
 * - `LazyWhiteboardShell` — `React.lazy` wrapper that defers the
 * tldraw + WhiteboardShell chunk until first render. Use this in
 * route components so /career-canvas-whiteboard streams its tldraw
 * bundle on demand instead of in the main app chunk.
 * - `prefetchWhiteboardShell` — fires the same dynamic import without
 * awaiting. Hook this to nav-link hover and to `voiceKernel.start`
 * so the chunk is warm by the time the user lands on the route or
 * the agent's first tool call fires.
 * - `panelShapeApi` re-exports — `openPanelInCanvas` etc. consumed by
 * the shared canvasTools registry, no module-deep imports needed.
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
  CONTEXT_ACTIONS_PANEL_EVENT,
  LEGACY_CONTEXT_ACTIONS_PANEL_EVENT,
  CONTEXT_ACTIONS_TOOL_ID,
  type ContextActionsPanelEventDetail,
} from './tools/contextActionsEvents';
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
 * - Hook to nav-link `onPointerEnter` / `onFocus` so hovering the
 * whiteboard nav warms the chunk.
 * - Hook to `voiceKernel.start` so a tool call landing in the load
 * window has a shorter wait — the editor is more likely to be bound
 * by the time `panelShapeApi.openPanelInCanvas` fires.
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
  applyCanvasModeToEditor,
  WHITEBOARD_ENGINE_CAPABILITIES,
  type WhiteboardEngineHandle,
} from './engine';

export {
  DEFAULT_CANVAS_MODE,
  HOST_HEADER_HEIGHT_VAR,
  clampCameraForMode,
  parseCanvasBounds,
  parseCanvasModeFromEmbed,
  parseHostHeaderHeight,
  type ParseCanvasModeInput,
} from './canvasMode';

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
  resolveContextIdFromPanelData,
  resolveContextFrameFromSelection,
  findContextFrameGroupForShape,
  getContextGroupMeta,
  CONTEXT_META_KEY,
  LEGACY_CONTEXT_META_KEY,
  CONTEXT_FRAME_PADDING,
  ensurePanelInContextFrame,
  fitContextGroupFrameToContent,
  fitContextFrameGroupForShape,
  collectPanelShapeIdsFromStoreDiff,
  type ContextGroupKind,
  type ContextGroupRef,
  type ContextGroupMeta,
  type ResolvedContextFrameGroup,
} from './context/contextGroupApi';

export {
  listContextFrameLayers,
  resolveSelectedContextFrameLayerId,
  selectContextFrameLayer,
  toggleContextFrameLayerVisibility,
  deleteContextFrameLayer,
  isContextFrameLayerVisible,
  type ContextFrameLayer,
} from './context/contextFrameLayersApi';

export {
  repairAllInvalidContextFrameLayouts,
  repairContextFrameLayout,
  isContextFrameLayoutInvalid,
  contextFrameIdForContext,
} from './context/contextFrameLayoutRepair';

export {
  autoArrangeContextFramePanels,
  autoArrangeContextFramePanelsByFrameId,
  autoArrangeAllContextFramePanels,
  hasContextFramePanels,
} from './context/contextFrameAutoArrange';

export {
  enterContextFrameWorkspaceMode,
  type ContextFrameWorkspaceModeOptions,
} from './context/contextFrameWorkspaceMode';

export {
  CANVAS_GLOBAL_PANEL_IDS,
  isCanvasGlobalPanel,
  ejectGlobalPanelsFromSiteFrames,
  filterContextFramePanelIds,
  isPanelInsideContextFrame,
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
  type ContextFrameDockPresetOptions,
} from './context/contextFrameDockPresets';

export { usePanelDocking } from './hooks/usePanelDocking';

export {
  computeInitialContextFrameLayout,
  computePanelPlacementInContextFrame,
  resolveInsertionContextFrame,
  defaultSitePanelSize,
  SITE_CHAT_WIDTH,
  SITE_BRIEF_WIDTH,
  SITE_PREVIEW_WIDTH,
  SITE_PREVIEW_HEIGHT,
  SITE_FILE_MANAGER_WIDTH,
  SITE_FILE_MANAGER_HEIGHT,
  SITE_CONTEXT_PANEL_GAP,
  SITE_CONTEXT_VIEWPORT_INSET,
  type ContextFramePanelKind,
  type ContextFramePanelPlacement,
  type ContextFrameLayoutOptions,
} from './context/contextFramePanelLayout';

export {
  CONTEXT_FRAME_TOOLBAR_EVENT,
  LEGACY_CONTEXT_FRAME_TOOLBAR_EVENT,
  emitContextFrameToolbarAction,
  type ContextFrameToolbarAction,
  type ContextFrameToolbarEventDetail,
  type ContextFrameToolbarPanelId,
} from './context/contextFrameToolbarEvents';

export {
  createMinimalWhiteboardTldrawOverrides,
  minimalWhiteboardTldrawOverrides,
  WHITEBOARD_TOOLBAR_TOOL_IDS,
} from './minimalWhiteboardTldrawOverrides';

export {
  resolveWhiteboardToolbarConfig,
  parseWhiteboardToolbarConfig,
  DEFAULT_WHITEBOARD_TOOLBAR_TOOLS,
  CAREER_WHITEBOARD_TOOLBAR_DEFAULTS,
  BUILTIN_WHITEBOARD_TOOLBAR_TOOL_IDS,
  allowedTldrawToolIds,
  type WhiteboardToolbarConfig,
  type WhiteboardToolbarToolId,
  type WhiteboardToolbarCustomAction,
  type WhiteboardLayoutActionPlacement,
  type ResolvedWhiteboardToolbarConfig,
  type ResolveWhiteboardToolbarConfigInput,
  type BuiltinWhiteboardToolbarToolId,
} from './toolbar/toolbarConfig';

export {
  AUTO_ARRANGE_TOOL_ID,
  RESET_CANVAS_TOOL_ID,
} from './tools/layoutActionEvents';

export { autoArrangeWhiteboardPanels } from './layout/autoArrangeWhiteboardPanels';
export { resetWhiteboardLayout } from './layout/resetWhiteboardLayout';
export {
  computeResponsiveWhiteboardPanelSize,
  shouldUseCompactWhiteboardChrome,
  shouldExpandWhiteboardNav,
  whiteboardViewportTier,
  whiteboardNavReserveWidth,
  computeWhiteboardChromeInsets,
  WHITEBOARD_VIEWPORT_INSET,
  WHITEBOARD_MOBILE_BP,
  WHITEBOARD_TABLET_BP,
  WHITEBOARD_DESKTOP_BP,
} from './layout/responsiveWhiteboardLayout';
export {
  resolveWhiteboardChromeInsets,
  getFreeCanvasViewportConfig,
} from './layout/whiteboardChromeInsets';

export {
  defaultWhiteboardPanelSize,
} from './context/contextFramePanelLayout';

export { configureWhiteboardSnap } from './hooks/configureWhiteboardSnap';

export { GRID_SIZE, snapToGrid, snapRect } from '../../layout/panelLayoutEngine';

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
} from '../../layout/gridLayout';

export {
  useFrameContextStore,
  getActiveContextRef,
  getWhiteboardPaletteEntities,
  readWhiteboardPaletteEntities,
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
} from '../../protocol/ag-ui';
export {
  CANVAS_RESTORE_SNAPSHOT_EVENT,
  LEGACY_CANVAS_RESTORE_SNAPSHOT_EVENT,
  CANVAS_RESTORE_SNAPSHOT_EVENTS,
  type CanvasRestoreSnapshotEventDetail,
} from './snapshot/canvasSnapshotEvents';

export {
  resolvePersistenceKeys,
  isLegacyPersistenceKey,
  PERSISTENCE_KEY_PREFIX,
  LEGACY_PERSISTENCE_KEY_PREFIX,
  type PersistenceKeyResolution,
} from './persistenceKey';

// --- Deprecated one-minor aliases (A11) — not part of the canonical public surface ---
/** @deprecated Use resolveContextFrameFromSelection */
export { resolveContextFrameFromSelection as resolveSiteContextFromSelection } from './context/contextGroupApi';
/** @deprecated Use findContextFrameGroupForShape */
export { findContextFrameGroupForShape as findSiteContextGroupForShape } from './context/contextGroupApi';
/** @deprecated Use resolveContextIdFromPanelData */
export { resolveContextIdFromPanelData as resolveSiteIdFromPanelData } from './context/contextGroupApi';
/** @deprecated Use ensurePanelInContextFrame */
export { ensurePanelInContextFrame as ensurePanelInSiteContextFrame } from './context/contextGroupApi';
/** @deprecated Use fitContextFrameGroupForShape */
export { fitContextFrameGroupForShape as fitSiteContextGroupForShape } from './context/contextGroupApi';
/** @deprecated Use ResolvedContextFrameGroup */
export type { ResolvedContextFrameGroup as ResolvedSiteContextGroup } from './context/contextGroupApi';
/** @deprecated Use filterContextFramePanelIds */
export { filterContextFramePanelIds as filterSiteContextPanelIds } from './context/canvasGlobalPanels';
/** @deprecated Use isPanelInsideContextFrame */
export { isPanelInsideContextFrame as isPanelInsideSiteContextFrame } from './context/canvasGlobalPanels';
/** @deprecated Use CONTEXT_FRAME_TOOLBAR_EVENT */
export { LEGACY_CONTEXT_FRAME_TOOLBAR_EVENT as CANVAS_SITE_CONTEXT_TOOLBAR_EVENT } from './context/contextFrameToolbarEvents';
/** @deprecated Use CONTEXT_ACTIONS_PANEL_EVENT */
export { LEGACY_CONTEXT_ACTIONS_PANEL_EVENT as CANVAS_SITE_ACTIONS_PANEL_EVENT } from './tools/contextActionsEvents';
/** @deprecated Use ContextActionsPanelEventDetail */
export type { ContextActionsPanelEventDetail as CanvasSiteActionsPanelEventDetail } from './tools/contextActionsEvents';
/** @deprecated Use CONTEXT_ACTIONS_TOOL_ID */
export { CONTEXT_ACTIONS_TOOL_ID as SITE_ACTIONS_TOOL_ID } from './tools/contextActionsEvents';
/** @deprecated Use autoArrangeContextFramePanels */
export { autoArrangeContextFramePanels as autoArrangeSiteContextPanels } from './context/contextFrameAutoArrange';
/** @deprecated Use hasContextFramePanels */
export { hasContextFramePanels as hasSiteContextPanels } from './context/contextFrameAutoArrange';
/** @deprecated Use enterContextFrameWorkspaceMode */
export { enterContextFrameWorkspaceMode as enterSiteWorkspaceMode } from './context/contextFrameWorkspaceMode';
/** @deprecated Use computeInitialContextFrameLayout */
export { computeInitialContextFrameLayout as computeInitialSiteContextLayout } from './context/contextFramePanelLayout';
/** @deprecated Use ContextFramePanelKind */
export type { ContextFramePanelKind as SiteContextPanelKind } from './context/contextFramePanelLayout';
/** @deprecated Use ContextFrameToolbarAction */
export type { ContextFrameToolbarAction as SiteContextToolbarAction } from './context/contextFrameToolbarEvents';
/** @deprecated Use ContextFrameToolbarEventDetail */
export type { ContextFrameToolbarEventDetail as SiteContextToolbarEventDetail } from './context/contextFrameToolbarEvents';
/** @deprecated Use ContextFrameToolbarPanelId */
export type { ContextFrameToolbarPanelId as SiteContextToolbarPanelId } from './context/contextFrameToolbarEvents';
/** @deprecated Use listContextFrameLayers */
export { listContextFrameLayers as listSiteContextLayers } from './context/contextFrameLayersApi';
/** @deprecated Use resolveSelectedContextFrameLayerId */
export { resolveSelectedContextFrameLayerId as resolveSelectedSiteContextLayerId } from './context/contextFrameLayersApi';
/** @deprecated Use selectContextFrameLayer */
export { selectContextFrameLayer as selectSiteContextLayer } from './context/contextFrameLayersApi';
/** @deprecated Use toggleContextFrameLayerVisibility */
export { toggleContextFrameLayerVisibility as toggleSiteContextLayerVisibility } from './context/contextFrameLayersApi';
/** @deprecated Use deleteContextFrameLayer */
export { deleteContextFrameLayer as deleteSiteContextLayer } from './context/contextFrameLayersApi';
/** @deprecated Use ContextFrameLayer */
export type { ContextFrameLayer as SiteContextLayer } from './context/contextFrameLayersApi';
/** @deprecated Use isContextFrameLayerVisible */
export { isContextFrameLayerVisible as isSiteContextLayerVisible } from './context/contextFrameLayersApi';
