import type { Editor, TLUiOverrides } from 'tldraw';
import { ensureVoiceKernel } from '../../shared/voiceKernel';
import { emitWhiteboardVoiceToggle, VOICE_TOOL_ID } from './tools/voiceEvents';
import { VOICE_TOOL_ICON_ID } from './voice/voiceToolbarIcon';

/** UI overrides for the voice toolbar tool (Talk to Sandy / Gemini Live). */
export const voiceTldrawOverrides: TLUiOverrides = {
  tools(editor: Editor, tools) {
    tools[VOICE_TOOL_ID] = {
      id: VOICE_TOOL_ID,
      icon: VOICE_TOOL_ICON_ID,
      label: 'tools.voice',
      onSelect: () => {
        try {
          ensureVoiceKernel().voice.toggle();
        } catch (err) {
          console.error('[voiceTldrawOverrides] voice toggle failed', err);
        }
        emitWhiteboardVoiceToggle();
        if (editor.getCurrentToolId() === VOICE_TOOL_ID) {
          editor.setCurrentTool('select');
        }
      },
    };
    return tools;
  },
  translations: {
    en: {
      'tools.voice': 'Talk',
    },
  },
};
