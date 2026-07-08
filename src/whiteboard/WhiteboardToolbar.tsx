import type { ReactElement } from 'react';
import {
  DefaultToolbar,
  DefaultToolbarContent,
  ToolbarItem,
  type DefaultToolbarProps,
} from 'tldraw';
import { SITE_ACTIONS_TOOL_ID } from './tools/siteActionsEvents';

/** Default tldraw toolbar plus site-actions item (overflows on narrow viewports). */
export function WhiteboardToolbar(props: DefaultToolbarProps): ReactElement {
  return (
    <DefaultToolbar {...props}>
      <DefaultToolbarContent />
      <ToolbarItem tool={SITE_ACTIONS_TOOL_ID} />
    </DefaultToolbar>
  );
}
