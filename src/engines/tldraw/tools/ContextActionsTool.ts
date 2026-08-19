import { StateNode } from 'tldraw';
import { emitSiteActionsPanelChange } from './contextActionsEvents';

/** Idle child — site-actions is a panel-toggle tool, not a drawing mode. */
class SiteActionsIdle extends StateNode {
  static override id = 'idle';
}

/**
 * Opens the host site-actions panel (edit + publish) while active.
 * Deselecting the tool (or choosing another) hides the panel via onExit.
 */
export class ContextActionsTool extends StateNode {
  static override id = 'site-actions';
  static override initial = 'idle';
  static override isLockable = false;

  static override children() {
    return [SiteActionsIdle];
  }

  override onEnter(): void {
    emitSiteActionsPanelChange(true);
  }

  override onExit(): void {
    emitSiteActionsPanelChange(false);
  }

  override onInterrupt(): void {
    this.editor.setCurrentTool('select');
  }
}
