import { defineEmbedWidgetConfig } from './vite.embed-widget-shared';

export default defineEmbedWidgetConfig({
  fileBase: 'agent-status-pill',
  umdName: 'AgentStatusPill',
  entry: 'src/embed/widgets/agent-status-pill.ts',
});
