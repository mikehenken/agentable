import path from 'path';
import type { Plugin } from 'vite';
import { defineEmbedWidgetConfig } from './vite.embed-widget-shared';

const canvasToolsPath = path.resolve(process.cwd(), 'src/agents/tools/canvasTools.ts');
const proxyPath = path.resolve(process.cwd(), 'src/embed/operatorCanvasToolsProxy.ts');
const editableKeyboardPath = path.resolve(process.cwd(), 'src/shared/editableKeyboardTarget.ts');
const editableKeyboardStubPath = path.resolve(
  process.cwd(),
  'src/embed/operatorEditableKeyboardTarget.ts');
const panelShapeApiPath = path.resolve(
  process.cwd(),
  'src/engines/tldraw/shapes/panelShapeApi.ts');
const panelShapeApiStubPath = path.resolve(
  process.cwd(),
  'src/embed/operatorPanelShapeHostStub.ts');
const viewportSyncPath = path.resolve(
  process.cwd(),
  'src/engines/tldraw/hooks/useWhiteboardViewportScreenBoundsSync.ts');
const viewportSyncStubPath = path.resolve(
  process.cwd(),
  'src/embed/operatorViewportSyncStub.ts');

function operatorEmbedProxyPlugin(): Plugin {
  return {
    name: 'operator-embed-proxy',
    enforce: 'pre',
    resolveId(source, importer) {
      if (
        source === canvasToolsPath ||
        source.endsWith('agents/tools/canvasTools') ||
        source.endsWith('/tools/canvasTools') ||
        source === '../tools/canvasTools' ||
        source === './canvasTools'
      ) {
        return proxyPath;
      }
      if (
        source === editableKeyboardPath ||
        source.endsWith('shared/editableKeyboardTarget') ||
        source === '../../shared/editableKeyboardTarget' ||
        source === '../shared/editableKeyboardTarget'
      ) {
        return editableKeyboardStubPath;
      }
      if (
        source === panelShapeApiPath ||
        source.endsWith('shapes/panelShapeApi') ||
        source.endsWith('/panelShapeApi')
      ) {
        return panelShapeApiStubPath;
      }
      if (
        source === viewportSyncPath ||
        source.endsWith('useWhiteboardViewportScreenBoundsSync')
      ) {
        return viewportSyncStubPath;
      }
      if (
        importer !== undefined &&
        (source === '../tools/canvasTools' ||
          source === './canvasTools' ||
          source.endsWith('/tools/canvasTools'))
      ) {
        return proxyPath;
      }
      return null;
    },
  };
}

export default defineEmbedWidgetConfig({
  fileBase: 'agentable-operator-surface-placement',
  umdName: 'AgentableOperatorSurfacePlacement',
  entry: 'src/embed/agentable-operator-surface-placement.ts',
  reactSurface: true,
  // Heavy tldraw-bearing surface: code-split the ESM build (UMD stays single).
  chunked: true,
  extraPlugins: [operatorEmbedProxyPlugin],
  resolveAlias: {
    [canvasToolsPath]: proxyPath,
    [editableKeyboardPath]: editableKeyboardStubPath,
    [panelShapeApiPath]: panelShapeApiStubPath,
    [viewportSyncPath]: viewportSyncStubPath,
  },
});
