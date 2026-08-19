/**
 * Auto-arrange site context panels — grid spans with GRID_GUTTER spacing.
 * Chat (when present) docks flush to the site frame left edge; other panels
 * use grid positions with 16px gutters (not flush panel-to-panel docks).
 */
import { type Editor, type TLShapeId } from 'tldraw';
import {
  CONTEXT_FRAME_PADDING,
  contextGroupFrameId,
  fitContextGroupFrameToContent,
  getContextGroupMeta,
} from './contextGroupApi';
import {
  setPanelDock,
  reflowContextFrameRow,
  type PanelDock,
} from './panelDockEngine';
import {
  computeInitialContextFrameLayout,
  type ContextFramePanelKind,
  type ContextFramePanelPlacement,
} from './contextFramePanelLayout';
import { GRID_REFERENCE_WIDTH } from '../../../layout/gridLayout';

const SITE_PANEL_KINDS: readonly ContextFramePanelKind[] = [
  'chat',
  'project-brief',
  'web-preview',
  'file-manager',
];

interface SiteContextPanelRecord {
  panelId: ContextFramePanelKind;
  shapeId: TLShapeId;
}

function isSitePanelKind(value: string): value is ContextFramePanelKind {
  return (SITE_PANEL_KINDS as readonly string[]).includes(value);
}

/** True when a site context frame exists with at least one panel child. */
export function hasContextFramePanels(editor: Editor, siteId: string): boolean {
  const frameId = contextGroupFrameId({ kind: 'site', id: siteId });
  return collectSiteContextPanels(editor, frameId).length > 0;
}

function collectSiteContextPanels(
  editor: Editor,
  frameId: TLShapeId): SiteContextPanelRecord[] {
  const panels: SiteContextPanelRecord[] = [];
  for (const childId of editor.getSortedChildIdsForParent(frameId)) {
    const shape = editor.getShape(childId);
    if (!shape || shape.type !== 'panel') continue;
    const panelId = (shape.props as { panelId?: unknown }).panelId;
    if (typeof panelId !== 'string' || !isSitePanelKind(panelId)) continue;
    panels.push({ panelId, shapeId: childId });
  }
  return panels;
}

function layoutFlagsFromPanels(panels: SiteContextPanelRecord[]): {
  includeChat: boolean;
  includeBrief: boolean;
  includePreview: boolean;
  includeFiles: boolean;
} {
  const ids = new Set(panels.map((p) => p.panelId));
  return {
    includeChat: ids.has('chat'),
    includeBrief: ids.has('project-brief'),
    includePreview: ids.has('web-preview'),
    includeFiles: ids.has('file-manager'),
  };
}

function dockChatToGroupLeft(frameId: TLShapeId): PanelDock {
  return { target: 'group', targetId: frameId, edge: 'left', gap: 0, fillHeight: true };
}

function dockFilesToGroupRight(frameId: TLShapeId): PanelDock {
  return { target: 'group', targetId: frameId, edge: 'right', gap: 0, fillHeight: true };
}

interface ApplyGridOptions {
  dockChatLeft: boolean;
  dockFilesRight: boolean;
  /** Uniform row height applied to every panel so the group is one clean row. */
  rowHeight: number;
}

function applyGridPlacements(
  editor: Editor,
  frameId: TLShapeId,
  panels: SiteContextPanelRecord[],
  gridPlacements: ContextFramePanelPlacement[],
  options: ApplyGridOptions): void {
  const { dockChatLeft, dockFilesRight, rowHeight } = options;
  const byPanelId = new Map(gridPlacements.map((p) => [p.panelId, p]));
  const frame = editor.getShape(frameId);
  for (const panel of panels) {
    const target = byPanelId.get(panel.panelId);
    if (!target) continue;
    const existing = editor.getShape(panel.shapeId);
    if (!existing) continue;
     // Grid placements are page-space, but these panels are children of the site
     // frame, so tldraw interprets their x/y in the frame's local space. Convert
     // page → frame-local; otherwise a frame offset from the page origin (e.g.
     // after workspace-mode zoom) doubles the offset and flings panels away,
     // which then inflates the frame in a fillHeight ↔ frame-fit runaway.
    const local =
      existing.parentId === frameId && frame
        ? editor.getPointInShapeSpace(frame, { x: target.x, y: target.y }): { x: target.x, y: target.y };
    editor.updateShape({
      id: panel.shapeId,
      type: 'panel',
      x: local.x,
      y: local.y,
      props: {...(existing.props as Record<string, unknown>),
        w: target.w,
         // Uniform height: every panel spans the full group inner height so the
         // row is cleanly aligned (chat/preview/files equal height).
        h: rowHeight,
      },
    });
     // Record edge-dock intent. The flush position + fillHeight are resolved
     // against the FITTED frame afterward by cascadeDockedPanelsInFrame — doing
     // it here (against the pre-fit frame) would lock in a fill↔fit runaway.
    if (panel.panelId === 'chat' && dockChatLeft) {
      setPanelDock(editor, panel.shapeId, dockChatToGroupLeft(frameId));
    } else if (panel.panelId === 'file-manager' && dockFilesRight) {
      setPanelDock(editor, panel.shapeId, dockFilesToGroupRight(frameId));
    } else {
      setPanelDock(editor, panel.shapeId, null);
    }
  }
}

