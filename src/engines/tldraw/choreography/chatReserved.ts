import type { Editor } from 'tldraw';
import { createShapeId } from 'tldraw';
import {
  findNonOverlappingPosition,
  rectsOverlap,
  snapToGrid,
  type LayoutRect,
  type ViewportLayoutConfig,
} from '../../../layout/panelLayoutEngine';
import { CHAT_PANEL_ID, isChatPanelId } from '../../../choreography/constants';

export function getChatPanelBounds(editor: Editor): LayoutRect | null {
  const chatShapeId = createShapeId(`panel:${CHAT_PANEL_ID}`);
  const bounds = editor.getShapePageBounds(chatShapeId);
  if (!bounds) return null;
  return { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h };
}

/**
 * When opening a non-chat panel, treat the chat shape as a hard obstacle
 * even if the generic placement path would accept overlap (sandals regression).
 */
export function mergeChatReservedObstacles(
  obstacles: LayoutRect[],
  chatBounds: LayoutRect | null,
  openingPanelId: string): LayoutRect[] {
  if (isChatPanelId(openingPanelId) || chatBounds === null) {
    return obstacles;
  }

  const alreadyReserved = obstacles.some((obstacle) =>
    rectsOverlap(obstacle, chatBounds, 0));
  if (alreadyReserved) {
    return obstacles;
  }

  return [...obstacles, chatBounds];
}

export function computeChatAwarePlacement(
  editor: Editor,
  panelId: string,
  w: number,
  h: number,
  obstacles: LayoutRect[],
  viewport: ViewportLayoutConfig,
  snapGrid: boolean): { x: number; y: number } {
  const chatBounds = getChatPanelBounds(editor);
  const reserved = mergeChatReservedObstacles(obstacles, chatBounds, panelId);
  return findNonOverlappingPosition(w, h, reserved, viewport, { snapGrid });
}

const BESIDE_CHAT_GAP = 16;

/**
 * Place a panel in the top row immediately to the right of chat.
 * Falls back to chat-aware scan when chat is not on canvas yet.
 */
export function computeBesideChatPlacement(
  editor: Editor,
  panelId: string,
  w: number,
  h: number,
  viewport: ViewportLayoutConfig,
  snapGrid: boolean): { x: number; y: number } {
  const chatBounds = getChatPanelBounds(editor);
  if (chatBounds !== null && !isChatPanelId(panelId)) {
    return {
      x: snapGrid ? snapToGrid(chatBounds.x + chatBounds.w + BESIDE_CHAT_GAP): chatBounds.x + chatBounds.w + BESIDE_CHAT_GAP,
      y: snapGrid ? snapToGrid(chatBounds.y): chatBounds.y,
    };
  }

  const obstacles: LayoutRect[] = [];
  for (const shape of editor.getCurrentPageShapes) {
    if (shape.type !== 'panel') continue;
    const bounds = editor.getShapePageBounds(shape.id);
    if (!bounds) continue;
    obstacles.push({ x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h });
  }

  return computeChatAwarePlacement(editor, panelId, w, h, obstacles, viewport, snapGrid);
}

/**
 * Reposition a panel that landed on top of chat after open/focus (z-order fix).
 */
export function repositionPanelBesideChatIfOverlapping(
  editor: Editor,
  panelId: string,
  viewport: ViewportLayoutConfig,
  snapGrid: boolean): boolean {
  if (isChatPanelId(panelId)) return false;

  const chatBounds = getChatPanelBounds(editor);
  if (chatBounds === null) return false;

  const shapeId = createShapeId(`panel:${panelId}`);
  const panelBounds = editor.getShapePageBounds(shapeId);
  if (!panelBounds) return false;

  const panelRect: LayoutRect = {
    x: panelBounds.x,
    y: panelBounds.y,
    w: panelBounds.w,
    h: panelBounds.h,
  };

  if (!rectsOverlap(panelRect, chatBounds, viewport.gap)) {
    return false;
  }

  const obstacles: LayoutRect[] = [];
  for (const shape of editor.getCurrentPageShapes) {
    if (shape.type !== 'panel' || shape.id === shapeId) continue;
    const bounds = editor.getShapePageBounds(shape.id);
    if (!bounds) continue;
    obstacles.push({ x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h });
  }

  const placed = computeChatAwarePlacement(
    editor,
    panelId,
    panelRect.w,
    panelRect.h,
    obstacles,
    viewport,
    snapGrid);

  editor.updateShape({
    id: shapeId,
    type: 'panel',
    x: placed.x,
    y: placed.y,
  });

  return true;
}
