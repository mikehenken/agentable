import type { ReactElement } from 'react';
import {
  DefaultToolbar,
  DefaultToolbarContent,
  ToolbarItem,
  type DefaultToolbarProps,
} from 'tldraw';
import { LAYERS_TOOL_ID } from './tools/layersEvents';
import { SITE_ACTIONS_TOOL_ID } from './tools/siteActionsEvents';

export interface WhiteboardToolbarProps extends DefaultToolbarProps {
  enableSiteActionsTool?: boolean;
  enableLayersPanel?: boolean;
}

/** Default tldraw toolbar plus optional overflow tools (layers, site-actions). */
export function WhiteboardToolbar({
  enableSiteActionsTool = false,
  enableLayersPanel = false,
  ...props
}: WhiteboardToolbarProps): ReactElement {
  return (
    <DefaultToolbar {...props}>
      <DefaultToolbarContent />
      {enableLayersPanel ? <ToolbarItem tool={LAYERS_TOOL_ID} /> : null}
      {enableSiteActionsTool ? <ToolbarItem tool={SITE_ACTIONS_TOOL_ID} /> : null}
    </DefaultToolbar>
  );
}
