import { createElement, type ReactElement } from 'react';
import type { TLUiComponents } from 'tldraw';
import { LayersPanel } from './components/LayersPanel';
import { TextSearchPanel } from './components/TextSearchPanel';
import { minimalTldrawUiComponents } from './minimalTldrawUiComponents';
import { WhiteboardToolbar } from './WhiteboardToolbar';

export interface WhiteboardTldrawUiOptions {
  /** Register site-actions in the toolbar overflow menu (landi-canvas-studio host). */
  enableSiteActionsTool?: boolean;
  /** Register layers tree panel + toolbar toggle (default on infinite-panels). */
  enableLayersPanel?: boolean;
  /** Canvas text search via HelperButtons + Ctrl/Cmd+F (default true). */
  enableTextSearch?: boolean;
}

function WhiteboardInFrontOfTheCanvas(): ReactElement {
  return createElement(LayersPanel);
}

/** Build tldraw UI component overrides for WhiteboardShell. */
export function createWhiteboardTldrawUiComponents(
  options: WhiteboardTldrawUiOptions = {},
): TLUiComponents {
  const {
    enableSiteActionsTool = false,
    enableLayersPanel = false,
    enableTextSearch = true,
  } = options;
  const useCustomToolbar = enableSiteActionsTool || enableLayersPanel;

  if (!useCustomToolbar && !enableLayersPanel && !enableTextSearch) {
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
    ...(enableLayersPanel ? { InFrontOfTheCanvas: WhiteboardInFrontOfTheCanvas } : {}),
  };
}
