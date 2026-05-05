import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  DEFAULT_PANEL_REGISTRY,
  prefetchAllPanelsIdle,
  type PanelRegistry,
} from './panelImports';
import { DEFAULT_NAV_ITEMS, type NavItemConfig } from './navItems';
import { CanvasChromeProvider } from './CanvasChromeContext';
import { TopBar } from './TopBar';
import { FloatingToolbar } from './FloatingToolbar';
import { NavSidebar } from './NavSidebar';
// Eager panels — load-bearing for first paint. ChatPanel renders on first
// mount (empty state with starter prompts); ArtifactsPanel + VoiceWidget
// receive content from the active conversation. Keeping these in the main
// chunk avoids a Suspense flash on the canvas's primary surface.
import { ChatPanel } from './ChatPanel';
import { ArtifactsPanel } from './ArtifactsPanel';
import { VoiceWidget } from './VoiceWidget';
import { BottomBar } from './BottomBar';
import { ChunkErrorBoundary } from './ChunkErrorBoundary';
import { useLayoutStore } from '../stores/layoutStore';
import {
  CanvasProvider,
  type PartialCanvasTenantConfig,
} from './CanvasContext';

export interface CanvasShellProps {
  /**
   * Optional tenant config (system prompt, voice greeting, tenant id, etc).
   * Deeply partial — every field falls back to the library default.
   * Tenants supply their own via the wrapper they choose to publish.
   */
  config?: PartialCanvasTenantConfig;
  /**
   * Lazy panel registry. Each entry's loader gets wrapped in `React.lazy`
   * and rendered inside a Suspense + ChunkErrorBoundary boundary. Defaults
   * to `DEFAULT_PANEL_REGISTRY` (an example career-themed configuration —
   * tenants typically replace it).
   *
   * IMPORTANT: pass a stable reference (module-scope `const`, NOT a fresh
   * object literal per render). The lazy wrapping is memoized on registry
   * identity — a fresh object every render re-creates the lazy components,
   * breaks chunk caching, and remounts panel state.
   */
  panels?: PanelRegistry;
  /**
   * Sidebar nav items. Mirrors `panels` — tenant-supplied so OSS chrome
   * carries zero baked-in domain. Each item points at a `panelId` to open
   * and (optionally) a `prefetchKey` matching a `panels` registry key for
   * hover/focus chunk warm-up. Defaults to `DEFAULT_NAV_ITEMS` (career-
   * themed, vestigial like the panel default).
   *
   * Same stability contract as `panels`: define at module scope.
   */
  navItems?: NavItemConfig[];
}

export function CanvasShell({
  config,
  panels = DEFAULT_PANEL_REGISTRY,
  navItems = DEFAULT_NAV_ITEMS,
}: CanvasShellProps = {}) {
  return (
    <CanvasProvider config={config}>
      <CanvasChromeProvider panels={panels} navItems={navItems}>
        <CanvasShellInner panels={panels} />
      </CanvasChromeProvider>
    </CanvasProvider>
  );
}

function CanvasShellInner({ panels }: { panels: PanelRegistry }) {
  const { pan, panBy, resetPan } = useLayoutStore();
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Dev-only: warn if `panels` reference identity changes after mount —
  // that's the inline-literal footgun the prop documentation flags. Memo
  // dep would still hit the cache-bust path and we'd see chunk-refetch +
  // panel state loss; this surfaces it loudly rather than silently.
  const initialPanelsRef = useRef(panels);
  useEffect(() => {
    if (
      typeof process !== 'undefined' &&
      process.env?.NODE_ENV !== 'production' &&
      panels !== initialPanelsRef.current
    ) {
      // eslint-disable-next-line no-console
      console.error(
        '[CanvasShell] `panels` prop reference changed after mount. ' +
          'Define the registry at module scope (NOT inline in JSX) — every ' +
          'change re-creates lazy components, refetches chunks, and remounts panel state.',
      );
    }
  }, [panels]);

  // Wrap each loader in `React.lazy`, memoized on registry identity so a
  // stable module-scope registry yields one set of lazy components for
  // the canvas mount lifetime.
  const lazyPanels = useMemo(
    () =>
      Object.entries(panels).map(([id, loader]) => ({
        id,
        Lazy: lazy(loader),
      })),
    [panels],
  );

  // Idle-warm every lazy panel chunk after first paint. Cancel fn cleans
  // the idle handle on unmount or registry change.
  useEffect(() => {
    return prefetchAllPanelsIdle(panels);
  }, [panels]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.button !== 0) return;
    // Block browser scroll / rubber-band overscroll while panning the board
    // (especially fullscreen or 100dvh routes on macOS / iOS).
    e.preventDefault();
    isPanning.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning.current) return;
      e.preventDefault();
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      panBy(dx, dy);
    },
    [panBy],
  );

  const endPan = useCallback(() => {
    isPanning.current = false;
  }, []);

  const handleDoubleClick = useCallback(() => {
    resetPan();
  }, [resetPan]);

  return (
    <div
      className="h-full w-full overflow-hidden relative select-none agentable-canvas-root"
      style={{
        backgroundColor: 'var(--landi-color-workspace-bg, #F5F5F2)',
        backgroundImage:
          'radial-gradient(circle, var(--landi-color-workspace-dot, #D0D0CC) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        overscrollBehavior: 'none',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px)`,
          overscrollBehavior: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onLostPointerCapture={endPan}
        onDoubleClick={handleDoubleClick}
      >
        <ChatPanel />
        <ArtifactsPanel />
        <VoiceWidget />
        {/*
          Lazy panels — Suspense fallback is null because each panel
          returns null when its layout state is hidden. ChunkErrorBoundary
          catches `React.lazy` chunk-load failures (network blip, CDN 503,
          stale chunk hash post-deploy).
        */}
        <ChunkErrorBoundary>
          <Suspense fallback={null}>
            {lazyPanels.map(({ id, Lazy }) => (
              <Lazy key={id} />
            ))}
          </Suspense>
        </ChunkErrorBoundary>
      </div>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 100 }}
      >
        <TopBar />
        <FloatingToolbar />
        <NavSidebar />
        <BottomBar />
      </div>
    </div>
  );
}
