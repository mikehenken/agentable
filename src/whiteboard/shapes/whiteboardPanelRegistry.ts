/**
 * @docs/development/ARCHITECTURE.md
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
import type { CanvasHost } from '../../panels/host';
import { reactPanelDefinitions } from '../../panels/registry';
import type { PanelDefinition } from '../../panels/types';

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
 * wrappers supply their own panels through `createCanvasHost({ panels })`
 * (or the deprecated `<WhiteboardShell panels={...}>` alias).
 *
 * Each loader resolves to the panel's content component. The component
 * MUST honour `hostedInWhiteboard` (skip its own DraggablePanel wrapper)
 * so the tldraw shape doesn't double up chrome.
 *
 * Day 2: open-positions
 * Day 3: job-detail, resources
 */
export const DEFAULT_WHITEBOARD_PANEL_REGISTRY = {
  chat: () =>
    import('../chat/WhiteboardChatPanel').then((m) => ({
      default: m.WhiteboardChatPanel,
    })),
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
  'growth-paths': () =>
    import('../../canvas/GrowthPathsPanel').then((m) => ({
      default:
        m.GrowthPathsPanel as unknown as ComponentType<WhiteboardPanelProps>,
    })),
} satisfies WhiteboardPanelRegistry;

const loaderMapByDefinitions = new WeakMap<
  readonly PanelDefinition[],
  WhiteboardPanelRegistry
>();

/**
 * Project registry definitions onto the loader map the panel shape util
 * consumes. Only `kind: 'react'` entries carry a loader; spec-tier
 * definitions have no component to mount here and are skipped. Results
 * are cached by definitions identity so `useLazyPanel`'s per-registry
 * memoisation keeps holding across shell remounts.
 */
export function whiteboardLoadersForDefinitions(
  definitions: readonly PanelDefinition[],
): WhiteboardPanelRegistry {
  const cached = loaderMapByDefinitions.get(definitions);
  if (cached) return cached;
  const map: WhiteboardPanelRegistry = {};
  for (const definition of definitions) {
    if (definition.kind !== 'react') continue;
    // Definition loaders resolve components typed against the full panel
    // contract; the shape body supplies the `data` + `hostedInWhiteboard`
    // subset, the same narrowing every default-registry loader above
    // already relies on.
    map[definition.id] = definition.loader as WhiteboardPanelLoader;
  }
  loaderMapByDefinitions.set(definitions, map);
  return map;
}

/**
 * One code path for both shell wirings: the host's registry when a host
 * is provided, otherwise the deprecated loader-map prop wrapped into
 * `kind: 'react'` definitions.
 */
export function resolveWhiteboardPanelLoaders(
  host: CanvasHost | undefined,
  loaders: WhiteboardPanelRegistry,
): WhiteboardPanelRegistry {
  const definitions = host
    ? host.panels.definitions()
    : reactPanelDefinitions(loaders);
  return whiteboardLoadersForDefinitions(definitions);
}
