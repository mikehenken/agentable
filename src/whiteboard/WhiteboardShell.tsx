/**
 * WhiteboardShell — root component for the whiteboard prototype.
 *
 * Default layout (`infinite-panels`): full-viewport tldraw with workspace
 * panels (chat, preview, open positions, …) as draggable/resizable
 * `PanelShape` instances on the infinite canvas. Chat is NOT a fixed side
 * column — it opens via `openPanelInCanvas('chat', …)` on editor mount.
 *
 * Legacy layout (`split-column`): fixed left chat column + tldraw grid.
 * Kept for career-demo backward compatibility only.
 *
 * Panels:
 *   The shell renders whatever the resolved registry holds: the panel
 *   definitions registered on a `host` (preferred), or the deprecated
 *   `panels` loader map wrapped into definitions. Both wirings resolve
 *   through `resolveWhiteboardPanelLoaders`, one code path.
 *
 * Persistence:
 *   `<Tldraw persistenceKey="...">` writes to IndexedDB automatically.
 *
 * Editor binding:
 *   On mount we call `bindEditor(editor)` so imperative `panelShapeApi`
 *   drivers (canvasTools, voice) can spawn panels from non-React contexts.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Tldraw, type Editor, type TLUiComponents, type TLUiOverrides, type TLUser } from 'tldraw';
import 'tldraw/tldraw.css';
import './styles/whiteboard-vibe-dark.css';
import { createWhiteboardTldrawUiComponents } from './createWhiteboardTldrawUiComponents';
import {
  CanvasProvider,
  useCanvasConfig,
  type PartialCanvasTenantConfig,
} from '../canvas/CanvasContext';
import { WhiteboardChatPanel } from './chat/WhiteboardChatPanel';
import { WhiteboardCommandPalette } from './components/WhiteboardCommandPalette';
import { WhiteboardTopBar } from './components/WhiteboardTopBar';
import {
  bindEditor,
  openPanelInCanvas,
  unbindEditor,
} from './shapes/panelShapeApi';
import { configureWhiteboardSnap } from './hooks/configureWhiteboardSnap';
import { createPanelShapeUtil } from './shapes/PanelShape';
import { snapToGrid } from '../canvas/panelLayoutEngine';
import type { CanvasHost } from '../panels/host';
import {
  DEFAULT_WHITEBOARD_PANEL_REGISTRY,
  resolveWhiteboardPanelLoaders,
  type WhiteboardPanelRegistry,
} from './shapes/whiteboardPanelRegistry';
import { WhiteboardVoiceMount } from './voice/WhiteboardVoiceMount';
import { SiteActionsTool } from './tools/SiteActionsTool';
import { LayersTool } from './tools/LayersTool';
import { useWhiteboardTldrawUser } from './useWhiteboardTldrawUser';
import { useWhiteboardSnapshotSync } from './hooks/useWhiteboardSnapshotSync';
import { useContextGroupAutoResize } from './hooks/useContextGroupAutoResize';
import { usePanelDocking } from './hooks/usePanelDocking';
import { siteActionsTldrawOverrides } from './whiteboardTldrawOverrides';
import { layersTldrawOverrides } from './layersTldrawOverrides';
import { textSearchTldrawOverrides } from './textSearch/textSearchTldrawOverrides';

/** @deprecated Use `infinite-panels`. */
export type WhiteboardLayoutMode = 'infinite-panels' | 'split-column';

export interface WhiteboardShellProps {
  /** Tenant config — persona, labels, panel data. */
  config?: PartialCanvasTenantConfig;
  /**
   * Canvas host whose panel registry drives the shell. Preferred wiring:
   * register panels through `createCanvasHost({ panels })` and pass the
   * host here. Takes precedence over the deprecated `panels` prop.
   */
  host?: CanvasHost;
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
   * When true, register a "Site actions" item in tldraw's toolbar overflow menu.
   * Selecting it emits `CANVAS_SITE_ACTIONS_PANEL_EVENT` for host overlays (e.g.
   * landi-canvas-studio edit + publish bar).
   */
  enableSiteActionsTool?: boolean;
  /**
   * When true, show a floating contextual toolbar when a site context frame (or
   * panel inside it) is selected. Defaults to `enableSiteActionsTool`.
   */
  enableSiteContextToolbar?: boolean;
  /**
   * When true, register a "Layers" toolbar item and fixed-right shape tree.
   * Defaults to `true` for `infinite-panels` layout or when site-actions is enabled.
   */
  enableLayersPanel?: boolean;
  /**
   * Optional host scope (e.g. site id) appended to tldraw IndexedDB persistenceKey
   * so local + server restore stay aligned per site (Stage 10).
   */
  persistenceScope?: string;
}

const DEFAULT_CHAT_COLUMN_WIDTH = '360px';
const VIBE_CANVAS_BG = '#121212';
const CHAT_PANEL_WIDTH = 360;
const VIEWPORT_INSET = 24;

