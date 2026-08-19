/**
 * WhiteboardShell - root component for the whiteboard prototype.
 *
 * Default layout (`infinite-panels`): full-viewport tldraw with workspace
 * panels (chat, preview, open positions, …) as draggable/resizable
 * `PanelShape` instances on the infinite canvas. Chat is NOT a fixed side
 * column - it opens via `openPanelInCanvas('chat', …)` on editor mount.
 *
 * Legacy layout (`split-column`): fixed left chat column + tldraw grid.
 * Kept for career-demo backward compatibility only.
 *
 * Toolbar:
 * Prefer `toolbarConfig` (typed whitelist + order + layout actions).
 * Legacy `enableVoiceTool` / `enableLayersPanel` / `enableContextActionsTool`
 * still map into the resolved config.
 *
 * Persistence:
 * `<Tldraw persistenceKey="...">` writes to IndexedDB automatically.
 *
 * Editor binding:
 * On mount we call `bindEditor(editor)` so imperative `panelShapeApi`
 * drivers (canvasTools, voice) can spawn panels from non-React contexts.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  createShapeId,
  Tldraw,
  type Editor,
  type TLUiComponents,
  type TLUiOverrides,
  type TLUser,
} from 'tldraw';
import 'tldraw/tldraw.css';
import './styles/whiteboard-vibe-dark.css';
import { createWhiteboardTldrawUiComponents } from './createWhiteboardTldrawUiComponents';
import { whiteboardToolbarAssetUrls } from './voice/whiteboardToolbarIcons';
import {
  CanvasProvider,
  useCanvasConfig,
  type PartialCanvasTenantConfig,
} from '../../config/CanvasContext';
import { CanvasChromeProvider } from '../../components/chrome/CanvasChromeContext';
import { OpenCanvasIndicator } from '../../components/chrome/OpenCanvasIndicator';
import { NavSidebar } from '../../components/chrome/NavSidebar';
import {
  DEFAULT_WHITEBOARD_NAV_ITEMS,
  type NavItemConfig,
} from '../../components/chrome/navItems';
import {
  resolveNavChrome,
  type NavChromeConfig,
} from '../../components/chrome/navChrome';
import type { PanelRegistry } from '../../components/chrome/panelLoader';
import { defaultWhiteboardPanelSize } from './context/contextFramePanelLayout';
import { WhiteboardChatPanel } from './chat/WhiteboardChatPanel';
import { WhiteboardCommandPalette } from './components/WhiteboardCommandPalette';
import { WhiteboardTopBar } from './components/WhiteboardTopBar';
import {
  bindEditor,
  closeNavPanelsExcept,
  openPanelInCanvas,
  unbindEditor,
} from './shapes/panelShapeApi';
import { computeBesideChatPlacement } from './choreography/chatReserved';
import { getFreeCanvasViewportConfig } from './layout/whiteboardChromeInsets';
import { configureWhiteboardSnap } from './hooks/configureWhiteboardSnap';
import { useWhiteboardFullpageEngage } from './hooks/useWhiteboardFullpageEngage';
import { createPanelShapeUtil } from './shapes/PanelShape';
import { snapToGrid } from '../../layout/panelLayoutEngine';
import type { CanvasHost } from '../../panels/host';
import {
  DEFAULT_WHITEBOARD_PANEL_REGISTRY,
  resolveWhiteboardPanelLoaders,
  type WhiteboardPanelRegistry,
} from './shapes/whiteboardPanelRegistry';
import { WhiteboardVoiceMount } from './voice/WhiteboardVoiceMount';
import { ContextActionsTool } from './tools/ContextActionsTool';
import { LayersTool } from './tools/LayersTool';
import { VoiceTool } from './tools/VoiceTool';
import { AutoArrangeTool } from './tools/AutoArrangeTool';
import { ResetCanvasTool } from './tools/ResetCanvasTool';
import { useWhiteboardTldrawUser } from './useWhiteboardTldrawUser';
import { useWhiteboardSnapshotSync } from './hooks/useWhiteboardSnapshotSync';
import { useContextGroupAutoResize } from './hooks/useContextGroupAutoResize';
import { usePanelDocking } from './hooks/usePanelDocking';
import { usePanelStacking } from './hooks/usePanelStacking';
import { useWhiteboardViewportChrome } from './hooks/useWhiteboardViewportChrome';
import { CHAT_PANEL_ID, FIT_AGENT_DRAWING_EVENT, OPEN_CHAT_EVENT } from '../../choreography';
import { AGENT_SHAPE_PROVENANCE_META_KEY } from '../../engine/agentDrawingTypes';
import {
  fitAgentDrawingCamera,
  isViewportPageBoundsCorrupted,
} from './agentDrawing/fitAgentDrawingCamera';
import { bindWhiteboardViewportScreenBoundsSync, syncWhiteboardViewportScreenBounds } from './hooks/useWhiteboardViewportScreenBoundsSync';
import type { CanvasMode } from '../../engine/types';
import { contextActionsTldrawOverrides } from './whiteboardTldrawOverrides';
import { layersTldrawOverrides } from './layersTldrawOverrides';
import { voiceTldrawOverrides } from './voiceTldrawOverrides';
import { createMinimalWhiteboardTldrawOverrides } from './minimalWhiteboardTldrawOverrides';
import { textSearchTldrawOverrides } from './textSearch/textSearchTldrawOverrides';
import { resolvePersistenceKeys } from './persistenceKey';
import { applyCanvasModeToEditor, WHITEBOARD_ENGINE_CAPABILITIES } from './engine';
import { bindEngineCapabilities, bindEngineDigestShapeSlice } from '../../agents/engineBridge';
import { bindDigestShapeCollector, getDigestShapeSlice } from './digest/digestShapeBridge';
import { bindWalkthroughForEditor } from './walkthrough/walkthroughCameraApi';
import { DEFAULT_CANVAS_MODE } from './canvasMode';
import {
  bindCanvasChatSuppressionGuard,
  isCanvasChatSuppressed,
  purgeChatPanelShapes,
  setCanvasChatSuppressed,
} from './layout/suppressCanvasChat';
import {
  resolveWhiteboardToolbarConfig,
  type ResolvedWhiteboardToolbarConfig,
  type WhiteboardToolbarConfig,
} from './toolbar/toolbarConfig';
import {
  computeWhiteboardChromeInsets,
  shouldExpandWhiteboardNav,
} from './layout/responsiveWhiteboardLayout';
import { useLayoutStore } from '../../components/chrome/navChromeStore';
import { bindWhiteboardPanelHost } from './shapes/whiteboardPanelHostBridge';
import { screenshotCanvasRegion } from './perception/canvasPerceptionApi';
import {
  WHITEBOARD_OPEN_PANEL_EVENT,
  WHITEBOARD_SCREENSHOT_CANVAS_EVENT,
  type WhiteboardOpenPanelEventDetail,
} from './tools/whiteboardToolbarPanelEvents';
import {
  resolveWhiteboardHostChrome,
  type WhiteboardHostChromeConfig,
} from './hostChrome/whiteboardHostChrome';
import { WhiteboardHostChromeProvider } from './hostChrome/WhiteboardHostChromeContext';
import { WhiteboardCanvasFrame } from './hostChrome/WhiteboardCanvasFrame';

/** @deprecated Use `infinite-panels`. */
export type WhiteboardLayoutMode = 'infinite-panels' | 'split-column';

