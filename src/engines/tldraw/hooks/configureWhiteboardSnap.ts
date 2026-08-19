/**
 * Default whiteboard snap settings — 20px grid aligned with panelLayoutEngine.
 */
import type { Editor } from 'tldraw';
import { GRID_SIZE } from '../../../layout/panelLayoutEngine';

export interface ConfigureWhiteboardSnapOptions {
  /** When false, grid overlay and snap mode stay off (embed `snap-grid` contract). */
  enabled?: boolean;
}

/** Configure grid overlay, snap mode, and document grid size on editor mount. */
export function configureWhiteboardSnap(
  editor: Editor,
  options: ConfigureWhiteboardSnapOptions = {},
): void {
  const enabled = options.enabled ?? true;
  editor.updateDocumentSettings({ gridSize: GRID_SIZE });
  editor.updateInstanceState({ isGridMode: enabled });
  editor.user.updateUserPreferences({ isSnapMode: enabled });
}
