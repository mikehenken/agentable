import type { ReactElement } from 'react';
import {
  DefaultToolbar,
  ToolbarItem,
  type DefaultToolbarProps,
} from 'tldraw';
import type { ResolvedWhiteboardToolbarConfig } from './toolbar/toolbarConfig';
import { resolveWhiteboardToolbarConfig } from './toolbar/toolbarConfig';

export interface WhiteboardToolbarProps extends DefaultToolbarProps {
  /**
   * Resolved toolbar plan. When omitted, career defaults (+ optional legacy
   * boolean shims below) are used.
   */
  toolbarConfig?: ResolvedWhiteboardToolbarConfig;
  /** @deprecated Prefer `toolbarConfig` host `WhiteboardToolbarConfig`. */
  enableContextActionsTool?: boolean;
  /** @deprecated Prefer `toolbarConfig` host `WhiteboardToolbarConfig`. */
  enableLayersPanel?: boolean;
  /** @deprecated Prefer `toolbarConfig` host `WhiteboardToolbarConfig`. */
  enableVoiceTool?: boolean;
}

/**
 * Career whiteboard toolbar — renders tools in resolved config order.
 * Defaults: select, draw, hand, layers, voice (+ layout actions when placed in toolbar).
 */
export function WhiteboardToolbar({
  toolbarConfig,
  enableContextActionsTool = false,
  enableLayersPanel = false,
  enableVoiceTool = true,...props
}: WhiteboardToolbarProps): ReactElement {
  const resolved =
    toolbarConfig ??
    resolveWhiteboardToolbarConfig({
      enableContextActionsTool,
      enableLayersPanel,
      enableVoiceTool,
    });

  return (
    <DefaultToolbar {...props}>
      {resolved.toolbarTools.map((toolId) => (
        <ToolbarItem key={toolId} tool={toolId} />
      ))}
    </DefaultToolbar>
  );
}
