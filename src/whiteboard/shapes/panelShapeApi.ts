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
 * Default placement strategy: cascade new shapes from top-left of the
 * current viewport. tldraw's pan/zoom is the user's cue; we plant new
 * shapes within the visible area so an agent tool call is immediately
 * visible without a manual zoom-out.
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
  const viewport = editor.getViewportPageBounds();
  // Place at the top-left of the viewport with a small inset, then
  // cascade by the count of existing panel shapes so a 4th tool call
  // doesn't bury its shape under #1.
  const existingCount = editor
    .getCurrentPageShapes()
    .filter((s) => s.type === 'panel').length;
  const inset = 24 + (existingCount % 5) * 32;
  return {
    x: options.position?.x ?? viewport.x + inset,
    y: options.position?.y ?? viewport.y + inset,
    w,
    h,
  };
}

function doOpenPanel(panelId: string, options: OpenPanelOptions): boolean {
  const editor = editorRef;
  if (!editor) return false;
  const id = createShapeId(`panel:${panelId}`);
  const existing = editor.getShape(id);
  const focus = options.focus ?? true;

  if (!existing) {
    const place = computePlacement(editor, options);
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
        // Panel-specific overrides (e.g. selectedJobId) live nested under `data`
        // because tldraw's RecordProps validator is strict — we can't spread
        // arbitrary keys at the top level. Each panel component reads what it
        // needs from `data`, falling back to `panelIntentStore` for shared
        // cross-panel intents (selectedJobId, search, artifacts).
        data: options.panelProps ?? {},
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
