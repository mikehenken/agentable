/**
 * @docs/development/ARCHITECTURE.md
 * PanelShape - tldraw custom shape that renders one of the workspace
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
 *   - Chrome behaviour (title, minimize, hideChrome, fullBleed, noBorder)
 *     resolves through `resolvePanelChrome`: typed options under
 *     `data.chrome` are the source of truth, with the legacy reserved
 *     `__*` keys still readable for documents older hosts wrote.
 */
import { useCallback, useEffect, useRef, type ReactElement } from 'react';
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  track,
  useEditor,
  useValue,
  type HTMLContainerProps,
  type RecordProps,
  type TLBaseShape,
} from 'tldraw';
import { resolvePanelChrome } from '../../../panels/chrome';
import {
  isComposedEphemeral,
  isPanelPinned,
  shouldShowProvenanceBadge,
} from '../../../panels/provenance';
import { hasComposedSpecData } from '../../../panels/provenance/ComposedSpecPanel';
import { PanelApprovalLayer } from '../../../panels/approval/PanelApprovalLayer';
import { PanelChrome } from './PanelChrome';
import {
  attachIframeWheelGuards,
  attachPanelScrollWheelIsolation,
} from './panelScrollWheel';
import { WhiteboardPanelShapeContent } from './WhiteboardPanelShapeContent';
import {
  DEFAULT_WHITEBOARD_PANEL_REGISTRY,
  type WhiteboardPanelRegistry,
} from './whiteboardPanelRegistry';

/**
 * Props for the custom 'panel' shape. Width/height are mandatory for any
 * tldraw box-shape. `panelId` selects the registered panel component.
 * `minimized` toggles the body. `data` is the shape-scoped prop bag used
 * by panel components.
 */
export interface PanelShapeProps {
  w: number;
  h: number;
  panelId: string;
  minimized: boolean;
  data: Record<string, unknown>;
}

/**
 * Register 'panel' in tldraw's shape union. TLGlobalShapePropsMap is the
 * documented augmentation point: TLIndexedShapes maps over its keys, so
 * `shape.type === 'panel'` narrows to PanelShape everywhere instead of
 * `never`, and createShape/updateShape accept `type: 'panel'` partials.
 */
declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    panel: PanelShapeProps;
  }
}

export type PanelShape = TLBaseShape<'panel', PanelShapeProps>;

const TITLE_BAR_HEIGHT = 32;
const PANEL_INDICATOR_STROKE = 'rgba(255, 140, 122, 0.55)';
const PANEL_INDICATOR_STROKE_WIDTH = 1.5;

/** True when the event target is interactive panel content (not a tldraw drag/resize hit). */
function panelBodyShouldCapturePointer(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (
    target.closest(
      [
        '.panel-shape__drag-rail',
        '.panel-shape__drag-handle',
        '.draft-preview-panel__header',
        '.panel-chrome',
      ].join(', '),
    )
  ) {
    return false;
  }
  return Boolean(
    target.closest(
      [
        'iframe',
        'button',
        'input',
        'textarea',
        'select',
        'a',
        '[contenteditable="true"]',
        '[data-panel-interactive]',
        '.panel-tab-bar',
        '.draft-preview-panel__add-tab',
        '.draft-preview-panel__body',
        '.panel-shape__content',
      ].join(', '),
    ),
  );
}

/**
 * True when a keyboard event targets an editable control inside the panel.
 *
 * tldraw registers its shortcut handler on the canvas container in the bubble
 * phase and decides whether to skip based on `document.activeElement`. In a
 * shadow-DOM embed `document.activeElement` resolves to the shadow host, not
 * the focused panel textarea, so tldraw never skips and treats plain typing
 * ("d" for the draw tool, space for the hand tool, etc.) as tool shortcuts.
 * Stopping propagation on the panel body (a descendant of that container)
 * before the keydown bubbles up keeps the keystroke in the input.
 */
import { editableTargetShouldCaptureKey as panelBodyShouldCaptureKey } from '../../../shared/editableKeyboardTarget';

