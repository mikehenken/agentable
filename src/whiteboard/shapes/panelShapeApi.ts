/**
 * panelShapeApi — imperative driver for panel shapes on the whiteboard.
 *
 * Agent tools (canvasTools.ts) call `openPanelInCanvas` to surface a
 * panel onto the whiteboard. Voice + chat both route through this single
 * entry point, so the agent's behaviour is identical regardless of
 * modality.
 *
 * Lifecycle:
 *   - WhiteboardShell mounts → calls bindEditor(editor)
 *   - Tools call openPanelInCanvas(...) — shape is created/updated
 *   - WhiteboardShell unmounts → calls unbindEditor()
 *
 * Pending-request queue:
 *   The canvas chunk is lazy-loaded; tool calls can fire before the editor
 *   is bound (especially the voice path, where the agent's first turn
 *   might arrive within ~200ms of `voiceKernel.start()` while the tldraw
 *   chunk is still streaming). Requests landing in that window are queued
 *   and flushed on bindEditor — the agent never silently drops a tool call.
 *
 * No React imports here intentionally — this module is consumed from
 * non-React contexts (canvasTools, voiceKernel callbacks) so it must
 * stay framework-free.
 */
import type { Editor } from 'tldraw';
import { createShapeId } from 'tldraw';
import { withPanelChrome } from '../../panels/chrome';
import type { PanelChromeOptions } from '../../panels/types';
import {
  findNonOverlappingPosition,
  snapRect,
  type LayoutRect,
} from '../../canvas/panelLayoutEngine';
import {
  assignPanelsToSiteGroup,
  fitSiteContextGroupForShape,
  groupPanelsWithContext,
  resolveSiteIdFromPanelData,
} from '../context/contextGroupApi';
import { repairAllInvalidSiteContextLayouts } from '../context/siteContextLayoutRepair';
import { autoArrangeAllSiteContextPanels } from '../context/siteContextAutoArrange';
import {
  computePanelPlacementInSiteContext,
  defaultSitePanelSize,
  resolveInsertionSiteContext,
} from '../context/siteContextPanelLayout';
import {
  filterSiteContextPanelIds,
  isCanvasGlobalPanel,
  ejectGlobalPanelsFromSiteFrames,
} from '../context/canvasGlobalPanels';
import { getActiveContextRef } from '../context/frameContextStore';

export interface OpenPanelOptions {
  /** After creating/updating, animate camera to the shape. Default true for tool calls. */
  focus?: boolean;
  /** When true with focus, pan to reveal the shape without changing zoom level. */
  preserveZoom?: boolean;
  /** Override default placement. Useful for tests or pinning a shape (e.g. voice). */
  position?: { x: number; y: number };
  /** Override default size. */
  size?: { w: number; h: number };
  /** Snap placement to the 20px grid. Default true for whiteboard panels. */
  snapGrid?: boolean;
  /** Pass-through panel-specific props (e.g. { selectedJobId: 2 }). */
  panelProps?: Record<string, unknown>;
  /**
   * Typed chrome options for the shape (title, minimize, bleed, border).
   * Persisted under `data.chrome`; the source of truth, replacing the
   * reserved `__*` panelProps keys older callers passed.
   */
  chrome?: PanelChromeOptions;
  /** When true (default), assign new panels to a site context frame when siteId is present. */
  assignToSiteGroup?: boolean;
  /** Optional agency id for nesting site frames under an agency workspace frame. */
  agencyId?: string | null;
  /** Human-readable site label for the context frame heading. */
  siteLabel?: string;
}

const DEFAULT_SNAP_GRID = true;

interface QueuedRequest {
  panelId: string;
  options: OpenPanelOptions;
}

let editorRef: Editor | null = null;
const pendingQueue: QueuedRequest[] = [];
let pendingSnapshot: unknown | null = null;

