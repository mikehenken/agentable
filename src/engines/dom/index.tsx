/**
 * DOM workspace engine barrel.
 *
 * Second CanvasEngine alongside tldraw: regions, resizable splits, tabs,
 * and responsive drawer collapse with `camera: none`.
 ** eslint-disable react-refresh/only-export-components -- engine barrel mirrors tldraw index pattern */
export { DomWorkspaceShell, type DomWorkspaceShellProps } from './DomWorkspaceShell';
export {
  createDomEngine,
  mountDomEngine,
  __resetDomEngineForTests__,
  DOM_ENGINE_CAPABILITIES,
  DOM_FIXED_CAMERA,
  type DomEngineHandle,
  type DomEngineMountResult,
} from './engine';
export { layoutRecordFromDomPanel } from './layoutCodec';
export { createDomCanvasEngine } from './domCanvasEngine';
export {
  applyBrowserAttentionSignals,
  buildDomDigestCompilerInput,
  buildDomDigestContexts,
  classifyDomPanelVisibility,
  computeDomPanelVisibilityRatio,
  deriveDomPanelAttention,
  mapDomVisibilityToAttention,
  DEFAULT_BROWSER_ATTENTION_SIGNALS,
  type BrowserAttentionSignals,
  type DomDigestAttentionOptions,
  type DomPanelVisibilityKind,
} from './digestAttention';
export {
  BrowserAttentionSignalController,
  type BrowserAttentionSignalControllerOptions,
} from './browserAttentionSignalController';
export { DomRegionLayout, type DomRegionLayoutProps } from './components/DomRegionLayout';
export { DomTabStrip, type DomTabStripProps } from './components/DomTabStrip';
export { DomDrawer, type DomDrawerProps } from './components/DomDrawer';
export { useDomBreakpoint, type DomBreakpointState } from './hooks/useDomBreakpoint';
export {
  DOM_DEFAULT_SIDEBAR_SPLIT,
  DOM_MOBILE_BP,
  DOM_TABLET_BP,
  DOM_TABLET_MEDIA_QUERY,
  createEmptyDomLayoutSnapshot,
  layoutXFromRegionId,
  regionIdFromLayoutX,
  type DomLayoutSnapshot,
  type DomPanelRecord,
  type DomRegionId,
} from './types';
