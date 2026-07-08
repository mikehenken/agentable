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
import {
  findNonOverlappingPosition,
  type LayoutRect,
} from '../../canvas/panelLayoutEngine';
import { getActiveContextRef } from '../context/frameContextStore';

export interface OpenPanelOptions {
  /** After creating/updating, animate camera to the shape. Default true for tool calls. */
  focus?: boolean;
  /** Override default placement. Useful for tests or pinning a shape (e.g. voice). */
  position?: { x: number; y: number };
  /** Override default size. */
  size?: { w: number; h: number };
  /** Pass-through panel-specific props (e.g. { selectedJobId: 2 }). */
  panelProps?: Record<string, unknown>;
}

interface QueuedRequest {
  panelId: string;
  options: OpenPanelOptions;
}

let editorRef: Editor | null = null;
const pendingQueue: QueuedRequest[] = [];

/** Called from WhiteboardShell.onMount. Flushes any queued requests. */
export function bindEditor(editor: Editor): void {
  editorRef = editor;
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

export function focusPanelInCanvas(panelId: string): boolean {
  const editor = editorRef;
  if (!editor) return false;
  const id = createShapeId(`panel:${panelId}`);
  const bounds = editor.getShapePageBounds(id);
  if (!bounds) return false;
  editor.select(id);
  editor.zoomToBounds(bounds, { animation: { duration: 350 } });
  return true;
}

/**
 * Group panel shapes so they move together on the canvas. Reuses an
 * existing group when one already contains any of the panel ids.
 */
export function groupPanelsInCanvas(panelIds: string[]): boolean {
  const editor = editorRef;
  if (!editor || panelIds.length < 2) return false;

  const shapeIds = panelIds.map((panelId) => createShapeId(`panel:${panelId}`));
  const existing = shapeIds.filter((id) => Boolean(editor.getShape(id)));
  if (existing.length < 2) return false;

  for (const shapeId of existing) {
    const parentId = editor.getShape(shapeId)?.parentId;
    if (parentId && editor.getShape(parentId)?.type === 'group') {
      const siblings = editor.getSortedChildIdsForParent(parentId);
      if (existing.every((id) => siblings.includes(id))) {
        return true;
      }
    }
  }

  editor.groupShapes(existing);
  return true;
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
  options: OpenPanelOptions,
): { x: number; y: number; w: number; h: number } {
  if (options.position && options.size) {
    return { ...options.position, ...options.size };
  }
  const w = options.size?.w ?? 480;
  const h = options.size?.h ?? 540;
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

  if (options.position) {
    return {
      x: options.position.x,
      y: options.position.y,
      w,
      h,
    };
  }

  const obstacles = getPanelShapeBounds(editor);
  const { x, y } = findNonOverlappingPosition(w, h, obstacles, viewport);

  return { x, y, w, h };
}

function doOpenPanel(panelId: string, options: OpenPanelOptions): boolean {
  const editor = editorRef;
  if (!editor) return false;
  const id = createShapeId(`panel:${panelId}`);
  const existing = editor.getShape(id);
  const focus = options.focus ?? true;

  if (!existing) {
    const place = computePlacement(editor, options);
    const contextRef =
      (options.panelProps?.contextRef as string | undefined) ?? getActiveContextRef() ?? undefined;
    const panelData = {
      ...(options.panelProps ?? {}),
      ...(contextRef ? { contextRef } : {}),
    };
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
  } else if (options.panelProps) {
    // Existing shape — apply any prop patch (e.g. selectedJobId update).
    const prev = (existing.props as { data?: Record<string, unknown> }).data ?? {};
    editor.updateShape({
      id,
      type: 'panel',
      props: {
        ...(existing.props as Record<string, unknown>),
        minimized: false,
        data: { ...prev, ...options.panelProps },
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

  if (focus) {
    const bounds = editor.getShapePageBounds(id);
    if (bounds) {
      editor.select(id);
      editor.zoomToBounds(bounds, { animation: { duration: 350 } });
    }
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
}
