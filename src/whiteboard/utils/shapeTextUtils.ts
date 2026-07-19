import type { Editor, TLShape } from 'tldraw';
import { resolvePanelChrome } from '../../panels/chrome';
import type { PanelShape } from '../shapes/PanelShape';

export function friendlyPanelTitle(panelId: string, data: Record<string, unknown>): string {
  const title = resolvePanelChrome(data).title;
  if (typeof title === 'string' && title.trim()) {
    return title;
  }
  if (!panelId) return 'Panel';
  return panelId
    .split(/[-_]/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function isPanelShape(shape: TLShape): shape is PanelShape {
  return (shape.type as string) === 'panel';
}

/** Human-readable label for layers tree and search results. */
export function getShapeLabel(editor: Editor, shape: TLShape): string {
  if (isPanelShape(shape)) {
    return friendlyPanelTitle(shape.props.panelId, shape.props.data);
  }
  const metaName = shape.meta.name;
  if (typeof metaName === 'string' && metaName.trim()) {
    return metaName;
  }
  const text = editor.getShapeUtil(shape).getText(shape);
  if (text) return text;
  return shape.type.charAt(0).toUpperCase() + shape.type.slice(1);
}

/** Searchable plain text for a shape (ShapeUtil.getText + panel metadata). */
export function getShapeSearchText(editor: Editor, shape: TLShape): string | undefined {
  const utilText = editor.getShapeUtil(shape).getText(shape)?.trim();
  if (utilText) return utilText;

  if (isPanelShape(shape)) {
    const parts: string[] = [];
    if (shape.props.panelId) parts.push(shape.props.panelId);
    const title = resolvePanelChrome(shape.props.data).title;
    if (typeof title === 'string' && title.trim()) parts.push(title);
    for (const [key, value] of Object.entries(shape.props.data)) {
      if (key.startsWith('__')) continue;
      if (typeof value === 'string' && value.trim()) parts.push(value);
    }
    return parts.length > 0 ? parts.join(' ') : undefined;
  }

  const metaName = shape.meta.name;
  if (typeof metaName === 'string' && metaName.trim()) {
    return metaName;
  }

  return undefined;
}

export interface CanvasTextSearchResult {
  shapeId: TLShape['id'];
  label: string;
  text: string;
}

/** Case-insensitive substring search across all shapes on the current page. */
export function searchCanvasText(editor: Editor, query: string): CanvasTextSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const results: CanvasTextSearchResult[] = [];
  for (const shape of editor.getCurrentPageShapes()) {
    const text = getShapeSearchText(editor, shape);
    if (!text) continue;
    if (!text.toLowerCase().includes(normalizedQuery)) continue;
    results.push({
      shapeId: shape.id,
      label: getShapeLabel(editor, shape),
      text,
    });
  }

  return results;
}

/** Select a shape and animate the camera to its bounds. */
export function focusShapeInCanvas(editor: Editor, shapeId: TLShape['id']): void {
  editor.setCurrentTool('select');
  editor.select(shapeId);
  const bounds = editor.getShapePageBounds(shapeId);
  if (bounds) {
    editor.zoomToBounds(bounds, { inset: 64, animation: { duration: 220 } });
  }
}
