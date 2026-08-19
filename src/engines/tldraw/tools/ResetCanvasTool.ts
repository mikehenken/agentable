import { StateNode } from 'tldraw';
import { resetWhiteboardLayout } from '../layout/resetWhiteboardLayout';
import {
  emitWhiteboardResetCanvas,
  RESET_CANVAS_TOOL_ID,
} from './layoutActionEvents';

class ResetCanvasIdle extends StateNode {
  static override id = 'idle';
}

/**
 * Toolbar action tool — resets camera + panel layout then returns to select.
 */
export class ResetCanvasTool extends StateNode {
  static override id = RESET_CANVAS_TOOL_ID;
  static override initial = 'idle';
  static override isLockable = false;

  static override children() {
    return [ResetCanvasIdle];
  }

  override onEnter(): void {
    try {
      resetWhiteboardLayout(this.editor, { openChat: true, resetCamera: true });
    } catch (err) {
      console.error('[ResetCanvasTool] reset failed', err);
    }
    emitWhiteboardResetCanvas();
    this.editor.setCurrentTool('select');
  }
}