export interface WhiteboardShellProps {
  /** Tenant config - persona, labels, panel data. */
  config?: PartialCanvasTenantConfig;
  /**
   * Canvas host whose panel registry drives the shell. Preferred wiring:
   * register panels through `createCanvasHost({ panels })` and pass the
   * host here. Takes precedence over the deprecated `panels` prop.
   */
  host?: CanvasHost;
  /** DataAdapter source names for spec panels rendered on PanelShapes. */
  adapterSources?: readonly string[];
  /**
   * Whiteboard panel registry. Pass a stable module-scope reference; lazy
   * components are memoised by registry identity.
   *
   * @deprecated Register panels on a `CanvasHost` and pass it via `host`.
   * Kept as an alias for one minor release; the loaders are wrapped into
   * `kind: 'react'` registry definitions internally, so both props share
   * one code path.
   */
  panels?: WhiteboardPanelRegistry;
  /**
   * `infinite-panels` (default): chat + tools as PanelShapes on canvas.
   * `split-column`: legacy fixed chat column beside tldraw.
   */
  layout?: WhiteboardLayoutMode;
  /** Enable tldraw native dark mode (colorScheme) and vibe #121212 token overrides. */
  darkCanvas?: boolean;
  /** Hide the slim WhiteboardTopBar chrome strip. */
  hideTopBar?: boolean;
  /** When true (default for infinite-panels), open chat PanelShape on mount. */
  openChatOnMount?: boolean;
  /**
   * When true, purge chat PanelShape on mount and block chat panel recreation
   * ( example 13 — operator rail is the sole chat surface).
   */
  suppressCanvasChat?: boolean;
  /**
   * First-class toolbar config - tool whitelist/order, layout actions, custom actions.
   * Preferred over boolean-only flags.
   */
  toolbarConfig?: WhiteboardToolbarConfig;
  /**
   * When true, register a "Site actions" item in tldraw's toolbar overflow menu.
   * Selecting it emits `CONTEXT_ACTIONS_PANEL_EVENT` for host overlays (e.g.
   * landi-canvas-studio edit + publish bar).
   * @deprecated Prefer `toolbarConfig.tools` including `site-actions`.
   */
  enableContextActionsTool?: boolean;
  /**
   * @deprecated Use `enableContextActionsTool`.
   * One-minor alias for landi-canvas-studio hosts still on the SiteContext name.
   */
  enableSiteActionsTool?: boolean;
  /**
   * When true, show a floating contextual toolbar when a site context frame (or
   * panel inside it) is selected. Defaults to `enableContextActionsTool`.
   */
  enableContextToolbar?: boolean;
  /**
   * @deprecated Use `enableContextToolbar`.
   * One-minor alias for landi-canvas-studio hosts still on the SiteContext name.
   */
  enableSiteContextToolbar?: boolean;
  /**
   * When true, register a "Layers" toolbar item and fixed-right shape tree.
   * Defaults to `true` for `infinite-panels` layout or when site-actions is enabled.
   * @deprecated Prefer `toolbarConfig.tools` including `layers`.
   */
  enableLayersPanel?: boolean;
  /**
   * When true (default), register voice on the bottom toolbar.
   * @deprecated Prefer `toolbarConfig.tools` including `voice`.
   */
  enableVoiceTool?: boolean;
  /**
   * Optional host scope (e.g. site id) appended to tldraw IndexedDB persistenceKey
   * so local + server restore stay aligned per site (Stage 10).
   */
  persistenceScope?: string;
  /** Camera behavior (spec section 9). Defaults to infinite pan/zoom. */
  mode?: CanvasMode;
  /**
   * Left nav sidebar panel shortcuts (chat, open positions, resources, …).
   * Defaults to `DEFAULT_WHITEBOARD_NAV_ITEMS` for infinite-panels layout.
   */
  navItems?: NavItemConfig[];
  /** When true (default for infinite-panels), render the career NavSidebar overlay. */
  showNavSidebar?: boolean;
  /** When true, enable tldraw grid + snap (embed `snap-grid` / config-url `snapGrid`). */
  snapGrid?: boolean;
  /** Click canvas background to expand the Lit host (`fullpage-on-engage`). */
  fullpageOnEngage?: boolean;
  /** Offset below host site header during fullpage engage (`host-header-height`). */
  hostHeaderHeight?: string | null;
  /** Optional nav rail footer (career voice rail + settings). */
  renderNavFooter?: (openPanel: (panelId: string) => void) => ReactNode;
  /** Frame sizing, border, and canvas-only expand fullscreen (career hosts). */
  hostChrome?: WhiteboardHostChromeConfig;
  /**
   * Optional first-paint layout after editor mount (and again post-persistence).
   * Career homepage passes `applyCareerHomepageFirstPaint` from career-pack.
   */
  applyFirstPaint?: (editor: import('tldraw').Editor) => void;
  /** Nav rail variant + panel switch/stack behavior. */
  navChrome?: NavChromeConfig;
}

