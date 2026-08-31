/**
 * Canvas-global panels live outside site context frames (page-level only).
 * They must never be parented into a site group or auto-placed inside one.
 */
import type { Editor, TLShapeId } from 'tldraw';
import { createShapeId } from '@tldraw/tlschema';
import { getContextGroupMeta } from './contextGroupApi';

/** Panel ids that are workspace-wide, not site-scoped. */
export const CANVAS_GLOBAL_PANEL_IDS = ['all-sites'] as const;

export type CanvasGlobalPanelId = (typeof CANVAS_GLOBAL_PANEL_IDS)[number];

export function isCanvasGlobalPanel(panelId: string): panelId is CanvasGlobalPanelId {
  return (CANVAS_GLOBAL_PANEL_IDS as readonly string[]).includes(panelId);
}

/** True when a panel shape is parented under a site context frame. */
export function isPanelInsideContextFrame(editor: Editor, shapeId: TLShapeId): boolean {
  const shape = editor.getShape(shapeId);
  if (!shape?.parentId) return false;
  const parent = editor.getShape(shape.parentId);
  if (!parent || parent.type !== 'frame') return false;
  const meta = getContextGroupMeta(parent);
  return meta?.kind === 'site';
}

/**
 * Reparent canvas-global panels from site frames back to the page.
 * Call when opening a site so stale snapshots cannot keep all-sites inside a frame.
 */
export function ejectGlobalPanelsFromSiteFrames(editor: Editor): number {
  let ejected = 0;
  const pageId = editor.getCurrentPageId();

  for (const panelId of CANVAS_GLOBAL_PANEL_IDS) {
    const shapeId = createShapeId(`panel:${panelId}`);
    const shape = editor.getShape(shapeId);
    if (!shape || shape.type !== 'panel') continue;
    if (!isPanelInsideContextFrame(editor, shapeId)) continue;
    editor.reparentShapes([shapeId], pageId);
    ejected += 1;
  }

  return ejected;
}

/** Filter site-group assignment lists — global panels never join site frames. */
export function filterContextFramePanelIds(panelIds: string[]): string[] {
  return panelIds.filter((id) => !isCanvasGlobalPanel(id));
}
