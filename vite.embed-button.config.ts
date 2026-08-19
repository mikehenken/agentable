/**
 * vite.embed-button.config.ts — library build for `<voice-call-button>`.
 */
import { defineEmbedWidgetConfig } from './vite.embed-widget-shared';

export default defineEmbedWidgetConfig({
  fileBase: 'voice-call-button',
  umdName: 'VoiceCallButton',
  entry: 'src/embed/widgets/voice-call-button.ts',
});
