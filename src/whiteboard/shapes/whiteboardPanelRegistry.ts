/**
 * whiteboardPanelRegistry — maps panelId → React component loader for
 * the whiteboard substrate.
 *
 * Mirrors the existing `canvas/panelImports.ts` model (lazy() loader per
 * panel id) but feeds the tldraw `PanelShapeUtil` instead of the absolute-
 * positioned `<DraggablePanel>` substrate.
 *
 * Day 1 ships an empty registry — the substrate proves itself with a
 * placeholder body. Day 2 adds `open-positions`; Day 3 adds `job-detail` +
 * `resources`.
 *
 * Each loader resolves to the panel's *content* component (no DraggablePanel
 * wrapper), since tldraw owns the chrome via `PanelShape.component()`. Most
 * existing panels already separate body markup from the wrapper — we re-use
 * them by importing the inner component directly.
 *
 * Stable-reference contract (same as `panelImports.ts`): the consumer passes
 * the registry once at mount; `useLazyPanel` memoises lazy components keyed
 * by registry identity. Define module-scope; never inline-literal.
 */
import type { ComponentType } from 'react';

/** A `React.lazy()`-compatible loader. */
export type WhiteboardPanelLoader = () => Promise<{
  default: ComponentType<WhiteboardPanelProps>;
}>;

/**
 * Props every whiteboard panel component receives. Shape-scoped data lives
 * under `data` (passed through from `openPanelInCanvas({ panelProps })`);
 * cross-panel agent intents (selectedJobId, search, artifacts) live in the
 * shared `panelIntentStore`. Panels read whichever applies.
 */
export interface WhiteboardPanelProps {
  /** The shape-scoped `data` blob, set via `panelShapeApi`. */
  data?: Record<string, unknown>;
  /** Best-effort signal that the panel is hosted inside a tldraw shape vs.
   * a regular React tree. Lets components elide chrome they don't need
   * (their own title bar, drag handles, etc). */
  hostedInWhiteboard?: boolean;
}

/** Map of panel id → lazy loader. */
export type WhiteboardPanelRegistry = Record<string, WhiteboardPanelLoader>;

/**
 * Default registry. Example career-themed loaders — same arrangement as
 * the existing `canvas/panelImports.ts` `DEFAULT_PANEL_REGISTRY`. Tenant
 * wrappers supply their own via `<WhiteboardShell registry={...}>`.
 *
 * Each loader resolves to the panel's content component. The component
 * MUST honour `hostedInWhiteboard` (skip its own DraggablePanel wrapper)
 * so the tldraw shape doesn't double up chrome.
 *
 * Day 2: open-positions
 * Day 3: job-detail, resources
 */
export const DEFAULT_WHITEBOARD_PANEL_REGISTRY = {
  'open-positions': () =>
    import('../../canvas/OpenPositionsPanel').then((m) => ({
      default:
        m.OpenPositionsPanel as unknown as ComponentType<WhiteboardPanelProps>,
    })),
  resources: () =>
    import('../../canvas/ResourcesPanel').then((m) => ({
      default:
        m.ResourcesPanel as unknown as ComponentType<WhiteboardPanelProps>,
    })),
} satisfies WhiteboardPanelRegistry;
