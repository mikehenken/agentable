/**
 * WhiteboardShell — root component for the whiteboard prototype.
 *
 * Layout: CSS Grid, two columns.
 *   • Left:  fixed-width chat column (~360px). Conversation surface lives
 *            here permanently — never moved, never closed.
 *   • Right: tldraw whiteboard. Agent tools call `openPanelInCanvas` to
 *            spawn workspace panels (open positions, job detail, resources)
 *            as draggable/resizable/scribble-able tldraw shapes.
 *
 * Why this shell exists alongside the existing `CanvasShell`:
 *   This prototype offers an alternative to absolute-positioned floating
 *   panels. It runs in parallel to the canvas substrate — both share the
 *   AI/data layer (geminiChatClient, voiceKernel, canvasTools) but disagree
 *   on the layout substrate.
 *
 * Persistence:
 *   `<Tldraw persistenceKey="...">` writes to IndexedDB automatically.
 *   The key is namespaced by tenant so test tenants don't bleed into
 *   each other.
 *
 * Editor binding:
 *   On mount we call `bindEditor(editor)` so the imperative
 *   `panelShapeApi.openPanelInCanvas(...)` driver — used by canvasTools
 *   from non-React contexts (voice callbacks, chat tool round-trips) —
 *   can resolve to a live editor. We unbind on unmount.
 *
 * Pending-request queue:
 *   `panelShapeApi` queues tool calls that arrive before the editor is
 *   bound (the canvas chunk is lazy-loaded; voice can fire its first turn
 *   during the load window). On `bindEditor`, the queue drains in arrival
 *   order — the agent never silently drops a tool call.
 */
import { useCallback, useEffect, useMemo, useRef, type ReactElement } from 'react';
import { Tldraw, type Editor } from 'tldraw';
import 'tldraw/tldraw.css';
import {
  CanvasProvider,
  useCanvasConfig,
  type PartialCanvasTenantConfig,
} from '../canvas/CanvasContext';
import { WhiteboardChatPanel } from './chat/WhiteboardChatPanel';
import { WhiteboardTopBar } from './components/WhiteboardTopBar';
import { bindEditor, unbindEditor } from './shapes/panelShapeApi';
import { createPanelShapeUtil } from './shapes/PanelShape';
import {
  DEFAULT_WHITEBOARD_PANEL_REGISTRY,
  type WhiteboardPanelRegistry,
} from './shapes/whiteboardPanelRegistry';
import { WhiteboardVoiceMount } from './voice/WhiteboardVoiceMount';

export interface WhiteboardShellProps {
  /** Tenant config. Same shape as the existing CanvasShell — system prompt,
   *  voice greeting, persona, etc. Falls back to library defaults. */
  config?: PartialCanvasTenantConfig;
  /**
   * Whiteboard panel registry. Pass a stable module-scope reference; lazy
   * components are memoised by registry identity so a fresh literal every
   * render forces re-fetch + remount of every panel. Defaults to the
   * built-in registry (empty for Day 1; populated as panels land).
   */
  panels?: WhiteboardPanelRegistry;
}

const DEFAULT_CHAT_COLUMN_WIDTH = '360px';

export function WhiteboardShell({
  config,
  panels = DEFAULT_WHITEBOARD_PANEL_REGISTRY,
}: WhiteboardShellProps = {}): ReactElement {
  return (
    <CanvasProvider config={config}>
      <WhiteboardShellInner panels={panels} />
    </CanvasProvider>
  );
}

function WhiteboardShellInner({
  panels,
}: {
  panels: WhiteboardPanelRegistry;
}): ReactElement {
  const { tenant } = useCanvasConfig();

  // Build the shape util once, captured against the registry. tldraw treats
  // shapeUtils as identity-stable; we memoise on the registry reference so
  // a stable module-scope registry yields one util for the editor lifetime.
  const shapeUtils = useMemo(() => [createPanelShapeUtil(panels)], [panels]);

  // Persistence key namespaced by tenant. tldraw writes the document state
  // to IndexedDB under this key; switching tenants gives a fresh canvas
  // instead of bleeding state across tenants.
  const persistenceKey = `career-whiteboard-${tenant}`;

  const editorRef = useRef<Editor | null>(null);

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
    bindEditor(editor);
  }, []);

  // Unbind on unmount. We don't unbind on hot-reload of the registry —
  // tldraw keeps the same editor and we want queued requests to keep
  // flowing.
  useEffect(() => {
    return () => {
      unbindEditor();
      editorRef.current = null;
    };
  }, []);

  return (
    <div
      // Outer flex column: TopBar (fixed height) + grid below (chat + tldraw).
      // The shell renders inside a host-supplied flex container
      // (CareerWhiteboardPage → CareerWhiteboard → here), so we claim the
      // full main-axis via `width: 100%` + `flex: 1`. Without `width: 100%`
      // on a grid-display child of a flex parent, the intrinsic grid sizing
      // collapses the `1fr` track to 0px and the tldraw zone goes invisible.
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        flex: 1,
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        background: 'var(--landi-color-background, #F0F0EC)',
        overflow: 'hidden',
      }}
    >
      {/* Side-effect mount: registers the voice transport against the
          kernel so the TopBar's <VoiceChip> can toggle calls. Renders null. */}
      <WhiteboardVoiceMount />

      <WhiteboardTopBar />

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
          }}
        >
          <Tldraw
            // Tldraw's default toolbar IS visible — it's load-bearing for
            // the prototype because it surfaces the pen tool, which is the
            // user-facing differentiator vs the legacy canvas. A future
            // pass may slim this down via tldraw's component overrides.
            hideUi={false}
            persistenceKey={persistenceKey}
            shapeUtils={shapeUtils}
            onMount={handleMount}
          />
        </div>
      </div>
    </div>
  );
}

