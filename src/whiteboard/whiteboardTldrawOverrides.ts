import type { Editor, TLUiOverrides } from 'tldraw';
import { SITE_ACTIONS_TOOL_ID } from './tools/siteActionsEvents';

/** UI overrides for the optional site-actions overflow toolbar tool. */
export const siteActionsTldrawOverrides: TLUiOverrides = {
  tools(editor: Editor, tools, _helpers) {
    tools[SITE_ACTIONS_TOOL_ID] = {
      id: SITE_ACTIONS_TOOL_ID,
      icon: 'external-link',
      label: 'tools.site-actions',
      onSelect: () => {
        if (editor.getCurrentToolId() === SITE_ACTIONS_TOOL_ID) {
          editor.setCurrentTool('select');
          return;
        }
        editor.setCurrentTool(SITE_ACTIONS_TOOL_ID);
      },
    };
    return tools;
  },
  translations: {
    en: {
      'tools.site-actions': 'Site actions',
    },
  },
};
