import type { TLUiComponents } from 'tldraw';
import { minimalTldrawUiComponents } from './minimalTldrawUiComponents';
import { WhiteboardToolbar } from './WhiteboardToolbar';

export interface WhiteboardTldrawUiOptions {
  /** Register site-actions in the toolbar overflow menu (landi-canvas-studio host). */
  enableSiteActionsTool?: boolean;
}

/** Build tldraw UI component overrides for WhiteboardShell. */
export function createWhiteboardTldrawUiComponents(
  options: WhiteboardTldrawUiOptions = {},
): TLUiComponents {
  if (!options.enableSiteActionsTool) {
    return minimalTldrawUiComponents;
  }
  return {
    ...minimalTldrawUiComponents,
    Toolbar: WhiteboardToolbar,
  };
}
