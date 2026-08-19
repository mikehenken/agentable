import { defineEmbedWidgetConfig } from './vite.embed-widget-shared';

export default defineEmbedWidgetConfig({
  fileBase: 'agentable-operator-surface',
  umdName: 'AgentableOperatorSurface',
  entry: 'src/embed/agentable-operator-surface.ts',
  reactSurface: true,
});