const DEFAULT_CHAT_COLUMN_WIDTH = '360px';
const VIBE_CANVAS_BG = '#121212';

/**
 * Build-time public tldraw license key (removes the watermark when present).
 * Read from `VITE_TLDRAW_LICENSE_KEY` so it never needs to be hardcoded or
 * committed. tldraw's own `licenseKey` prop is optional and degrades to the
 * unlicensed watermark, not an error, when this is undefined, so local dev
 * and OSS consumers without a key keep working unmodified.
 */
const TLDRAW_LICENSE_KEY =
  (import.meta.env.VITE_TLDRAW_LICENSE_KEY as string | undefined)?.trim() || undefined;

export function WhiteboardShell({
  config,
  host,
  adapterSources = [],
  panels = DEFAULT_WHITEBOARD_PANEL_REGISTRY,
  layout = 'infinite-panels',
  darkCanvas = false,
  hideTopBar = false,
  openChatOnMount,
  suppressCanvasChat = false,
  toolbarConfig,
  enableContextActionsTool = false,
  enableSiteActionsTool,
  enableContextToolbar,
  enableSiteContextToolbar,
  enableLayersPanel,
  enableVoiceTool = true,
  persistenceScope,
  mode = DEFAULT_CANVAS_MODE,
  navItems = DEFAULT_WHITEBOARD_NAV_ITEMS,
  showNavSidebar,
  snapGrid = true,
  fullpageOnEngage = false,
  hostHeaderHeight = null,
  renderNavFooter,
  hostChrome,
  applyFirstPaint,
  navChrome,
}: WhiteboardShellProps = {}): ReactElement {
  const resolvedEnableContextActionsTool =
    enableContextActionsTool || enableSiteActionsTool === true;
  const shouldOpenChat =
    !suppressCanvasChat && (openChatOnMount ?? layout === 'infinite-panels');
  const shouldShowNavSidebar = showNavSidebar ?? layout === 'infinite-panels';
  const shouldEnableLayersPanel =
    enableLayersPanel ?? (layout === 'infinite-panels' || resolvedEnableContextActionsTool);
  const shouldEnableContextToolbar =
    enableContextToolbar ?? enableSiteContextToolbar ?? resolvedEnableContextActionsTool;

  const resolvedToolbar = useMemo(() =>
      resolveWhiteboardToolbarConfig({
        toolbarConfig,
        enableContextActionsTool: resolvedEnableContextActionsTool,
        enableLayersPanel: shouldEnableLayersPanel,
        enableVoiceTool,
      }),
    [toolbarConfig, resolvedEnableContextActionsTool, shouldEnableLayersPanel, enableVoiceTool]);

  const panelLoaders = useMemo(() => resolveWhiteboardPanelLoaders(host, panels),
    [host, panels]);

  const resolvedHostChrome = useMemo(() =>
      resolveWhiteboardHostChrome({...hostChrome,
        hostHeaderHeight: hostChrome?.hostHeaderHeight ?? hostHeaderHeight,
      }),
    [hostChrome, hostHeaderHeight]);

  const resolvedNavChrome = useMemo(() => resolveNavChrome(navChrome), [navChrome]);

  return (
    <CanvasProvider config={config}>
      <WhiteboardHostChromeProvider chrome={resolvedHostChrome}>
        <WhiteboardShellInner
        host={host}
        adapterSources={adapterSources}
        panels={panelLoaders}
        layout={layout}
        darkCanvas={darkCanvas}
        hideTopBar={hideTopBar}
        openChatOnMount={shouldOpenChat}
        suppressCanvasChat={suppressCanvasChat}
        resolvedToolbar={resolvedToolbar}
        enableContextToolbar={shouldEnableContextToolbar}
        persistenceScope={persistenceScope}
        mode={mode}
        navItems={navItems}
        showNavSidebar={shouldShowNavSidebar}
        snapGrid={snapGrid}
        fullpageOnEngage={fullpageOnEngage}
        hostHeaderHeight={hostHeaderHeight}
        renderNavFooter={renderNavFooter}
        resolvedHostChrome={resolvedHostChrome}
        applyFirstPaint={applyFirstPaint}
        resolvedNavChrome={resolvedNavChrome}
      />
      </WhiteboardHostChromeProvider>
    </CanvasProvider>
  );
}

