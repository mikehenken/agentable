import { StateNode } from 'tldraw';
import { autoArrangeWhiteboardPanels } from '../layout/autoArrangeWhiteboardPanels';
import {
  AUTO_ARRANGE_TOOL_ID,
  emitWhiteboardAutoArrange,
} from './layoutActionEvents';

class AutoArrangeIdle extends StateNode {
  static override id = 'idle';
}

/**
 * Toolbar action tool — auto-arranges PanelShapes then returns to select.
 */
export class AutoArrangeTool extends StateNode {
  static override id = AUTO_ARRANGE_TOOL_ID;
  static override initial = 'idle';
  static override isLockable = false;

  static override children() {
    return [AutoArrangeIdle];
  }

  override onEnter(): void {
    try {
      autoArrangeWhiteboardPanels(this.editor);
    } catch (err) {
      console.error('[AutoArrangeTool] arrange failed', err);
    }
    emitWhiteboardAutoArrange();
    this.editor.setCurrentTool('select');
  }
}
