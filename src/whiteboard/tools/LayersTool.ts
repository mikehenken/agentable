import { StateNode } from '@tldraw/editor';
import { emitLayersPanelChange } from './layersEvents';

/** Idle child — layers is a panel-toggle tool, not a drawing mode. */
class LayersIdle extends StateNode {
  static override id = 'idle';
}

/**
 * Opens the layers shape-tree panel while active.
 * Deselecting the tool (or choosing another) hides the panel via onExit.
 */
export class LayersTool extends StateNode {
  static override id = 'layers';
  static override initial = 'idle';
  static override isLockable = false;

  static override children() {
    return [LayersIdle];
  }

  override onEnter(): void {
    emitLayersPanelChange(true);
  }

  override onExit(): void {
    emitLayersPanelChange(false);
  }

  override onInterrupt(): void {
    this.editor.setCurrentTool('select');
  }
}
