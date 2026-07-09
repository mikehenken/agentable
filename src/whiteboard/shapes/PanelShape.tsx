/**
 * @docs/development/ARCHITECTURE.md
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
import { Suspense, useEffect, useRef, type ReactElement } from 'react';
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  track,
  useEditor,
  useValue,
  type RecordProps,
  type TLBaseShape,
} from 'tldraw';
import { PanelChrome } from './PanelChrome';
import {
  attachPanelScrollWheelIsolation,
  panelCapturesHorizontalWheel,
} from './panelScrollWheel';
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
const PANEL_INDICATOR_STROKE = 'rgba(255, 140, 122, 0.55)';
const PANEL_INDICATOR_STROKE_WIDTH = 1.5;

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
    /** Wheel scroll is handled selectively via panelScrollWheel capture — never block canvas pan/zoom globally. */
    override canScroll(_shape: PanelShape): boolean {
      return false;
    }

    override canResize(_shape: PanelShape): boolean {
      return true;
    }

    /** Aspect ratio is NOT locked — panels are arbitrary content surfaces. */
    override isAspectRatioLocked(_shape: PanelShape): boolean {
      return false;
    }

    /** Corner + edge snap points for panel-to-panel alignment (tldraw custom snapping). */
    override getBoundsSnapGeometry(shape: PanelShape) {
      const { w, h } = shape.props;
      return {
        points: [
          { x: 0, y: 0 },
          { x: w / 2, y: 0 },
          { x: w, y: 0 },
          { x: 0, y: h / 2 },
          { x: w / 2, y: h / 2 },
          { x: w, y: h / 2 },
          { x: 0, y: h },
          { x: w / 2, y: h },
          { x: w, y: h },
        ],
      };
    }

    override component(shape: PanelShape): ReactElement {
      return <PanelShapeBody shape={shape} registry={registry} />;
    }

    override indicator(shape: PanelShape): ReactElement {
      return <PanelShapeIndicator shape={shape} />;
    }

    override getText(shape: PanelShape): string | undefined {
      const parts: string[] = [];
      if (shape.props.panelId.trim()) {
        parts.push(shape.props.panelId);
      }
      const title = shape.props.data.__title;
      if (typeof title === 'string' && title.trim()) {
        parts.push(title);
      }
      for (const [key, value] of Object.entries(shape.props.data)) {
        if (key.startsWith('__')) continue;
        if (typeof value === 'string' && value.trim()) {
          parts.push(value);
        }
      }
      const metaName = shape.meta.name;
      if (typeof metaName === 'string' && metaName.trim()) {
        parts.push(metaName);
      }
      return parts.length > 0 ? parts.join(' ') : undefined;
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

const PanelShapeIndicator = track(function PanelShapeIndicator({
  shape,
}: {
  shape: PanelShape;
}): ReactElement {
  const editor = useEditor();
  const showOutline = useValue(
    'panelIndicator',
    () => {
      const selectedIds = editor.getSelectedShapeIds();
      if (selectedIds.includes(shape.id)) return true;
      const onlySelected = editor.getOnlySelectedShape();
      if (!onlySelected || onlySelected.id !== shape.id) return false;
      const toolId = editor.getCurrentToolId();
      return toolId === 'select' || toolId.startsWith('select.');
    },
    [editor, shape.id],
  );

  if (!showOutline) {
    return <g />;
  }

  return (
    <rect
      width={shape.props.w}
      height={shape.props.h}
      rx={12}
      ry={12}
      fill="none"
      stroke={PANEL_INDICATOR_STROKE}
      strokeWidth={PANEL_INDICATOR_STROKE_WIDTH}
    />
  );
});

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
  const noBorder = Boolean(data.__noBorder);
  const fullBleed = Boolean(data.__fullBleed);
  const hideChrome = Boolean(data.__hideChrome) || fullBleed;
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const captureHorizontalWheel = panelCapturesHorizontalWheel(panelId);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || isMinimized) return undefined;
    return attachPanelScrollWheelIsolation(el, { captureHorizontalWheel });
  }, [isMinimized, panelId, captureHorizontalWheel]);

  const edgeToEdge = noBorder || fullBleed;

  return (
    <HTMLContainer
      ref={rootRef}
      data-testid={`panel-shape-${panelId}`}
      className={[
        'panel-shape',
        fullBleed ? 'panel-shape--full-bleed' : 'panel-shape--chrome',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        width: shape.props.w,
        height: isMinimized ? TITLE_BAR_HEIGHT : shape.props.h,
        display: 'flex',
        flexDirection: 'column',
        background: fullBleed
          ? 'var(--landi-color-background, #121212)'
          : 'var(--landi-color-surface, #1f1f1f)',
        border: edgeToEdge ? 'none' : '1px solid var(--landi-color-border, #3a3a3a)',
        borderRadius: edgeToEdge ? 0 : 12,
        boxShadow: edgeToEdge ? 'none' : '0 8px 24px rgb(0 0 0 / 0.35)',
        overflow: 'hidden',
        // Pointer events on the container itself flow to tldraw — that's
        // how the user grabs the shape. The body div below intercepts
        // events for interactive content.
        pointerEvents: 'all',
      }}
    >
      {!hideChrome ? (
        <PanelChrome panelId={panelId} title={title} minimized={isMinimized} />
      ) : null}

      {!isMinimized && (
        <div
          ref={bodyRef}
          className="panel-shape__body"
          data-full-bleed={fullBleed ? 'true' : undefined}
          data-panel-id={panelId || undefined}
          // Body wrapper. Stops pointer/wheel events so panel inputs scroll
          // & receive focus normally without fighting tldraw's pan/zoom.
          // `touchAction: 'pan-y'` opts the body out of tldraw's pinch
          // gesture so mobile users can scroll inside without the canvas
          // also zooming.
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: fullBleed ? 'hidden' : 'auto',
            touchAction: 'pan-y',
            background: fullBleed ? 'transparent' : 'var(--landi-color-surface, #1f1f1f)',
          }}
        >
          <div className="panel-shape__content">
            {Lazy ? (
              <Suspense fallback={<PanelLoadingPlaceholder />}>
                <Lazy data={data} hostedInWhiteboard />
              </Suspense>
            ) : (
              <PanelMissingPlaceholder panelId={panelId} />
            )}
          </div>
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