/**
 * Build a `BaseBoxShapeUtil<PanelShape>` subclass with the registry
 * captured in closure. We accept the registry up-front so the shape util
 * stays a pure subclass - tldraw instantiates it once per editor and we
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
      // `Record<string, unknown>` - exact match for our props declaration.
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

    /** Whether tldraw can resize this shape. Day 1: yes - the user expects
     *  to grab corners and stretch panels. Day 3 may pin specific shapes
     *  (e.g. the voice shape) by overriding via shape data. */
    /** Wheel scroll is handled selectively via panelScrollWheel capture - never block canvas pan/zoom globally. */
    override canScroll(_shape: PanelShape): boolean {
      return false;
    }

    override canResize(_shape: PanelShape): boolean {
      return true;
    }

    /** Aspect ratio is NOT locked - panels are arbitrary content surfaces. */
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
      const title = resolvePanelChrome(shape.props.data).title;
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
 * use `createPanelShapeUtil(myRegistry)` instead - this default exists so
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
  const editor = useEditor();
  const { panelId, data, minimized } = shape.props;
  const chrome = resolvePanelChrome(data);
  const title = chrome.title ?? friendlyTitle(panelId);
  const isMinimized = minimized || chrome.minimized === true;
  const showProvenanceBadge = shouldShowProvenanceBadge(data);
  const showPinButton = isComposedEphemeral(data);
  const pinned = isPanelPinned(data);
  const composedSpec = hasComposedSpecData(data);
  const noBorder = chrome.noBorder === true;
  const fullBleed = chrome.fullBleed === true;
  const hideChrome = chrome.hideChrome === true || fullBleed;
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const activatePanelStack = useCallback(() => {
    editor.select(shape.id);
    editor.bringToFront([shape.id]);
  }, [editor, shape.id]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || isMinimized) return undefined;
    return attachPanelScrollWheelIsolation(el);
  }, [isMinimized, panelId]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || isMinimized) return undefined;
    const onFocusIn = (e: FocusEvent) => {
      // tldraw only listens for keyboard shortcuts while the editor is
      // focused, and its skip-check reads `document.activeElement` (which in
      // a shadow-DOM embed is the host element, never the inner textarea).
      // Blurring the editor when a panel input takes focus detaches that
      // listener, so typing "d", space, etc. types text instead of switching
      // the canvas tool. `editor.blur()` only blurs the canvas container, not
      // the focused input, so typing and the input's own Enter-to-submit keep
      // working. tldraw refocuses the canvas on the next pointer interaction.
      if (panelBodyShouldCaptureKey(e.target)) editor.blur();
    };
    const onFocusOut = (e: FocusEvent) => {
      // Hand keyboard control back to the canvas when focus moves from the
      // panel's editable content to a non-editable element still inside the
      // canvas container (not when tabbing between two inputs, and not when
      // focus leaves the embed entirely, so the widget never steals focus
      // from the host page).
      const next = e.relatedTarget;
      if (
        next instanceof Node &&
        editor.getContainer().contains(next) &&
        !panelBodyShouldCaptureKey(next)
      ) {
        editor.focus();
      }
    };
    el.addEventListener('focusin', onFocusIn);
    el.addEventListener('focusout', onFocusOut);
    return () => {
      el.removeEventListener('focusin', onFocusIn);
      el.removeEventListener('focusout', onFocusOut);
    };
  }, [editor, isMinimized, panelId]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || isMinimized) return undefined;
    return attachIframeWheelGuards(el);
  }, [isMinimized, panelId]);

  const edgeToEdge = noBorder || fullBleed;

  // tldraw's HTMLContainer spreads its rest props onto the underlying <div>,
  // so under React 19 `ref` flows through as a regular prop. Its declared
  // HTMLAttributes type predates ref-as-prop; widen it once here rather than
  // wrapping the container in an extra DOM node.
  const PanelHTMLContainer = HTMLContainer as (
    props: HTMLContainerProps & { ref?: React.Ref<HTMLDivElement> },
  ) => ReactElement;

  return (
    <PanelHTMLContainer
      ref={rootRef}
      data-testid={`panel-shape-${panelId}`}
      className={[
        'panel-shape',
        fullBleed ? 'panel-shape--full-bleed' : 'panel-shape--chrome',
      ]
        .filter(Boolean)
        .join(' ')}
      onPointerDownCapture={() => {
        activatePanelStack();
      }}
      style={{
        width: shape.props.w,
        height: isMinimized ? TITLE_BAR_HEIGHT : shape.props.h,
        display: 'flex',
        flexDirection: 'column',
        background: fullBleed
          ? 'var(--landi-color-background, #F0F0EC)'
          : 'var(--landi-color-surface, #FFFFFF)',
        border: edgeToEdge ? 'none' : '1px solid var(--landi-color-border, #E5E5E0)',
        borderRadius: edgeToEdge ? 0 : 12,
        boxShadow: edgeToEdge ? 'none' : 'var(--landi-shadow-md, 0 4px 12px rgba(0,0,0,0.06))',
        overflow: 'hidden',
        // Pointer events on the container itself flow to tldraw - that's
        // how the user grabs the shape. The body div below intercepts
        // events for interactive content.
        pointerEvents: 'all',
      }}
    >
      {!hideChrome ? (
        <>
          <PanelChrome
            panelId={panelId}
            title={title}
            minimized={isMinimized}
            showProvenanceBadge={showProvenanceBadge}
            showPinButton={showPinButton}
            pinned={pinned}
          />
          <PanelApprovalLayer panelId={panelId} />
        </>
      ) : (
        <div
          className="panel-shape__drag-rail"
          data-panel-drag-handle="true"
          aria-label="Drag panel"
          title="Drag to move panel"
          onPointerDown={() => {
            activatePanelStack();
          }}
        />
      )}

      {!isMinimized && (
        <div
          ref={bodyRef}
          className="panel-shape__body landi-overlay-scroll"
          data-full-bleed={fullBleed ? 'true' : undefined}
          data-panel-id={panelId || undefined}
          // Body wrapper. Stops pointer/wheel events so panel inputs scroll
          // & receive focus normally without fighting tldraw's pan/zoom.
          // `touchAction: 'pan-y'` opts the body out of tldraw's pinch
          // gesture so mobile users can scroll inside without the canvas
          // also zooming.
          onPointerDown={(e) => {
            if (panelBodyShouldCapturePointer(e.target)) e.stopPropagation();
          }}
          onPointerMove={(e) => {
            if (panelBodyShouldCapturePointer(e.target)) e.stopPropagation();
          }}
          onPointerUp={(e) => {
            if (panelBodyShouldCapturePointer(e.target)) e.stopPropagation();
          }}
          style={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: fullBleed ? 'hidden' : 'auto',
            overscrollBehavior: 'contain',
            touchAction: 'pan-y',
            background: fullBleed ? 'transparent' : 'var(--landi-color-surface, #FFFFFF)',
          }}
        >
          <div className="panel-shape__content">
            <WhiteboardPanelShapeContent
              panelId={panelId}
              data={data}
              registry={registry}
              composedSpec={composedSpec}
            />
          </div>
        </div>
      )}
    </PanelHTMLContainer>
  );
}

function friendlyTitle(panelId: string): string {
  if (!panelId) return 'Panel';
  return panelId
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}
