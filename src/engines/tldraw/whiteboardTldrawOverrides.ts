import type { Editor, TLUiOverrides } from 'tldraw';
import { CONTEXT_ACTIONS_TOOL_ID } from './tools/contextActionsEvents';

/** UI overrides for the optional site-actions overflow toolbar tool. */
export const contextActionsTldrawOverrides: TLUiOverrides = {
  tools(editor: Editor, tools, _helpers) {
    tools[CONTEXT_ACTIONS_TOOL_ID] = {
      id: CONTEXT_ACTIONS_TOOL_ID,
      icon: 'external-link',
      label: 'tools.site-actions',
      onSelect: () => {
        if (editor.getCurrentToolId() === CONTEXT_ACTIONS_TOOL_ID) {
          editor.setCurrentTool('select');
          return;
        }
        editor.setCurrentTool(CONTEXT_ACTIONS_TOOL_ID);
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
