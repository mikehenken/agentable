/**
 * Detect and repair broken site context panel layouts after snapshot restore.
 *
 * Only runs when panels overlap or exceed grid row-span height caps (legacy
 * skyscraper layouts). Valid user-customized positions are left untouched.
 */
import { createShapeId, type Editor, type TLShapeId } from 'tldraw';
import type { LayoutRect } from '../../canvas/panelLayoutEngine';
import {
  GRID_GUTTER,
  GRID_ROW_HEIGHT,
  getPanelGridSpan,
  gridSpanToSize,
  rectsOverlapWithGap,
} from '../../canvas/gridLayout';
import {
  CONTEXT_FRAME_PADDING,
  fitContextGroupFrameToContent,
  getContextGroupMeta,
} from './contextGroupApi';
import {
  computeInitialSiteContextLayout,
  type SiteContextPanelKind,
  type SiteContextPanelPlacement,
} from './siteContextPanelLayout';

const SITE_PANEL_KINDS: readonly SiteContextPanelKind[] = [
  'chat',
  'project-brief',
  'web-preview',
  'file-manager',
];

const HEIGHT_TOLERANCE_PX = 24;

interface SiteContextPanelSnapshot {
  panelId: SiteContextPanelKind;
  shapeId: TLShapeId;
  rect: LayoutRect;
}

function isSitePanelKind(value: string): value is SiteContextPanelKind {
  return (SITE_PANEL_KINDS as readonly string[]).includes(value);
}

function maxHeightForPanel(panelId: string): number {
  const span = getPanelGridSpan(panelId);
  const { h } = gridSpanToSize(
    { columns: 12, rowHeight: GRID_ROW_HEIGHT, gutter: GRID_GUTTER, colWidth: 80 },
    span,
    false);
  return h + HEIGHT_TOLERANCE_PX;
}

function panelRectFromEditor(editor: Editor, shapeId: TLShapeId): LayoutRect | null {
  const bounds = editor.getShapePageBounds(shapeId);
  if (!bounds) return null;
  return { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h };
}

function collectSiteContextPanels(
  editor: Editor,
  frameId: TLShapeId): SiteContextPanelSnapshot[] {
  const panels: SiteContextPanelSnapshot[] = [];
  for (const childId of editor.getSortedChildIdsForParent(frameId)) {
    const shape = editor.getShape(childId);
    if (!shape || shape.type !== 'panel') continue;
    const panelId = (shape.props as { panelId?: unknown }).panelId;
    if (typeof panelId !== 'string' || !isSitePanelKind(panelId)) continue;
    const rect = panelRectFromEditor(editor, childId);
    if (!rect) continue;
    panels.push({ panelId, shapeId: childId, rect });
  }
  return panels;
}

/** True when panels overlap or any panel exceeds its grid row-span height cap. */
export function isSiteContextLayoutInvalid(panels: SiteContextPanelSnapshot[]): boolean {
  if (panels.length < 2) {
    const only = panels[0];
    if (!only) return false;
    return only.rect.h > maxHeightForPanel(only.panelId);
  }

  for (let i = 0; i < panels.length; i += 1) {
    if (panels[i].rect.h > maxHeightForPanel(panels[i].panelId)) {
      return true;
    }
    for (let j = i + 1; j < panels.length; j += 1) {
      if (rectsOverlapWithGap(panels[i].rect, panels[j].rect, GRID_GUTTER)) {
        return true;
      }
    }
  }
  return false;
}

function layoutOptionsFromPanels(
  panels: SiteContextPanelSnapshot[]): {
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

function applyPlacements(
  editor: Editor,
  frameId: TLShapeId,
  panels: SiteContextPanelSnapshot[],
  placements: SiteContextPanelPlacement[]): void {
  const byPanelId = new Map(placements.map((p) => [p.panelId, p]));
  const frame = editor.getShape(frameId);
  for (const panel of panels) {
    const target = byPanelId.get(panel.panelId);
    if (!target) continue;
    const existing = editor.getShape(panel.shapeId);
    // Placements are page-space; panels are children of the frame, so convert
    // into the frame's local space before writing shape x/y.
    const local =
      frame && existing?.parentId === frameId
        ? editor.getPointInShapeSpace(frame, { x: target.x, y: target.y }): { x: target.x, y: target.y };
    editor.updateShape({
      id: panel.shapeId,
      type: 'panel',
      x: local.x,
      y: local.y,
      props: {...(existing?.props as Record<string, unknown>),
        w: target.w,
        h: target.h,
      },
    });
  }
}

/**
 * Re-grid panels inside one site context frame when layout is invalid.
 * Returns true when a repair was applied.
 */
export function repairSiteContextFrameLayout(
  editor: Editor,
  frameId: TLShapeId): boolean {
  const panels = collectSiteContextPanels(editor, frameId);
  if (panels.length === 0 || !isSiteContextLayoutInvalid(panels)) {
    return false;
  }

  const frameBounds = editor.getShapePageBounds(frameId);
  if (!frameBounds) return false;

  const innerPadding = Math.max(20, Math.floor(CONTEXT_FRAME_PADDING / 2));
  const anchor = {
    x: frameBounds.x + innerPadding,
    y: frameBounds.y + innerPadding,
    maxWidth: Math.max(480, frameBounds.w - innerPadding * 2),
    maxHeight: Math.max(480, frameBounds.h - innerPadding * 2),
  };

  const placements = computeInitialSiteContextLayout(
    anchor,
    layoutOptionsFromPanels(panels));

  applyPlacements(editor, frameId, panels, placements);
  fitContextGroupFrameToContent(editor, frameId, { mode: 'final' });
  return true;
}

/**
 * Scan all site context frames and repair invalid panel layouts.
 * Returns the number of frames repaired.
 */
export function repairAllInvalidSiteContextLayouts(editor: Editor): number {
  let repaired = 0;
  for (const shape of editor.getCurrentPageShapes()) {
    if (shape.type !== 'frame') continue;
    const meta = getContextGroupMeta(shape);
    if (meta?.kind !== 'site') continue;
    if (repairSiteContextFrameLayout(editor, shape.id)) {
      repaired += 1;
    }
  }
  return repaired;
}

/** Resolve a site frame id from siteId (for host bridges). */
export function siteContextFrameIdForSite(siteId: string): TLShapeId {
  return createShapeId(`context:site:${siteId}`);
}
