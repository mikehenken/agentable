import { defineEmbedWidgetConfig } from './vite.embed-widget-shared';

export default defineEmbedWidgetConfig({
  fileBase: 'agentable-starter-chip',
  umdName: 'AgentableStarterChip',
  entry: 'src/embed/widgets/agentable-starter-chip.ts',
});
