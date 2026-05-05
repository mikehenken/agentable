/**
 * PanelShape — tldraw custom shape that renders one of the workspace
 * panels (open positions, job detail, resources, etc.) inside the
 * whiteboard.
 *
 * Architecture:
 *   - `BaseBoxShapeUtil` gives us the box-shape primitives (resize,
 *     selection, page bounds) for free.
 *   - `<HTMLContainer>` is tldraw's escape hatch for rendering React inside
 *     a shape's bounding box. Anything inside it lives in the host DOM
 *     (NOT inside an SVG), so it gets normal CSS, normal accessibility,
 *     and normal pointer events.
 *
 * Pointer-event boundary:
 *   - Title bar (PanelChrome) lets pointer events through → tldraw can
 *     drag the shape by its title. Buttons inside the chrome
 *     stopPropagation individually so close/minimize don't trigger drags.
 *   - Body wraps its children in `pointerEvents: 'all'` + a wheel/pointer
 *     stopPropagation so panel inputs, scroll, and clicks work without
 *     fighting tldraw's pan/zoom gesture pipeline.
 *
 * Registry flow:
 *   - The shape stores `panelId` in its props (the only piece of identity
 *     it needs).
 *   - `useLazyPanel(registry, panelId)` returns a `React.lazy()` component
 *     for the registered panel; if the id isn't registered, we fall back
 *     to a placeholder so the user sees a friendly card instead of a
 *     thrown error.
 *
 * Panel data:
 *   - `props.data` is a free-form bag passed in via
 *     `openPanelInCanvas({ panelProps })`. The shape util forwards it to
 *     the panel component as a prop.
 *   - `props.data.__minimized` is reserved for the chrome's minimise
 *     toggle so the shape can show only the title bar without the body.
 */
import { Suspense, type ReactElement } from 'react';
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  type RecordProps,
  type TLBaseShape,
} from 'tldraw';
import { PanelChrome } from './PanelChrome';
import { useLazyPanel } from './useLazyPanel';
import {
  DEFAULT_WHITEBOARD_PANEL_REGISTRY,
  type WhiteboardPanelRegistry,
} from './whiteboardPanelRegistry';

/**
 * Custom shape type. Width/height are mandatory for any tldraw box-shape.
 * `panelId` selects the registered panel component. `minimized` toggles
 * the body. `data` is the shape-scoped prop bag used by panel components.
 */
export type PanelShape = TLBaseShape<
  'panel',
  {
    w: number;
    h: number;
    panelId: string;
    minimized: boolean;
    data: Record<string, unknown>;
  }
>;

const TITLE_BAR_HEIGHT = 32;

/**
 * Build a `BaseBoxShapeUtil<PanelShape>` subclass with the registry
 * captured in closure. We accept the registry up-front so the shape util
 * stays a pure subclass — tldraw instantiates it once per editor and we
 * don't want to thread the registry through every shape render.
 *
 * The default export is a registry-less util (uses
 * `DEFAULT_WHITEBOARD_PANEL_REGISTRY`). Callers wanting a custom registry
 * should call `createPanelShapeUtil(registry)` and pass the returned class
 * to `<Tldraw shapeUtils={[...]}>`.
 */
