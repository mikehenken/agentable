/**
 * Site context layers — panel shapes (and other direct children) inside a
 * site's tldraw context frame. Consumed by the studio sidebar CONTEXT list.
 */
import type { Editor, TLShape, TLShapeId } from 'tldraw';
import { focusShapeInCanvas, getShapeLabel } from '../utils/shapeTextUtils';
import { contextGroupFrameId, fitContextGroupFrameToContent } from './contextGroupApi';
import { isCanvasGlobalPanel } from './canvasGlobalPanels';

export interface SiteContextLayer {
  shapeId: TLShapeId;
  name: string;
  panelId: string | null;
  visible: boolean;
}

const HIDDEN_OPACITY_THRESHOLD = 0.05;

/** True when the shape is rendered on canvas (opacity above hidden threshold). */
export function isSiteContextLayerVisible(shape: TLShape): boolean {
  const opacity = shape.opacity;
  if (typeof opacity !== 'number') return true;
  return opacity > HIDDEN_OPACITY_THRESHOLD;
}

function panelIdFromShape(shape: TLShape): string | null {
  if (shape.type !== 'panel') return null;
  const panelId = (shape.props as { panelId?: unknown }).panelId;
  return typeof panelId === 'string' && panelId.trim() ? panelId.trim() : null;
}

/**
 * List direct child shapes of the site context frame for `siteId`.
 * Layers map to tldraw panel shapes (chat, brief, preview, file-manager, etc.)
 * grouped under the site context frame — not separate page-level z-layers.
 */
export function listSiteContextLayers(editor: Editor, siteId: string): SiteContextLayer[] {
  const trimmedSiteId = siteId.trim();
  if (!trimmedSiteId) return [];

  const frameId = contextGroupFrameId({ kind: 'site', id: trimmedSiteId });
  const frame = editor.getShape(frameId);
  if (!frame) return [];

  const childIds = editor.getSortedChildIdsForParent(frameId);
  const layers: SiteContextLayer[] = [];

  for (const shapeId of childIds) {
    const shape = editor.getShape(shapeId);
    if (!shape) continue;
    if (shape.type === 'frame') continue;

    const panelId = panelIdFromShape(shape);
    if (panelId && isCanvasGlobalPanel(panelId)) continue;

    layers.push({
      shapeId: shape.id,
      name: getShapeLabel(editor, shape),
      panelId: panelIdFromShape(shape),
      visible: isSiteContextLayerVisible(shape),
    });
  }

  return layers;
}

/**
 * First selected shape id that is a direct child layer of the site context frame,
 * or null when selection is empty or does not match a listed layer.
 */
export function resolveSelectedSiteContextLayerId(
  editor: Editor,
  siteId: string,
): TLShapeId | null {
  const layerIds = new Set(
    listSiteContextLayers(editor, siteId).map((layer) => layer.shapeId),
  );
  if (layerIds.size === 0) return null;

  for (const shapeId of editor.getSelectedShapeIds()) {
    if (layerIds.has(shapeId)) return shapeId;
  }

  return null;
}

/** Select and focus a site context layer shape on the canvas. */
export function selectSiteContextLayer(
  editor: Editor,
  shapeId: TLShapeId,
  siteId: string,
): boolean {
  const isLayer = listSiteContextLayers(editor, siteId).some(
    (layer) => layer.shapeId === shapeId,
  );
  if (!isLayer) return false;

  focusShapeInCanvas(editor, shapeId);
  return true;
}

/** Toggle layer visibility via tldraw shape opacity. */
export function toggleSiteContextLayerVisibility(editor: Editor, shapeId: TLShapeId): boolean {
  const shape = editor.getShape(shapeId);
  if (!shape) return false;

  const nextOpacity = isSiteContextLayerVisible(shape) ? 0 : 1;
  editor.updateShape({
    id: shape.id,
    type: shape.type,
    opacity: nextOpacity,
  });
  return true;
}

/** Remove a layer shape and refit its site context frame. */
export function deleteSiteContextLayer(editor: Editor, shapeId: TLShapeId, siteId: string): boolean {
  const shape = editor.getShape(shapeId);
  if (!shape) return false;

  const frameId = contextGroupFrameId({ kind: 'site', id: siteId.trim() });
  editor.deleteShapes([shapeId]);

  if (editor.getShape(frameId)) {
    fitContextGroupFrameToContent(editor, frameId);
  }

  return true;
}