/** Called from WhiteboardShell.onMount. Flushes any queued requests. */
export function bindEditor(editor: Editor): void {
  editorRef = editor;

  if (pendingSnapshot !== null) {
    const snapshot = pendingSnapshot;
    pendingSnapshot = null;
    try {
      editor.loadSnapshot(snapshot as Parameters<Editor['loadSnapshot']>[0]);
      window.requestAnimationFrame(() => {
        autoArrangeAllSiteContextPanels(editor);
        repairAllInvalidSiteContextLayouts(editor);
      });
    } catch (err) {
      console.error('[panelShapeApi] pending snapshot load failed', err);
    }
  }

  if (pendingQueue.length === 0) return;
  // Flush in arrival order so a "show jobs then select #2" sequence
  // doesn't reorder. Drain into a local copy so re-entrant calls during
  // flush don't double-fire.
  const drained = pendingQueue.splice(0, pendingQueue.length);
  for (const req of drained) {
    try {
      doOpenPanel(req.panelId, req.options);
    } catch (err) {
      console.error('[panelShapeApi] queued request failed', err);
    }
  }
}

/** Called from WhiteboardShell unmount. Future calls re-queue. */
export function unbindEditor(): void {
  editorRef = null;
}

export function getEditor(): Editor | null {
  return editorRef;
}

/**
 * Load a persisted tldraw snapshot onto the bound editor. Queues until
 * `bindEditor` when the whiteboard chunk is still loading (Stage 10).
 */
export function loadWhiteboardSnapshot(snapshot: unknown): boolean {
  if (typeof window === 'undefined') return false;
  if (!snapshot || typeof snapshot !== 'object') return false;

  if (editorRef) {
    // Capture the binding: the frame callback can outlive editorRef (an
    // unbind or test reset lands between load and the animation frame).
    const editor = editorRef;
    try {
      editor.loadSnapshot(snapshot as Parameters<Editor['loadSnapshot']>[0]);
      window.requestAnimationFrame(() => {
        repairAllInvalidSiteContextLayouts(editor);
      });
      return true;
    } catch (err) {
      console.error('[panelShapeApi] loadWhiteboardSnapshot failed', err);
      return false;
    }
  }

  pendingSnapshot = snapshot;
  return true;
}

/**
 * Public entry point. Returns true when the request landed (immediately
 * OR queued); false when called outside a browser context.
 *
 * Idempotent: calling twice for the same panelId reuses the existing
 * shape (re-focusing it instead of stacking duplicates). An agent might
 * call `open_positions` twice in a single turn — the user shouldn't see
 * two overlapping shapes.
 */
export function openPanelInCanvas(
  panelId: string,
  options: OpenPanelOptions = {},
): boolean {
  if (!editorRef) {
    pendingQueue.push({ panelId, options });
    return true;
  }
  return doOpenPanel(panelId, options);
}

export function closePanelInCanvas(panelId: string): boolean {
  const editor = editorRef;
  if (!editor) return false;
  const id = createShapeId(`panel:${panelId}`);
  if (!editor.getShape(id)) return false;
  editor.deleteShapes([id]);
  return true;
}

export function focusPanelInCanvas(panelId: string, preserveZoom: boolean = false): boolean {
  const editor = editorRef;
  if (!editor) return false;
  const id = createShapeId(`panel:${panelId}`);
  const bounds = editor.getShapePageBounds(id);
  if (!bounds) return false;
  editor.select(id);
  focusPanelShape(editor, id, preserveZoom);
  return true;
}

/** Pan or zoom camera to reveal a panel shape. */
function focusPanelShape(editor: Editor, shapeId: ReturnType<typeof createShapeId>, preserveZoom: boolean): void {
  const bounds = editor.getShapePageBounds(shapeId);
  if (!bounds) return;
  if (preserveZoom) {
    const camera = editor.getCamera();
    const viewport = editor.getViewportPageBounds();
    const shapeCenterX = bounds.x + bounds.w / 2;
    const shapeCenterY = bounds.y + bounds.h / 2;
    const vpCenterX = viewport.x + viewport.w / 2;
    const vpCenterY = viewport.y + viewport.h / 2;
    const margin = 0.15;
    const outsideX =
      bounds.x > viewport.x + viewport.w * (1 - margin) ||
      bounds.x + bounds.w < viewport.x + viewport.w * margin;
    const outsideY =
      bounds.y > viewport.y + viewport.h * (1 - margin) ||
      bounds.y + bounds.h < viewport.y + viewport.h * margin;
    if (outsideX || outsideY) {
      const dx = shapeCenterX - vpCenterX;
      const dy = shapeCenterY - vpCenterY;
      editor.setCamera(
        { x: camera.x - dx * camera.z, y: camera.y - dy * camera.z, z: camera.z },
        { animation: { duration: 350 } },
      );
    }
    return;
  }
  editor.zoomToBounds(bounds, { animation: { duration: 350 } });
}

