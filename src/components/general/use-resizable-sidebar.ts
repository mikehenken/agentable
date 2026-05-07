import * as React from "react";

export interface UseResizableSidebarOpts {
  /**
   * Which edge of the sidebar carries the drag handle. `left`
   * sidebars grow to the right (handle on the right edge); `right`
   * sidebars grow to the left (handle on the left edge).
   */
  side: "left" | "right";
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  /** Width when the sidebar is collapsed. Defaults to 40px. */
  collapsedWidth?: number;
  /**
   * localStorage key root. We persist `:w` (width) and `:c`
   * (collapsed). Omit to disable persistence (e.g. tests).
   */
  storageKey?: string;
}

export interface UseResizableSidebarReturn {
  /** Effective width — switches to collapsed value when collapsed. */
  width: number;
  /** Live width (independent of collapsed) — useful for the expand transition. */
  expandedWidth: number;
  collapsed: boolean;
  toggleCollapse: () => void;
  setCollapsed: (next: boolean) => void;
  /**
   * Spread these onto the resize-handle element. The handle should be
   * a thin (~5px) strip on the sidebar's inner edge with
   * `cursor: col-resize`. Pointer events drive the drag — they
   * unify mouse + touch + pen and avoid the legacy mousemove
   * overlay-on-document dance.
   */
  handleProps: {
    onPointerDown: React.PointerEventHandler<HTMLElement>;
    onPointerMove: React.PointerEventHandler<HTMLElement>;
    onPointerUp: React.PointerEventHandler<HTMLElement>;
    onPointerCancel: React.PointerEventHandler<HTMLElement>;
    role: "separator";
    tabIndex: 0;
    "aria-orientation": "vertical";
    "aria-label": string;
    onKeyDown: React.KeyboardEventHandler<HTMLElement>;
  };
  /** True only while the user is actively dragging the handle. */
  dragging: boolean;
}

/**
 * Read a persisted number/bool from localStorage, gracefully returning
 * `undefined` for any failure path (private mode, quota, parse error,
 * SSR). Numbers are clamped to [min, max] so a stale persisted value
 * outside the current bounds doesn't lock the sidebar at an unusable size.
 */
function readPersisted(key: string | undefined, suffix: "w" | "c"): unknown {
  if (!key) return undefined;
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(`${key}:${suffix}`);
    if (raw == null) return undefined;
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writePersisted(key: string | undefined, suffix: "w" | "c", value: unknown) {
  if (!key) return;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${key}:${suffix}`, JSON.stringify(value));
  } catch {
    // Quota/private-mode/etc. — silently ignore; the runtime state
    // still works for the current session.
  }
}

/**
 * State + drag affordances for a resizable, collapsible sidebar.
 *
 * Per the design persona's "Don't Make Me Think" rule:
 *   • Drag handle is a thin (5px) hit strip on the inner edge — no
 *     visual clutter at rest, but the cursor flips to `col-resize`
 *     on hover so the affordance is discoverable.
 *   • Pointer capture means the drag tracks even when the cursor
 *     leaves the strip's narrow hit area.
 *   • Keyboard arrow keys nudge the width by 16 / 64 px so the panel
 *     is operable without a mouse (WCAG 2.1.1 / 2.1.2 keyboard).
 *   • Width is clamped on every read and write so a stale persisted
 *     value can never lock the panel.
 */
export function useResizableSidebar(opts: UseResizableSidebarOpts): UseResizableSidebarReturn {
  const collapsedWidth = opts.collapsedWidth ?? 40;

  const [expandedWidth, setExpandedWidth] = React.useState<number>(() => {
    const raw = readPersisted(opts.storageKey, "w");
    const candidate = typeof raw === "number" ? raw : opts.defaultWidth;
    return Math.min(opts.maxWidth, Math.max(opts.minWidth, candidate));
  });
  const [collapsed, setCollapsedState] = React.useState<boolean>(() => {
    const raw = readPersisted(opts.storageKey, "c");
    return typeof raw === "boolean" ? raw : false;
  });
  const [dragging, setDragging] = React.useState(false);

  React.useEffect(() => {
    writePersisted(opts.storageKey, "w", expandedWidth);
  }, [expandedWidth, opts.storageKey]);
  React.useEffect(() => {
    writePersisted(opts.storageKey, "c", collapsed);
  }, [collapsed, opts.storageKey]);

  // Listen for external "toggle" events. The host app dispatches
  // `agentable-sidebar:toggle` with `detail.key === storageKey` to
  // drive collapse/expand from a keyboard shortcut or command. This
  // keeps the sidebar's internal state authoritative while letting
  // distant code drive it without prop drilling.
  React.useEffect(() => {
    if (!opts.storageKey || typeof window === "undefined") return;
    const onToggle = (e: Event) => {
      const ce = e as CustomEvent<{ key: string; force?: "collapse" | "expand" }>;
      if (ce.detail?.key !== opts.storageKey) return;
      if (ce.detail.force === "collapse") setCollapsedState(true);
      else if (ce.detail.force === "expand") setCollapsedState(false);
      else setCollapsedState((c) => !c);
    };
    window.addEventListener("agentable-sidebar:toggle", onToggle);
    return () => window.removeEventListener("agentable-sidebar:toggle", onToggle);
  }, [opts.storageKey]);

  const dragRef = React.useRef<{ startX: number; startW: number } | null>(null);

  const setWidthClamped = React.useCallback(
    (next: number) => {
      setExpandedWidth(Math.min(opts.maxWidth, Math.max(opts.minWidth, next)));
    },
    [opts.minWidth, opts.maxWidth],
  );

  const onPointerDown: React.PointerEventHandler<HTMLElement> = (e) => {
    // Only respond to primary button / single touch.
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startW: expandedWidth };
    setDragging(true);
    // If user starts dragging a collapsed panel, expand first.
    if (collapsed) setCollapsedState(false);
  };
  const onPointerMove: React.PointerEventHandler<HTMLElement> = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    // `left` sidebar: drag right → wider (sign +1).
    // `right` sidebar: drag left → wider (sign -1).
    const sign = opts.side === "left" ? 1 : -1;
    setWidthClamped(dragRef.current.startW + dx * sign);
  };
  const endDrag: React.PointerEventHandler<HTMLElement> = (e) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
    setDragging(false);
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLElement> = (e) => {
    const step = e.shiftKey ? 64 : 16;
    if (opts.side === "left") {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setWidthClamped(expandedWidth + step);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setWidthClamped(expandedWidth - step);
      }
    } else {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setWidthClamped(expandedWidth + step);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setWidthClamped(expandedWidth - step);
      }
    }
    // Enter/Space toggles collapse — common pattern from VSCode.
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setCollapsedState((c) => !c);
    }
  };

  const toggleCollapse = React.useCallback(() => setCollapsedState((c) => !c), []);
  const setCollapsed = React.useCallback((next: boolean) => setCollapsedState(next), []);

  return {
    width: collapsed ? collapsedWidth : expandedWidth,
    expandedWidth,
    collapsed,
    toggleCollapse,
    setCollapsed,
    dragging,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      role: "separator",
      tabIndex: 0,
      "aria-orientation": "vertical",
      "aria-label": opts.side === "left" ? "Resize left sidebar" : "Resize right sidebar",
      onKeyDown,
    },
  };
}
