/**
 * Auto-arrange free PanelShapes on the whiteboard (career / Sandals embeds).
 *
 * Ports the spirit of bounded `layoutStore.autoOrganize`: chat left column,
 * remaining panels tiled to the right in rows without changing zoom.
 * Origin respects expanded vs collapsed Menu (NavSidebar) chrome insets.
 *
 * Overflow continues below the free canvas (pan) rather than clamping every
 * panel onto the same bottom-right corner (overlap / "crazy placement").
 */
import type { Editor, TLShapeId } from 'tldraw';
import { snapToGrid } from '../../../layout/panelLayoutEngine';
import { defaultWhiteboardPanelSize } from '../context/contextFramePanelLayout';
import {
  WHITEBOARD_VIEWPORT_INSET,
  resolveWhiteboardChromeInsets,
  type ResolveWhiteboardChromeInsetsOptions,
} from './whiteboardChromeInsets';
import { compareWhiteboardPanelArrangeOrder } from './whiteboardLayoutConfig';

const GAP = 16;

export interface WhiteboardPanelLayoutSlot {
  panelId: string;
  shapeId: TLShapeId;
  w: number;
  h: number;
}

export interface AutoArrangeWhiteboardPanelsOptions
  extends ResolveWhiteboardChromeInsetsOptions {}

function readPanelShapes(editor: Editor): WhiteboardPanelLayoutSlot[] {
  const slots: WhiteboardPanelLayoutSlot[] = [];
  for (const shape of editor.getCurrentPageShapes()) {
    if (shape.type !== 'panel') continue;
    const props = shape.props as { panelId?: string; w?: number; h?: number };
    if (typeof props.panelId !== 'string' || props.panelId.length === 0) continue;
    slots.push({
      panelId: props.panelId,
      shapeId: shape.id,
      w: typeof props.w === 'number' ? props.w : 360,
      h: typeof props.h === 'number' ? props.h : 400,
    });
  }
  return slots;
}

function sortWhiteboardPanelOrder(
  a: WhiteboardPanelLayoutSlot,
  b: WhiteboardPanelLayoutSlot,
): number {
  return compareWhiteboardPanelArrangeOrder(a.panelId, b.panelId);
}

function placeSlot(
  editor: Editor,
  slot: WhiteboardPanelLayoutSlot,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  editor.updateShape({
    id: slot.shapeId,
    type: 'panel',
    x: snapToGrid(x),
    y: snapToGrid(y),
    props: {
      w,
      h,
    },
  });
}

/**
 * Arrange all panel shapes into a chat-left + cascading grid layout.
 * Returns the number of shapes repositioned.
 */
export function autoArrangeWhiteboardPanels(
  editor: Editor,
  options: AutoArrangeWhiteboardPanelsOptions = {},
): number {
  const viewport = editor.getViewportPageBounds();
  const chrome = resolveWhiteboardChromeInsets(viewport.w, options);
  const originX = snapToGrid(viewport.x + chrome.left);
  const originY = snapToGrid(viewport.y + chrome.top);
  const maxRight = viewport.x + viewport.w - WHITEBOARD_VIEWPORT_INSET;

  const slots = readPanelShapes(editor).sort(sortWhiteboardPanelOrder);
  if (slots.length === 0) return 0;

  const chat = slots.find((slot) => slot.panelId === 'chat');
  const others = slots.filter((slot) => slot.panelId !== 'chat');
  let moved = 0;

  let chatBottom = originY;
  let tileOriginX = originX;
  let cursorX = originX;
  let cursorY = originY;
  let rowHeight = 0;

  if (chat) {
    const chatSize = defaultWhiteboardPanelSize(editor, 'chat');
    placeSlot(editor, chat, originX, originY, chatSize.w, chatSize.h);
    moved += 1;
    chatBottom = snapToGrid(originY + chatSize.h);
    tileOriginX = snapToGrid(originX + chatSize.w + GAP);
    cursorX = tileOriginX;
    cursorY = originY;
    rowHeight = 0;
  }

  for (const slot of others) {
    const sized = defaultWhiteboardPanelSize(editor, slot.panelId);

    // Wrap to next tile row when the next panel would overflow the free right edge.
    if (cursorX > tileOriginX && cursorX + sized.w > maxRight) {
      cursorX = tileOriginX;
      cursorY = snapToGrid(cursorY + rowHeight + GAP);
      rowHeight = 0;
    }

    // Wider than the tile column: place on free-canvas left below chat (never under Menu).
    if (cursorX + sized.w > maxRight) {
      cursorX = originX;
      if (chat && cursorY < chatBottom) {
        cursorY = snapToGrid(chatBottom + GAP);
        rowHeight = 0;
      } else if (cursorX === originX && rowHeight > 0) {
        cursorY = snapToGrid(cursorY + rowHeight + GAP);
        rowHeight = 0;
      }
    }

    placeSlot(editor, slot, cursorX, cursorY, sized.w, sized.h);
    moved += 1;

    cursorX = snapToGrid(cursorX + sized.w + GAP);
    rowHeight = Math.max(rowHeight, sized.h);
  }

  return moved;
}
