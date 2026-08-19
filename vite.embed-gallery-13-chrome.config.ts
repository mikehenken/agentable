import { defineEmbedWidgetConfig } from './vite.embed-widget-shared';

export default defineEmbedWidgetConfig({
  fileBase: 'agentable-gallery-13-chrome',
  umdName: 'AgentableGallery13Chrome',
  entry: 'src/embed/gallery/gallery13ChromeEntry.tsx',
  reactSurface: true,
});