interface WhiteboardShellInnerProps {
  host?: CanvasHost;
  adapterSources: readonly string[];
  panels: WhiteboardPanelRegistry;
  layout: WhiteboardLayoutMode;
  darkCanvas: boolean;
  hideTopBar: boolean;
  openChatOnMount: boolean;
  suppressCanvasChat: boolean;
  resolvedToolbar: ResolvedWhiteboardToolbarConfig;
  enableContextToolbar: boolean;
  persistenceScope?: string;
  mode: CanvasMode;
  navItems: NavItemConfig[];
  showNavSidebar: boolean;
  snapGrid: boolean;
  fullpageOnEngage: boolean;
  hostHeaderHeight: string | null;
  renderNavFooter?: (openPanel: (panelId: string) => void) => ReactNode;
  resolvedHostChrome: ReturnType<typeof resolveWhiteboardHostChrome>;
  applyFirstPaint?: (editor: Editor) => void;
  resolvedNavChrome: ReturnType<typeof resolveNavChrome>;
}

type WhiteboardExtraTool =
  | typeof ContextActionsTool
  | typeof LayersTool
  | typeof VoiceTool
  | typeof AutoArrangeTool
  | typeof ResetCanvasTool;

function WhiteboardShellInner({
  host,
  adapterSources,
  panels,
  layout,
  darkCanvas,
  hideTopBar,
  openChatOnMount,
  suppressCanvasChat,
  resolvedToolbar,
  enableContextToolbar,
  persistenceScope,
  mode,
  navItems,
  showNavSidebar,
  snapGrid,
  fullpageOnEngage,
  hostHeaderHeight,
  renderNavFooter,
  resolvedHostChrome,
  applyFirstPaint,
  resolvedNavChrome,
}: WhiteboardShellInnerProps): ReactElement {
  const { tenant } = useCanvasConfig();
  const tldrawUser = useWhiteboardTldrawUser(darkCanvas);
  const shellRootRef = useRef<HTMLDivElement | null>(null);
  const viewportChrome = useWhiteboardViewportChrome(shellRootRef);

  // Expand Menu on first paint for tablet+ whiteboard (career UX). Avoids a
  // collapsed-rail flash before ResizeObserver settles.
  useLayoutEffect(() => {
    if (!showNavSidebar) return;
    const width =
      shellRootRef.current?.clientWidth ??
      (typeof window !== 'undefined' ? window.innerWidth: 1280);
    if (shouldExpandWhiteboardNav(width)) {
      useLayoutStore.getState().setNavSidebarExpanded(true);
    }
  }, [showNavSidebar]);

  useEffect(() => {
    bindWhiteboardPanelHost(host ?? null, adapterSources);
    return () => {
      bindWhiteboardPanelHost(null, []);
    };
  }, [adapterSources, host]);

  const shapeUtils = useMemo(() => [createPanelShapeUtil(panels)], [panels]);
  const tldrawUiComponents = useMemo(() =>
      createWhiteboardTldrawUiComponents({
        resolvedToolbar,
        enableContextToolbar,
      }),
    [resolvedToolbar, enableContextToolbar]);
  const extraTools = useMemo((): WhiteboardExtraTool[] => {
    const tools: WhiteboardExtraTool[] = [];
    if (resolvedToolbar.enableLayersPanel) tools.push(LayersTool);
    if (resolvedToolbar.enableVoiceTool) tools.push(VoiceTool);
    if (resolvedToolbar.enableContextActionsTool) tools.push(ContextActionsTool);
    // StateNodes only needed when the bottom toolbar exposes layout tools.
    if (resolvedToolbar.showAutoArrangeToolbar) tools.push(AutoArrangeTool);
    if (resolvedToolbar.showResetToolbar) tools.push(ResetCanvasTool);
    return tools;
  }, [resolvedToolbar]);
  const tldrawOverrides = useMemo((): TLUiOverrides[] => {
    const overrides: TLUiOverrides[] = [
      createMinimalWhiteboardTldrawOverrides(resolvedToolbar),
      textSearchTldrawOverrides,
    ];
    if (resolvedToolbar.enableLayersPanel) overrides.push(layersTldrawOverrides);
    if (resolvedToolbar.enableVoiceTool) overrides.push(voiceTldrawOverrides);
    if (resolvedToolbar.enableContextActionsTool) {
      overrides.push(contextActionsTldrawOverrides);
    }
    return overrides;
  }, [resolvedToolbar]);
  const { persistenceKey } = resolvePersistenceKeys(tenant, persistenceScope);
  const editorRef = useRef<Editor | null>(null);
  const [boundEditor, setBoundEditor] = useState<Editor | null>(null);
  const fullpageEngage = useWhiteboardFullpageEngage({
    fullpageOnEngage,
    hostHeaderHeight,
    editor: boundEditor,
  });
  const chatOpenedRef = useRef(false);
  const firstPaintTimersRef = useRef<number[]>([]);

  const scheduleFirstPaint = useCallback(
    (editor: Editor) => {
      if (!applyFirstPaint) return;
      const run = (): void => {
        applyFirstPaint(editor);
      };
      run();
      firstPaintTimersRef.current.push(window.setTimeout(run, 400));
      firstPaintTimersRef.current.push(window.setTimeout(run, 1200));
    },
    [applyFirstPaint]);
  const chatSuppressionUnbindRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setCanvasChatSuppressed(suppressCanvasChat);
    return () => {
      setCanvasChatSuppressed(false);
      chatSuppressionUnbindRef.current?.();
      chatSuppressionUnbindRef.current = null;
    };
  }, [suppressCanvasChat]);

  useWhiteboardSnapshotSync(boundEditor);
  useContextGroupAutoResize(boundEditor);
  usePanelDocking(boundEditor);
  usePanelStacking(boundEditor);

  const shellClassName = [
    darkCanvas ? 'whiteboard-shell--vibe-dark': undefined,
    viewportChrome.compactChrome ? 'whiteboard-shell--compact': undefined,
  ].filter(Boolean).join(' ');
  const shellBackground = darkCanvas
    ? VIBE_CANVAS_BG: 'var(--landi-color-background, #F0F0EC)';

  const openInitialChatPanel = useCallback(
    (editor: Editor) => {
      if (!openChatOnMount || chatOpenedRef.current) return;
      chatOpenedRef.current = true;
      const viewport = editor.getViewportPageBounds();
      const chatSize = defaultWhiteboardPanelSize(editor, 'chat');
      // Live Menu state when synced; width default covers first-paint race
      // before useWhiteboardViewportChrome writes layoutStore.
      const liveExpanded = useLayoutStore.getState().navSidebarExpanded;
      const navExpanded = showNavSidebar
        ? liveExpanded || shouldExpandWhiteboardNav(viewport.w): false;
      const chrome = computeWhiteboardChromeInsets({
        viewportWidth: viewport.w,
        navExpanded,
        showNavSidebar,
      });
      // focus + preserveZoom: pan chat into view without aggressive zoom - career embeds must show Sandy welcome/starters on load, not an empty
      // viewport that would otherwise surface tldraw "Back to content".
      openPanelInCanvas('chat', {
        focus: true,
        preserveZoom: true,
        position: {
          x: snapToGrid(viewport.x + chrome.left),
          y: snapToGrid(viewport.y + chrome.top),
        },
        size: chatSize,
        chrome: { title: 'Chat' },
      });
    },
    [openChatOnMount, showNavSidebar]);

  const handleNavOpenPanel = useCallback((panelId: string) => {
    if (suppressCanvasChat && panelId === CHAT_PANEL_ID) {
      return;
    }

    const navPanelIds = navItems.map((item) => item.panelId).filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (resolvedNavChrome.panelMode === 'switch') {
      closeNavPanelsExcept(panelId, navPanelIds);
    }

    const editor = editorRef.current;
    const stackMode = resolvedNavChrome.panelMode === 'stack';
    let openOptions: Parameters<typeof openPanelInCanvas>[1] = {
      focus: true,
      preserveZoom: true,
      reposition: stackMode,
      chrome: {
        minimized: false,...(panelId === 'chat' ? { title: 'Chat' }: {}),
      },
    };

    if (
      !stackMode &&
      editor !== null &&
      panelId !== CHAT_PANEL_ID &&
      !editor.getShape(createShapeId(`panel:${panelId}`))
    ) {
      const sized = defaultWhiteboardPanelSize(editor, panelId);
      const viewport = getFreeCanvasViewportConfig(editor);
      const placed = computeBesideChatPlacement(
        editor,
        panelId,
        sized.w,
        sized.h,
        viewport,
        snapGrid);
      openOptions = {...openOptions,
        position: placed,
        size: sized,
      };
    }

    openPanelInCanvas(panelId, openOptions);
  }, [navItems, resolvedNavChrome.panelMode, snapGrid, suppressCanvasChat]);

  const prefetchPanels = useMemo(() => panels as unknown as PanelRegistry,
    [panels]);

  const resolvedNavFooter = useMemo(() => (renderNavFooter ? renderNavFooter(handleNavOpenPanel): undefined),
    [renderNavFooter, handleNavOpenPanel]);

  const unbindEngineCapabilitiesRef = useRef<(() => void) | null>(null);
  const unbindDigestShapeCollectorRef = useRef<(() => void) | null>(null);
  const unbindWalkthroughRef = useRef<(() => void) | null>(null);
  const unbindViewportScreenBoundsRef = useRef<(() => void) | null>(null);

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      setBoundEditor(editor);
      configureWhiteboardSnap(editor, { enabled: snapGrid });
      applyCanvasModeToEditor(editor, mode);
      bindEditor(editor);
      unbindEngineCapabilitiesRef.current?.();
      unbindEngineCapabilitiesRef.current = bindEngineCapabilities({...WHITEBOARD_ENGINE_CAPABILITIES,
        draw: resolvedToolbar.drawingEnabled,
      });
      unbindDigestShapeCollectorRef.current?.();
      const unbindDigestShapeCollector = bindDigestShapeCollector(editor);
      const unbindDigestShapeSlice = bindEngineDigestShapeSlice(() => getDigestShapeSlice());
      unbindDigestShapeCollectorRef.current = () => {
        unbindDigestShapeSlice();
        unbindDigestShapeCollector();
      };
      unbindWalkthroughRef.current?.();
      if (host !== undefined) {
        unbindWalkthroughRef.current = bindWalkthroughForEditor(editor, host.agents.camera);
      }
      if (layout === 'infinite-panels') {
        if (suppressCanvasChat) {
          chatSuppressionUnbindRef.current?.();
          chatSuppressionUnbindRef.current = bindCanvasChatSuppressionGuard(editor);
        } else {
          openInitialChatPanel(editor);
        }
      }
      scheduleFirstPaint(editor);
      unbindViewportScreenBoundsRef.current?.();
      unbindViewportScreenBoundsRef.current = bindWhiteboardViewportScreenBoundsSync(editor);
    },
    [host, layout, mode, openInitialChatPanel, resolvedToolbar.drawingEnabled, scheduleFirstPaint, suppressCanvasChat, snapGrid]);

  useEffect(() => {
    if (!boundEditor) return;
    applyCanvasModeToEditor(boundEditor, mode);
  }, [boundEditor, mode]);

  useEffect(() => {
    return () => {
      unbindEngineCapabilitiesRef.current?.();
      unbindEngineCapabilitiesRef.current = null;
      unbindDigestShapeCollectorRef.current?.();
      unbindDigestShapeCollectorRef.current = null;
      unbindWalkthroughRef.current?.();
      unbindWalkthroughRef.current = null;
      unbindViewportScreenBoundsRef.current?.();
      unbindViewportScreenBoundsRef.current = null;
      chatSuppressionUnbindRef.current?.();
      chatSuppressionUnbindRef.current = null;
      unbindEditor();
      editorRef.current = null;
      setBoundEditor(null);
      chatOpenedRef.current = false;
      for (const timerId of firstPaintTimersRef.current) {
        window.clearTimeout(timerId);
      }
      firstPaintTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const onOpenChat = () => {
      if (isCanvasChatSuppressed()) {
        return;
      }
      openPanelInCanvas('chat', {
        focus: true,
        preserveZoom: true,
        chrome: { title: 'Chat', minimized: false },
      });
    };
    window.addEventListener(OPEN_CHAT_EVENT, onOpenChat);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpenChat);
  }, []);

  useEffect(() => {
    const onOpenPanel = (event: Event): void => {
      const detail = (event as CustomEvent<WhiteboardOpenPanelEventDetail>).detail;
      const panelId = detail?.panelId;
      if (typeof panelId !== 'string' || panelId.length === 0) {
        return;
      }
      if (suppressCanvasChat && panelId === CHAT_PANEL_ID) {
        return;
      }
      openPanelInCanvas(panelId, {
        focus: detail.focus ?? true,
        preserveZoom: detail.preserveZoom ?? true,
        reposition: detail.reposition ?? resolvedNavChrome.panelMode === 'stack',
        chrome: {
          minimized: false,...(panelId === 'chat' ? { title: 'Chat' }: {}),
        },
      });
    };
    window.addEventListener(WHITEBOARD_OPEN_PANEL_EVENT, onOpenPanel);
    return () => window.removeEventListener(WHITEBOARD_OPEN_PANEL_EVENT, onOpenPanel);
  }, [suppressCanvasChat, resolvedNavChrome.panelMode]);

  useEffect(() => {
    const onScreenshot = (): void => {
      void (async () => {
        try {
          await screenshotCanvasRegion({});
          window.dispatchEvent(
            new CustomEvent('landi:tool-call', {
              detail: {
                name: 'screenshot_canvas',
                args: {},
                ok: true,
                timestamp: new Date().toISOString(),
              },
              bubbles: true,
              composed: true,
            }));
        } catch (error) {
          const message = error instanceof Error ? error.message: String(error);
          window.dispatchEvent(
            new CustomEvent('landi:tool-call', {
              detail: {
                name: 'screenshot_canvas',
                args: {},
                ok: false,
                error: message,
                timestamp: new Date().toISOString(),
              },
              bubbles: true,
              composed: true,
            }));
        }
      })();
    };
    window.addEventListener(WHITEBOARD_SCREENSHOT_CANVAS_EVENT, onScreenshot);
    return () => window.removeEventListener(WHITEBOARD_SCREENSHOT_CANVAS_EVENT, onScreenshot);
  }, []);

  useEffect(() => {
    if (!boundEditor || !suppressCanvasChat) {
      return;
    }
    purgeChatPanelShapes(boundEditor);
  }, [boundEditor, suppressCanvasChat]);

  useEffect(() => {
    const onFitAgentDrawing = (event: Event) => {
      const agentId = (event as CustomEvent<{ agentId?: string }>).detail?.agentId;
      if (!agentId) return;

      // Defer the measurement two frames so tldraw has fully laid the fresh
      // shapes out first: autoSize text measures on the next paint and geo
      // labels grow their shape (growY) a frame later. Measuring too early
      // fits a stale, shorter bounding box and clips the bottom row.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const editor = editorRef.current;
          if (!editor) return;

          syncWhiteboardViewportScreenBounds(editor);

          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          for (const shape of editor.getCurrentPageShapes()) {
            const meta = shape.meta as Record<string, unknown> | undefined;
            if (meta?.[AGENT_SHAPE_PROVENANCE_META_KEY] !== agentId) continue;
            const bounds = editor.getShapePageBounds(shape.id);
            if (!bounds) continue;
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.w);
            maxY = Math.max(maxY, bounds.y + bounds.h);
          }
          if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return;

          // The chat panel must never end up covering the finished drawing.
          // When they intersect in page space, slide the panel to whichever
          // side of the drawing is closest to where it already sits.
          // Never merge chat bounds into zoomToBounds — panel DOM can report
          // multi-thousand-page heights and corrupts the camera (P8 harness).
          const chatShapeId = createShapeId(`panel:${CHAT_PANEL_ID}`);
          const chatBounds = editor.getShapePageBounds(chatShapeId);
          if (chatBounds) {
            const gap = 32;
            const overlaps =
              chatBounds.x < maxX &&
              chatBounds.x + chatBounds.w > minX &&
              chatBounds.y < maxY &&
              chatBounds.y + chatBounds.h > minY;
            if (overlaps) {
              const candidates = [
                { x: minX - gap - chatBounds.w, y: chatBounds.y },
                { x: maxX + gap, y: chatBounds.y },
                { x: chatBounds.x, y: minY - gap - chatBounds.h },
                { x: chatBounds.x, y: maxY + gap },
              ];
              let best = candidates[0]!;
              let bestDistance = Infinity;
              for (const candidate of candidates) {
                const dx = candidate.x - chatBounds.x;
                const dy = candidate.y - chatBounds.y;
                const distance = dx * dx + dy * dy;
                if (distance < bestDistance) {
                  bestDistance = distance;
                  best = candidate;
                }
              }
              const chatShape = editor.getShape(chatShapeId);
              if (chatShape) {
                const parentOffsetX = best.x - chatBounds.x;
                const parentOffsetY = best.y - chatBounds.y;
                editor.updateShape({
                  id: chatShape.id,
                  type: chatShape.type,
                  x: chatShape.x + parentOffsetX,
                  y: chatShape.y + parentOffsetY,
                });
              }
            }
          }

          // The floating toolbar overlays the bottom of the viewport in
          // screen space, so "fits in the viewport" must exclude that band
          // or the bottom row of a drawing ends up hidden behind it.
          const TOOLBAR_CLEARANCE_PX = 96;

          const viewport = editor.getViewportPageBounds();
          const viewportCorrupted = isViewportPageBoundsCorrupted(viewport);
          const margin = 24;
          const zoomNow = editor.getZoomLevel();
          const toolbarPageNow = zoomNow > 0 ? TOOLBAR_CLEARANCE_PX / zoomNow: 0;
          const shapeScreenW = (maxX - minX) * zoomNow;
          const shapeScreenH = (maxY - minY) * zoomNow;
          const MIN_LEGIBLE_SCREEN_W = 240;
          const MIN_LEGIBLE_SCREEN_H = 140;
          const legibleOnScreen =
            shapeScreenW >= MIN_LEGIBLE_SCREEN_W && shapeScreenH >= MIN_LEGIBLE_SCREEN_H;
          const alreadyFullyInView =
            !viewportCorrupted &&
            minX >= viewport.x + margin &&
            minY >= viewport.y + margin &&
            maxX <= viewport.x + viewport.w - margin &&
            maxY <= viewport.y + viewport.h - margin - toolbarPageNow;
          if (alreadyFullyInView && legibleOnScreen) {
            return;
          }

          fitAgentDrawingCamera(
            editor,
            { minX, minY, maxX, maxY },
            {
              toolbarClearancePx: TOOLBAR_CLEARANCE_PX,
              screen: (() => {
                const viewportEl = document.querySelector(
                  '[data-testid="whiteboard-tldraw-viewport"]');
                if (!(viewportEl instanceof HTMLElement)) return undefined;
                const rect = viewportEl.getBoundingClientRect();
                if (rect.width <= 80 || rect.height <= 80) return undefined;
                return { w: rect.width, h: rect.height };
              })(),
            });
        });
      });
    };
    window.addEventListener(FIT_AGENT_DRAWING_EVENT, onFitAgentDrawing);
    return () => window.removeEventListener(FIT_AGENT_DRAWING_EVENT, onFitAgentDrawing);
  }, []);

  const isInfinitePanels = layout === 'infinite-panels';

  return (
    <div
      ref={shellRootRef}
      className={shellClassName || undefined}
      data-testid="whiteboard-shell"
      data-layout={layout}
      data-canvas-mode={mode.kind}
      data-compact={viewportChrome.compactChrome ? 'true': 'false'}
      data-viewport-width={Math.round(viewportChrome.width)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        flex: 1,
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        background: shellBackground,
        overflow: 'hidden',
      }}
    >
      <WhiteboardCanvasFrame chrome={resolvedHostChrome} shellBackground={shellBackground}>
      {resolvedToolbar.enableVoiceTool ? <WhiteboardVoiceMount />: null}
      {!hideTopBar ? (
        <WhiteboardTopBar
          toolbar={resolvedToolbar}
          compact={viewportChrome.compactChrome}
          darkCanvas={darkCanvas}
        />
      ): null}
      {isInfinitePanels ? <WhiteboardCommandPalette layout={layout} />: null}

      {isInfinitePanels ? (
        <CanvasChromeProvider
          panels={prefetchPanels}
          navItems={navItems}
          openPanel={handleNavOpenPanel}
          navFooter={resolvedNavFooter}
          navChrome={resolvedNavChrome}
        >
          <div
            data-testid="whiteboard-tldraw-viewport"
            className={`whiteboard-tldraw-viewport${fullpageEngage.isEngaged ? ' whiteboard-tldraw-viewport--engaged': ''}`}
            style={{
              position: 'relative',
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              width: '100%',
              height: '100%',
              background: shellBackground,
            }}
          >
            <Tldraw
              hideUi={false}
              components={tldrawUiComponents}
              overrides={tldrawOverrides}
              assetUrls={whiteboardToolbarAssetUrls}
              tools={extraTools}
              persistenceKey={persistenceKey}
              shapeUtils={shapeUtils}
              user={tldrawUser}
              licenseKey={TLDRAW_LICENSE_KEY}
              onMount={handleMount}
            />
            <OpenCanvasIndicator />
            {showNavSidebar ? <NavSidebar variant="whiteboard" navChrome={resolvedNavChrome} />: null}
          </div>
        </CanvasChromeProvider>
      ): (
        <SplitColumnLayout
          persistenceKey={persistenceKey}
          shapeUtils={shapeUtils}
          tldrawUser={tldrawUser}
          tldrawUiComponents={tldrawUiComponents}
          extraTools={extraTools}
          tldrawOverrides={tldrawOverrides}
          onMount={handleMount}
          shellBackground={shellBackground}
        />
      )}
      </WhiteboardCanvasFrame>
    </div>
  );
}