function computeAnchorForFrame(editor: Editor, frameId: TLShapeId): {
  x: number;
  y: number;
  maxWidth: number;
  maxHeight: number;
} | null {
  const frameBounds = editor.getShapePageBounds(frameId);
  if (!frameBounds) return null;
  const innerPadding = Math.max(20, Math.floor(CONTEXT_FRAME_PADDING / 2));
   // Use the fixed grid reference width — NOT the live viewport or the current
   // frame size — so the default arrangement is deterministic and idempotent.
   // The viewport is in page units and shrinks as the camera zooms into a site
   // (workspace mode), so a viewport-derived grid produces different panel sizes
   // on each arrange pass (racing arrangers → tiny/garbled layouts). The frame's
   // own size can't be used either: it would let an oversized frame inflate the
   // grid, which then re-fits the frame even larger (a fill↔fit runaway).
  return {
    x: frameBounds.x + innerPadding,
    y: frameBounds.y + innerPadding,
    maxWidth: GRID_REFERENCE_WIDTH,
    maxHeight: GRID_REFERENCE_WIDTH,
  };
}

export interface ContextFrameArrangeOptions {
  /** Dock chat flush to the site frame left edge. Default true. */
  dockChatLeft?: boolean;
}

/**
 * Force-arrange all site context panels under a site frame.
 * Uses grid spans with GRID_GUTTER between non-docked panels.
 */
export function autoArrangeContextFramePanels(
  editor: Editor,
  siteId: string,
  options: ContextFrameArrangeOptions = {}): boolean {
  const { dockChatLeft = true } = options;
  const frameId = contextGroupFrameId({ kind: 'site', id: siteId });
  const frame = editor.getShape(frameId);
  if (!frame) return false;

  const panels = collectSiteContextPanels(editor, frameId);
  if (panels.length === 0) return false;

  const anchor =
    computeAnchorForFrame(editor, frameId) ??
    (() => {
      const viewport = editor.getViewportPageBounds;
      return {
        x: viewport().x + 24,
        y: viewport().y + 24,
        maxWidth: viewport().w - 48,
        maxHeight: viewport().h - 48,
      };
    });

  const flags = layoutFlagsFromPanels(panels);
  const gridPlacements: ContextFramePanelPlacement[] = computeInitialContextFrameLayout(
    anchor,
    {...flags, dockChatLeft: dockChatLeft && flags.includeChat });

   // One clean row: every panel spans the same (full) height so chat, preview
   // and files align cleanly. Use the tallest grid placement as the row height.
  const rowHeight = gridPlacements.reduce((max, p) => Math.max(max, p.h), 0);

  applyGridPlacements(editor, frameId, panels, gridPlacements, {
    dockChatLeft: dockChatLeft && flags.includeChat,
    dockFilesRight: flags.includeFiles,
    rowHeight,
  });
  fitContextGroupFrameToContent(editor, frameId, { mode: 'final' });
   // Reflow the row against the fitted frame: chat snaps flush-left, files snap
   // flush-right (both full inner height), and the centered preview fills the
   // middle with an equal GRID_GUTTER on each side → chat | gutter | preview |
   // gutter | files. This is also the exact reflow used on GROUP resize, so the
   // opened layout and a resized layout stay consistent.
  reflowContextFrameRow(editor, frameId);
  return true;
}

/** Resolve site frame id and arrange — convenience for toolbar host bridges. */
export function autoArrangeContextFramePanelsByFrameId(
  editor: Editor,
  frameId: TLShapeId): boolean {
  const frame = editor.getShape(frameId);
  if (!frame) return false;
  const meta = getContextGroupMeta(frame);
  if (meta?.kind !== 'site') return false;
  return autoArrangeContextFramePanels(editor, meta.id);
}

/** Auto-arrange every site context frame on the current page. */
export function autoArrangeAllContextFramePanels(editor: Editor): number {
  let arranged = 0;
  for (const shape of editor.getCurrentPageShapes) {
    if (shape.type !== 'frame') continue;
    const meta = getContextGroupMeta(shape);
    if (meta?.kind !== 'site') continue;
    if (autoArrangeContextFramePanels(editor, meta.id)) {
      arranged += 1;
    }
  }
  return arranged;
}