export function createPanelShapeUtil(
  registry: WhiteboardPanelRegistry = DEFAULT_WHITEBOARD_PANEL_REGISTRY,
) {
  class PanelShapeUtil extends BaseBoxShapeUtil<PanelShape> {
    static override type = 'panel' as const;
    static override props: RecordProps<PanelShape> = {
      w: T.number,
      h: T.number,
      panelId: T.string,
      minimized: T.boolean,
      // Shape-scoped panel data. `T.unknownObject` accepts any
      // `Record<string, unknown>` — exact match for our props declaration.
      // tldraw needs props JSON-serialisable for persistence; callers of
      // `openPanelInCanvas({ panelProps })` are responsible for keeping
      // values serialisable (no functions, DOM nodes, etc).
      data: T.unknownObject,
    };

    override getDefaultProps(): PanelShape['props'] {
      return {
        w: 480,
        h: 540,
        panelId: '',
        minimized: false,
        data: {},
      };
    }

    /** Whether tldraw can resize this shape. Day 1: yes — the user expects
     *  to grab corners and stretch panels. Day 3 may pin specific shapes
     *  (e.g. the voice shape) by overriding via shape data. */
    override canResize(_shape: PanelShape): boolean {
      return true;
    }

    /** Aspect ratio is NOT locked — panels are arbitrary content surfaces. */
    override isAspectRatioLocked(_shape: PanelShape): boolean {
      return false;
    }

    override component(shape: PanelShape): ReactElement {
      return <PanelShapeBody shape={shape} registry={registry} />;
    }

    override indicator(shape: PanelShape): ReactElement {
      // Selection outline drawn by tldraw — slightly inset so the visible
      // panel border isn't doubled.
      return (
        <rect
          width={shape.props.w}
          height={shape.props.h}
          rx={12}
          ry={12}
          fill="none"
        />
      );
    }
  }

  return PanelShapeUtil;
}

/**
 * Default shape util bound to the default (empty) registry. Most callers
 * use `createPanelShapeUtil(myRegistry)` instead — this default exists so
 * unit tests and minimal embeds can mount the shape util without supplying
 * a registry.
 */
export const PanelShapeUtil = createPanelShapeUtil();

interface PanelShapeBodyProps {
  shape: PanelShape;
  registry: WhiteboardPanelRegistry;
}

/**
 * Render body. Split out from the util class so the React hook
 * (`useLazyPanel`) sits in a function component, not a method.
 */
function PanelShapeBody({ shape, registry }: PanelShapeBodyProps): ReactElement {
  const { panelId, data, minimized } = shape.props;
  const Lazy = useLazyPanel(registry, panelId);
  const title = (data.__title as string | undefined) ?? friendlyTitle(panelId);
  const isMinimized = minimized || Boolean(data.__minimized);

  return (
    <HTMLContainer
      style={{
        width: shape.props.w,
        height: isMinimized ? TITLE_BAR_HEIGHT : shape.props.h,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--landi-color-surface, #FFFFFF)',
        border: '1px solid var(--landi-color-border, #E5E5E0)',
        borderRadius: 12,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
        // Pointer events on the container itself flow to tldraw — that's
        // how the user grabs the shape. The body div below intercepts
        // events for interactive content.
        pointerEvents: 'all',
      }}
    >
      <PanelChrome panelId={panelId} title={title} minimized={isMinimized} />

      {!isMinimized && (
        <div
          // Body wrapper. Stops pointer/wheel events so panel inputs scroll
          // & receive focus normally without fighting tldraw's pan/zoom.
          // `touchAction: 'pan-y'` opts the body out of tldraw's pinch
          // gesture so mobile users can scroll inside without the canvas
          // also zooming.
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            touchAction: 'pan-y',
            background: 'var(--landi-color-surface, #FFFFFF)',
          }}
        >
          {Lazy ? (
            <Suspense fallback={<PanelLoadingPlaceholder />}>
              <Lazy data={data} hostedInWhiteboard />
            </Suspense>
          ) : (
            <PanelMissingPlaceholder panelId={panelId} />
          )}
        </div>
      )}
    </HTMLContainer>
  );
}

function PanelLoadingPlaceholder(): ReactElement {
  return (
    <div
      style={{
        padding: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--landi-color-text-muted, #6B6B66)',
        fontSize: 13,
      }}
    >
      Loading…
    </div>
  );
}

function PanelMissingPlaceholder({ panelId }: { panelId: string }): ReactElement {
  return (
    <div
      style={{
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        height: '100%',
        color: 'var(--landi-color-text-muted, #6B6B66)',
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, color: 'var(--landi-color-text, #1A1A1A)' }}>
        Panel not registered
      </div>
      <div>
        No whiteboard panel registered for id <code>{panelId || '(empty)'}</code>.
      </div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>
        Whiteboard MVP — Day 1 substrate. Panels register in Day 2+.
      </div>
    </div>
  );
}

function friendlyTitle(panelId: string): string {
  if (!panelId) return 'Panel';
  return panelId
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}