/**
 * Group panel shapes so they move together on the canvas. Reuses an
 * existing group when one already contains any of the panel ids.
 */
export function groupPanelsInCanvas(
  panelIds: string[],
  options: {
    siteId?: string;
    agencyId?: string | null;
    siteLabel?: string;
  } = {},
): boolean {
  const editor = editorRef;
  if (!editor || panelIds.length === 0) return false;
  const scopedIds = filterSiteContextPanelIds(panelIds);
  if (scopedIds.length === 0) return false;
  return groupPanelsWithContext(editor, scopedIds, options);
}

export function updatePanelProps(
  panelId: string,
  patch: Record<string, unknown>,
): boolean {
  const editor = editorRef;
  if (!editor) return false;
  const id = createShapeId(`panel:${panelId}`);
  const existing = editor.getShape(id);
  if (!existing) return false;
  const prev = (existing.props as { data?: Record<string, unknown> }).data ?? {};
  editor.updateShape({
    id,
    type: 'panel',
    props: {
      ...(existing.props as Record<string, unknown>),
      data: { ...prev, ...patch },
    },
  });
  return true;
}

/**
 * Patch a panel shape's typed chrome options. Fields left out of the
 * patch keep their current value; the write lands under `data.chrome`
 * with legacy-key mirrors per the chrome module's compat contract.
 */
export function updatePanelChrome(
  panelId: string,
  patch: PanelChromeOptions,
): boolean {
  const editor = editorRef;
  if (!editor) return false;
  const existing = editor.getShape(createShapeId(`panel:${panelId}`));
  if (!existing) return false;
  const prev = (existing.props as { data?: Record<string, unknown> }).data ?? {};
  return updatePanelProps(panelId, withPanelChrome(prev, patch));
}

function getPanelShapeBounds(editor: Editor): LayoutRect[] {
  const rects: LayoutRect[] = [];
  for (const shape of editor.getCurrentPageShapes()) {
    if (shape.type !== 'panel') continue;
    const bounds = editor.getShapePageBounds(shape.id);
    if (!bounds) continue;
    rects.push({
      x: bounds.x,
      y: bounds.y,
      w: bounds.w,
      h: bounds.h,
    });
  }
  return rects;
}

/**
 * Default placement strategy: find the first non-overlapping slot within
 * the current viewport. Falls back to stacking below existing panel shapes
 * so agent tool calls never bury panels on top of each other.
 */
function computePlacement(
  editor: Editor,
  panelId: string,
  options: OpenPanelOptions,
): { x: number; y: number; w: number; h: number } {
  const snapGrid = options.snapGrid ?? DEFAULT_SNAP_GRID;
  const defaults = defaultSitePanelSize(panelId);
  const w = options.size?.w ?? defaults.w;
  const h = options.size?.h ?? defaults.h;

  if (options.position && options.size) {
    const rect = { ...options.position, ...options.size };
    return snapGrid ? snapRect(rect) : rect;
  }

  // Canvas-global panels (e.g. all-sites) always open at viewport origin — never
  // inside a site context frame via selection-based insertion.
  if (isCanvasGlobalPanel(panelId) && !options.position) {
    const viewportBounds = editor.getViewportPageBounds();
    const inset = 24;
    const rect = {
      x: viewportBounds.x + inset,
      y: viewportBounds.y + inset,
      w,
      h,
    };
    return snapGrid ? snapRect(rect) : rect;
  }

  const siteContext =
    isCanvasGlobalPanel(panelId) ? null : resolveInsertionSiteContext(editor, options.panelProps);
  if (siteContext && !options.position) {
    const { x, y } = computePanelPlacementInSiteContext(editor, siteContext, { w, h }, {
      snapGrid,
      panelId,
    });
    const rect = { x, y, w, h };
    return snapGrid ? snapRect(rect) : rect;
  }

  if (options.position) {
    const rect = { x: options.position.x, y: options.position.y, w, h };
    return snapGrid ? snapRect(rect) : rect;
  }

  const viewportBounds = editor.getViewportPageBounds();
  const inset = 24;
  const gap = 16;

  const viewport = {
    left: viewportBounds.x + inset,
    top: viewportBounds.y + inset,
    right: viewportBounds.x + viewportBounds.w - inset,
    bottom: viewportBounds.y + viewportBounds.h - inset,
    gap,
  };

  const obstacles = getPanelShapeBounds(editor);
  const { x, y } = findNonOverlappingPosition(w, h, obstacles, viewport, { snapGrid });
  const rect = { x, y, w, h };
  return snapGrid ? snapRect(rect) : rect;
}