export function WhiteboardShell({
  config,
  host,
  panels = DEFAULT_WHITEBOARD_PANEL_REGISTRY,
  layout = 'infinite-panels',
  darkCanvas = false,
  hideTopBar = false,
  openChatOnMount,
  enableSiteActionsTool = false,
  enableSiteContextToolbar,
  enableLayersPanel,
  persistenceScope,
}: WhiteboardShellProps = {}): ReactElement {
  const shouldOpenChat = openChatOnMount ?? layout === 'infinite-panels';
  const shouldEnableLayersPanel =
    enableLayersPanel ?? (layout === 'infinite-panels' || enableSiteActionsTool);
  const shouldEnableSiteContextToolbar = enableSiteContextToolbar ?? enableSiteActionsTool;
  const panelLoaders = useMemo(
    () => resolveWhiteboardPanelLoaders(host, panels),
    [host, panels],
  );

  return (
    <CanvasProvider config={config}>
      <WhiteboardShellInner
        panels={panelLoaders}
        layout={layout}
        darkCanvas={darkCanvas}
        hideTopBar={hideTopBar}
        openChatOnMount={shouldOpenChat}
        enableSiteActionsTool={enableSiteActionsTool}
        enableSiteContextToolbar={shouldEnableSiteContextToolbar}
        enableLayersPanel={shouldEnableLayersPanel}
        persistenceScope={persistenceScope}
      />
    </CanvasProvider>
  );
}

interface WhiteboardShellInnerProps {
  panels: WhiteboardPanelRegistry;
  layout: WhiteboardLayoutMode;
  darkCanvas: boolean;
  hideTopBar: boolean;
  openChatOnMount: boolean;
  enableSiteActionsTool: boolean;
  enableSiteContextToolbar: boolean;
  enableLayersPanel: boolean;
  persistenceScope?: string;
}

function WhiteboardShellInner({
  panels,
  layout,
  darkCanvas,
  hideTopBar,
  openChatOnMount,
  enableSiteActionsTool,
  enableSiteContextToolbar,
  enableLayersPanel,
  persistenceScope,
}: WhiteboardShellInnerProps): ReactElement {
  const { tenant } = useCanvasConfig();
  const tldrawUser = useWhiteboardTldrawUser(darkCanvas);
  const shapeUtils = useMemo(() => [createPanelShapeUtil(panels)], [panels]);
  const tldrawUiComponents = useMemo(
    () =>
      createWhiteboardTldrawUiComponents({
        enableSiteActionsTool,
        enableSiteContextToolbar,
        enableLayersPanel,
      }),
    [enableSiteActionsTool, enableSiteContextToolbar, enableLayersPanel],
  );
  const extraTools = useMemo(() => {
    const tools = [];
    if (enableLayersPanel) tools.push(LayersTool);
    if (enableSiteActionsTool) tools.push(SiteActionsTool);
    return tools;
  }, [enableSiteActionsTool, enableLayersPanel]);
  const tldrawOverrides = useMemo((): TLUiOverrides[] | undefined => {
    const overrides: TLUiOverrides[] = [textSearchTldrawOverrides];
    if (enableLayersPanel) overrides.push(layersTldrawOverrides);
    if (enableSiteActionsTool) overrides.push(siteActionsTldrawOverrides);
    return overrides;
  }, [enableSiteActionsTool, enableLayersPanel]);
  const persistenceKey = persistenceScope
    ? `career-whiteboard-${tenant}-${persistenceScope}`
    : `career-whiteboard-${tenant}`;
  const editorRef = useRef<Editor | null>(null);
  const [boundEditor, setBoundEditor] = useState<Editor | null>(null);
  const chatOpenedRef = useRef(false);

  useWhiteboardSnapshotSync(boundEditor);
  useContextGroupAutoResize(boundEditor);
  usePanelDocking(boundEditor);

  const shellClassName = darkCanvas ? 'whiteboard-shell--vibe-dark' : undefined;
  const shellBackground = darkCanvas
    ? VIBE_CANVAS_BG
    : 'var(--landi-color-background, #F0F0EC)';

  const openInitialChatPanel = useCallback((editor: Editor) => {
    if (!openChatOnMount || chatOpenedRef.current) return;
    chatOpenedRef.current = true;
    const viewport = editor.getViewportPageBounds();
    openPanelInCanvas('chat', {
      focus: false,
      position: {
        x: snapToGrid(viewport.x + VIEWPORT_INSET),
        y: snapToGrid(viewport.y + VIEWPORT_INSET),
      },
      size: {
        w: CHAT_PANEL_WIDTH,
        h: Math.max(320, viewport.h - VIEWPORT_INSET * 2),
      },
      panelProps: { __title: 'Chat' },
    });
  }, [openChatOnMount]);

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      setBoundEditor(editor);
      configureWhiteboardSnap(editor);
      bindEditor(editor);
      if (layout === 'infinite-panels') {
        openInitialChatPanel(editor);
      }
    },
    [layout, openInitialChatPanel],
  );

  useEffect(() => {
    return () => {
      unbindEditor();
      editorRef.current = null;
      setBoundEditor(null);
      chatOpenedRef.current = false;
    };
  }, []);

  const isInfinitePanels = layout === 'infinite-panels';

  return (
    <div
      className={shellClassName}
      data-testid="whiteboard-shell"
      data-layout={layout}
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
      <WhiteboardVoiceMount />
      {!hideTopBar ? <WhiteboardTopBar /> : null}
      {isInfinitePanels ? <WhiteboardCommandPalette layout={layout} /> : null}

      {isInfinitePanels ? (
        <div
          data-testid="whiteboard-tldraw-viewport"
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
            tools={extraTools}
            persistenceKey={persistenceKey}
            shapeUtils={shapeUtils}
            user={tldrawUser}
            onMount={handleMount}
          />
        </div>
      ) : (
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
    </div>
  );
}

/** Legacy split-column layout — chat fixed left, tldraw right. */
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
  extraTools: (typeof SiteActionsTool | typeof LayersTool)[];
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
          tools={extraTools}
          persistenceKey={persistenceKey}
          shapeUtils={shapeUtils}
          user={tldrawUser}
          onMount={onMount}
        />
      </div>
    </div>
  );
}
