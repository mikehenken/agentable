/**
 * Default whiteboard snap settings — 20px grid aligned with panelLayoutEngine.
 */
import type { Editor } from 'tldraw';
import { GRID_SIZE } from '../../canvas/panelLayoutEngine';

/** Enable grid overlay, snap mode, and document grid size on editor mount. */
export function configureWhiteboardSnap(editor: Editor): void {
  editor.updateDocumentSettings({ gridSize: GRID_SIZE });
  editor.updateInstanceState({ isGridMode: true });
  editor.user.updateUserPreferences({ isSnapMode: true });
}
