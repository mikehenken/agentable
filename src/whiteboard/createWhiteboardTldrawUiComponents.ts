import { createElement, type ReactElement } from 'react';
import type { TLUiComponents } from 'tldraw';
import { TextSearchPanel } from './components/TextSearchPanel';
import { WhiteboardOverlays } from './components/WhiteboardOverlays';
import { minimalTldrawUiComponents } from './minimalTldrawUiComponents';
import { WhiteboardToolbar } from './WhiteboardToolbar';

export interface WhiteboardTldrawUiOptions {
  /** Register site-actions in the toolbar overflow menu (landi-canvas-studio host). */
  enableSiteActionsTool?: boolean;
  /** Register layers tree panel + toolbar toggle (default on infinite-panels). */
  enableLayersPanel?: boolean;
  /** Floating toolbar when a site context frame (or its panels) is selected. */
  enableSiteContextToolbar?: boolean;
  /** Canvas text search via HelperButtons + Ctrl/Cmd+F (default true). */
  enableTextSearch?: boolean;
}

/** Build tldraw UI component overrides for WhiteboardShell. */
export function createWhiteboardTldrawUiComponents(
  options: WhiteboardTldrawUiOptions = {},
): TLUiComponents {
  const {
    enableSiteActionsTool = false,
    enableLayersPanel = false,
    enableSiteContextToolbar = false,
    enableTextSearch = true,
  } = options;
  const useCustomToolbar = enableSiteActionsTool || enableLayersPanel;
  const useOverlays = true;

  if (!useCustomToolbar && !useOverlays && !enableTextSearch) {
    return minimalTldrawUiComponents;
  }

  return {
    ...minimalTldrawUiComponents,
    ...(enableTextSearch ? { HelperButtons: TextSearchPanel } : {}),
    ...(useCustomToolbar
      ? {
          Toolbar: (props) =>
            createElement(WhiteboardToolbar, {
              ...props,
              enableSiteActionsTool,
              enableLayersPanel,
            }),
        }
      : {}),
    ...(useOverlays
      ? {
          InFrontOfTheCanvas: () =>
            createElement(WhiteboardOverlays, {
              enableLayersPanel,
              enableSiteContextToolbar,
            }),
        }
      : {}),
  };
}
