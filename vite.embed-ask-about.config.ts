import { defineEmbedWidgetConfig } from './vite.embed-widget-shared';

export default defineEmbedWidgetConfig({
  fileBase: 'ask-about-this-button',
  umdName: 'AskAboutThisButton',
  entry: 'src/embed/widgets/ask-about-this-button.ts',
});