function doOpenPanel(panelId: string, options: OpenPanelOptions): boolean {
  const editor = editorRef;
  if (!editor) return false;
  const id = createShapeId(`panel:${panelId}`);
  const existing = editor.getShape(id);
  const focus = options.focus ?? true;

  if (!existing) {
    const place = computePlacement(editor, panelId, options);
    const contextRef =
      (options.panelProps?.contextRef as string | undefined) ?? getActiveContextRef() ?? undefined;
    const baseData = {
      ...(options.panelProps ?? {}),
      ...(contextRef ? { contextRef } : {}),
    };
    const panelData = options.chrome ? withPanelChrome(baseData, options.chrome) : baseData;
    editor.createShape({
      id,
      type: 'panel',
      x: place.x,
      y: place.y,
      props: {
        w: place.w,
        h: place.h,
        panelId,
        minimized: false,
        data: panelData,
      },
    });

    const assignToSiteGroup =
      isCanvasGlobalPanel(panelId) ? false : (options.assignToSiteGroup ?? true);
    const siteId = resolveSiteIdFromPanelData(panelData);
    if (assignToSiteGroup && siteId) {
      assignPanelsToSiteGroup(editor, [panelId], siteId, {
        agencyId: options.agencyId,
        siteLabel: options.siteLabel,
      });
      fitSiteContextGroupForShape(editor, id);
    }
  } else {
    const prev = (existing.props as { data?: Record<string, unknown> }).data ?? {};
    const patched = options.panelProps ? { ...prev, ...options.panelProps } : prev;
    const mergedData = options.chrome ? withPanelChrome(patched, options.chrome) : patched;
    const hasForcedLayout = Boolean(options.position && options.size);

    if (hasForcedLayout) {
      const place = computePlacement(editor, panelId, options);
      editor.updateShape({
        id,
        type: 'panel',
        x: place.x,
        y: place.y,
        props: {
          ...(existing.props as Record<string, unknown>),
          w: place.w,
          h: place.h,
          minimized: false,
          data: mergedData,
        },
      });
    } else if (options.panelProps || options.chrome) {
      // Existing shape — apply any prop patch (e.g. selectedJobId update).
      editor.updateShape({
        id,
        type: 'panel',
        props: {
          ...(existing.props as Record<string, unknown>),
          minimized: false,
          data: mergedData,
        },
      });
    } else if ((existing.props as { minimized?: boolean }).minimized) {
      // Re-expand a minimised shape so a second tool call rehydrates it.
      editor.updateShape({
        id,
        type: 'panel',
        props: { ...(existing.props as Record<string, unknown>), minimized: false },
      });
    }

    const assignToSiteGroup =
      isCanvasGlobalPanel(panelId) ? false : (options.assignToSiteGroup ?? true);
    const siteId = resolveSiteIdFromPanelData(mergedData);
    if (assignToSiteGroup && siteId) {
      assignPanelsToSiteGroup(editor, [panelId], siteId, {
        agencyId: options.agencyId,
        siteLabel: options.siteLabel,
      });
      fitSiteContextGroupForShape(editor, id);
    }
  }

  if (focus) {
    editor.select(id);
    focusPanelShape(editor, id, options.preserveZoom ?? false);
  }

  if (isCanvasGlobalPanel(panelId)) {
    ejectGlobalPanelsFromSiteFrames(editor);
  }

  return true;
}

/**
 * Test-only reset. Drops the editor binding and clears the pending queue
 * so the next test's bindEditor starts from a clean slate.
 */
export function __resetPanelShapeApiForTests__(): void {
  editorRef = null;
  pendingQueue.length = 0;
  pendingSnapshot = null;
}
