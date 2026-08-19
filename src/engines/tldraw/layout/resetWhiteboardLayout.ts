/**
 * Reset whiteboard camera + panel layout to career-demo defaults.
 * Chat re-opens at the viewport-aware default size/position; other panels close.
 * Placement clears the live Menu (NavSidebar) expanded/collapsed chrome.
 */
import type { Editor } from 'tldraw';
import { createShapeId } from 'tldraw';
import { snapToGrid } from '../../../layout/panelLayoutEngine';
import { defaultWhiteboardPanelSize } from '../context/contextFramePanelLayout';
import {
  closePanelInCanvas,
  openPanelInCanvas,
} from '../shapes/panelShapeApi';
import {
  resolveWhiteboardChromeInsets,
  type ResolveWhiteboardChromeInsetsOptions,
} from './whiteboardChromeInsets';

export interface ResetWhiteboardLayoutOptions extends ResolveWhiteboardChromeInsetsOptions {
  /** Re-open chat after clearing other panels. Default true. */
  openChat?: boolean;
  /** Reset camera to identity (no pan/zoom). Default true. */
  resetCamera?: boolean;
  /**
   * Delete all drawn content (agent and user marks) along with the panels.
   * Default true: a Reset that leaves every old sketch on the board is not
   * a reset, and stale drawings force every new one to dodge them.
   */
  clearContent?: boolean;
}

function listPanelIds(editor: Editor): string[] {
  const ids: string[] = [];
  for (const shape of editor.getCurrentPageShapes()) {
    // The panel shape util is host-registered, so its type string sits
    // outside tldraw's built-in TLShape union.
    if ((shape.type as string) !== 'panel') continue;
    const panelId = (shape.props as { panelId?: string }).panelId;
    if (typeof panelId === 'string' && panelId.length > 0) {
      ids.push(panelId);
    }
  }
  return ids;
}

/**
 * Clear non-chat panels, reset camera, and place chat at the default layout.
 * Returns the number of panels closed (excluding chat recreate).
 */
export function resetWhiteboardLayout(
  editor: Editor,
  options: ResetWhiteboardLayoutOptions = {},
): number {
  const openChat = options.openChat ?? true;
  const resetCamera = options.resetCamera ?? true;
  const clearContent = options.clearContent ?? true;

  const panelIds = listPanelIds(editor);
  let closed = 0;
  for (const panelId of panelIds) {
    if (closePanelInCanvas(panelId)) {
      closed += 1;
    } else {
      // Fallback if api binding is stale — delete by shape id.
      const id = createShapeId(`panel:${panelId}`);
      if (editor.getShape(id)) {
        editor.deleteShapes([id]);
        closed += 1;
      }
    }
  }

  if (clearContent) {
    const leftover = editor
      .getCurrentPageShapes()
      .filter((shape) => (shape.type as string) !== 'panel')
      .map((shape) => shape.id);
    if (leftover.length > 0) {
      editor.deleteShapes(leftover);
    }
  }

  if (resetCamera) {
    editor.setCamera({ x: 0, y: 0, z: 1 }, { animation: { duration: 0 } });
  }

  if (openChat) {
    const viewport = editor.getViewportPageBounds();
    const chrome = resolveWhiteboardChromeInsets(viewport.w, options);
    const chatSize = defaultWhiteboardPanelSize(editor, 'chat');
    openPanelInCanvas('chat', {
      focus: false,
      preserveZoom: true,
      position: {
        x: snapToGrid(viewport.x + chrome.left),
        y: snapToGrid(viewport.y + chrome.top),
      },
      size: chatSize,
      chrome: { title: 'Chat', minimized: false },
    });
  }

  return closed;
}
