import { createElement } from 'react';
import type { TLComponents } from 'tldraw';
import { TextSearchPanel } from './components/TextSearchPanel';
import { WhiteboardOverlays } from './components/WhiteboardOverlays';
import { minimalTldrawUiComponents } from './minimalTldrawUiComponents';
import { WhiteboardToolbar } from './WhiteboardToolbar';
import type {
  ResolvedWhiteboardToolbarConfig,
  WhiteboardToolbarConfig,
} from './toolbar/toolbarConfig';
import { resolveWhiteboardToolbarConfig } from './toolbar/toolbarConfig';

export interface WhiteboardTldrawUiOptions {
  /** First-class toolbar config (preferred). */
  toolbarConfig?: WhiteboardToolbarConfig | ResolvedWhiteboardToolbarConfig;
  /** Pre-resolved plan — skips re-resolution when Shell already resolved. */
  resolvedToolbar?: ResolvedWhiteboardToolbarConfig;
  /** Register site-actions in the toolbar overflow menu (landi-canvas-studio host). */
  enableContextActionsTool?: boolean;
  /** Register layers tree panel + toolbar toggle (default on infinite-panels). */
  enableLayersPanel?: boolean;
  /** Include voice tool on the bottom toolbar (default true for career embeds). */
  enableVoiceTool?: boolean;
  /** Floating toolbar when a site context frame (or its panels) is selected. */
  enableContextToolbar?: boolean;
  /** Canvas text search via HelperButtons + Ctrl/Cmd+F (default true). */
  enableTextSearch?: boolean;
}

function isResolvedToolbar(
  value: WhiteboardToolbarConfig | ResolvedWhiteboardToolbarConfig | undefined,
): value is ResolvedWhiteboardToolbarConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as ResolvedWhiteboardToolbarConfig).toolbarTools)
  );
}

/** Build tldraw UI component overrides for WhiteboardShell. */
export function createWhiteboardTldrawUiComponents(
  options: WhiteboardTldrawUiOptions = {},
): TLComponents {
  const {
    enableContextActionsTool = false,
    enableLayersPanel = false,
    enableVoiceTool = true,
    enableContextToolbar = false,
    enableTextSearch = true,
  } = options;

  const resolved: ResolvedWhiteboardToolbarConfig =
    options.resolvedToolbar ??
    (isResolvedToolbar(options.toolbarConfig)
      ? options.toolbarConfig
      : resolveWhiteboardToolbarConfig({
          toolbarConfig: options.toolbarConfig,
          enableContextActionsTool,
          enableLayersPanel,
          enableVoiceTool,
        }));

  return {
    ...minimalTldrawUiComponents,
    ...(enableTextSearch ? { HelperButtons: TextSearchPanel } : {}),
    Toolbar: (props) =>
      createElement(WhiteboardToolbar, {
        ...props,
        toolbarConfig: resolved,
      }),
    InFrontOfTheCanvas: () =>
      createElement(WhiteboardOverlays, {
        enableLayersPanel: resolved.enableLayersPanel,
        enableContextToolbar,
      }),
  };
}
