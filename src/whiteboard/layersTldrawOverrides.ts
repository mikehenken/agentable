import type { Editor, TLUiOverrides } from 'tldraw';
import { LAYERS_TOOL_ID } from './tools/layersEvents';

/** UI overrides for the optional layers overflow toolbar tool. */
export const layersTldrawOverrides: TLUiOverrides = {
  tools(editor: Editor, tools, _helpers) {
    tools[LAYERS_TOOL_ID] = {
      id: LAYERS_TOOL_ID,
      icon: 'stack-vertical',
      label: 'tools.layers',
      onSelect: () => {
        if (editor.getCurrentToolId() === LAYERS_TOOL_ID) {
          editor.setCurrentTool('select');
          return;
        }
        editor.setCurrentTool(LAYERS_TOOL_ID);
      },
    };
    return tools;
  },
  translations: {
    en: {
      'tools.layers': 'Layers',
    },
  },
};
