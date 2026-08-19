/**
 * Operator-only gallery mode (P13-T7): suppress Atlas chat PanelShape on canvas.
 * Persistence can restore a chat panel even when openChatOnMount is false — purge
 * on mount and guard the store so operator rail remains the sole chat surface.
 */
import { createShapeId, type Editor, type TLShapeId } from 'tldraw';
import { CHAT_PANEL_ID } from '../../../choreography/constants';

let suppressActive = false;
let guardUnbind: (() => void) | null = null;

export function setCanvasChatSuppressed(active: boolean): void {
  suppressActive = active;
  if (!active) {
    guardUnbind?.();
    guardUnbind = null;
  }
}

export function isCanvasChatSuppressed(): boolean {
  return suppressActive;
}

function readPanelId(shape: { type: string; props: unknown }): string | undefined {
  if (shape.type !== 'panel') {
    return undefined;
  }
  const props = shape.props as { panelId?: unknown };
  return typeof props.panelId === 'string' ? props.panelId : undefined;
}

/** Shape ids for chat PanelShape instances on the current page. */
export function listChatPanelShapeIds(editor: Editor): TLShapeId[] {
  const canonicalId = createShapeId(`panel:${CHAT_PANEL_ID}`);
  return editor
    .getCurrentPageShapes()
    .filter((shape) => {
      if (shape.id === canonicalId) {
        return true;
      }
      return readPanelId(shape) === CHAT_PANEL_ID;
    })
    .map((shape) => shape.id);
}

/** Remove chat PanelShape instances; returns count deleted. */
export function purgeChatPanelShapes(editor: Editor): number {
  const ids = listChatPanelShapeIds(editor);
  if (ids.length > 0) {
    editor.deleteShapes(ids);
  }
  return ids.length;
}

/** True when any chat PanelShape is present on the canvas. */
export function hasChatPanelShape(editor: Editor): boolean {
  return listChatPanelShapeIds(editor).length > 0;
}

/**
 * Subscribe to document changes and delete chat panel shapes as they appear
 * (persistence restore, open_chat tool, command palette, etc.).
 */
export function bindCanvasChatSuppressionGuard(editor: Editor): () => void {
  guardUnbind?.();

  purgeChatPanelShapes(editor);

  const unlisten = editor.store.listen(
    () => {
      if (!suppressActive) {
        return;
      }
      const ids = listChatPanelShapeIds(editor);
      if (ids.length > 0) {
        editor.deleteShapes(ids);
      }
    },
    { source: 'user', scope: 'document' },
  );

  guardUnbind = () => {
    unlisten();
    guardUnbind = null;
  };

  return guardUnbind;
}

/** Test helper — reset module state between cases. */
export function resetCanvasChatSuppressionForTests(): void {
  guardUnbind?.();
  guardUnbind = null;
  suppressActive = false;
}