/** Legacy split-column layout - chat fixed left, tldraw right. */
function SplitColumnLayout({
  persistenceKey,
  shapeUtils,
  tldrawUser,
  tldrawUiComponents,
  extraTools,
  tldrawOverrides,
  onMount,
  shellBackground,
}: {
  persistenceKey: string;
  shapeUtils: ReturnType<typeof createPanelShapeUtil>[];
  tldrawUser: TLUser;
  tldrawUiComponents: TLUiComponents;
  extraTools: WhiteboardExtraTool[];
  tldrawOverrides: TLUiOverrides[] | undefined;
  onMount: (editor: Editor) => void;
  shellBackground: string;
}): ReactElement {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: `${DEFAULT_CHAT_COLUMN_WIDTH} 1fr`,
        width: '100%',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <aside
        style={{
          height: '100%',
          minHeight: 0,
          minWidth: 0,
          borderRight: '1px solid var(--landi-color-border, #E5E5E0)',
          background: 'var(--landi-color-surface, #FFFFFF)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <WhiteboardChatPanel />
      </aside>

      <div
        style={{
          position: 'relative',
          minWidth: 0,
          minHeight: 0,
          height: '100%',
          background: shellBackground,
        }}
      >
        <Tldraw
          hideUi={false}
          components={tldrawUiComponents}
          overrides={tldrawOverrides}
          assetUrls={whiteboardToolbarAssetUrls}
          tools={extraTools}
          persistenceKey={persistenceKey}
          shapeUtils={shapeUtils}
          user={tldrawUser}
          licenseKey={TLDRAW_LICENSE_KEY}
          onMount={onMount}
        />
      </div>
    </div>
  );
}
