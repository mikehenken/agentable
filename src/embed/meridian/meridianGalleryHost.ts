/**
 * Meridian Labs gallery canvas host.
 * Wires document panel + export_document host action for embed demos.
 */
import { createDocumentPanelDefinition } from '../../agents/panels/documentPanel';
import { createWhiteboardEngine, type WhiteboardEngineHandle } from '../../engines/tldraw/engine';
import { createCanvasHost, type CanvasHost } from '../../panels/host';
import {
  createExportDocumentHostAction,
  createPanelDocumentResolver,
  createPersistedDocumentStore,
  withDocumentSource,
  WORKSPACE_DOCUMENTS_SOURCE,
  type DocumentPayload,
  type DocumentStore,
} from '../../panels/document';
import {
  MERIDIAN_AGENT,
  MERIDIAN_DOCUMENT_ID,
  MERIDIAN_PRODUCT_BRIEF_TITLE,
} from '../../../examples/12-open-agent-canvas/fixtures/meridianLabs';

export const MERIDIAN_GALLERY_PERSISTENCE_KEY = 'p12-t7-open-agent-canvas-gallery';

export interface MeridianGalleryHostBundle {
  host: CanvasHost;
  engine: WhiteboardEngineHandle;
  documentStore: DocumentStore;
  exportDocument: ReturnType<typeof createExportDocumentHostAction>;
  bindPanelDocument(panelInstanceId: string): void;
}

const panelDocumentBindings = new Map<string, string>();

let activeBundle: MeridianGalleryHostBundle | null = null;

function emptyMeridianDocument(): DocumentPayload {
  return {
    documentId: MERIDIAN_DOCUMENT_ID,
    title: MERIDIAN_PRODUCT_BRIEF_TITLE,
    blocks: [],
  };
}

export function createMeridianGalleryHostBundle(): MeridianGalleryHostBundle {
  const engine = createWhiteboardEngine();
  const documentStore = createPersistedDocumentStore({
    persistenceKey: MERIDIAN_GALLERY_PERSISTENCE_KEY,
    seed: { [MERIDIAN_DOCUMENT_ID]: emptyMeridianDocument() },
  });

  const exportDocument = createExportDocumentHostAction({
    resolveDocument: createPanelDocumentResolver(
      (panelId) => {
        const documentId = panelDocumentBindings.get(panelId);
        return documentId !== undefined ? { documentId } : null;
      },
      documentStore),
  });

  const host = createCanvasHost({
    engine: engine,
    adapter: withDocumentSource(documentStore),
    panels: [createDocumentPanelDefinition()],
    hostActions: [exportDocument],
  });

  host.agents.register({
    id: MERIDIAN_AGENT.agentId,
    kind: 'chat',
    label: MERIDIAN_AGENT.agentLabel,
    transport: 'chat',
    allowedTools: [
      'draw_shapes',
      'insert_image',
      'connect_shapes',
      'group_shapes',
      'frame_shapes',
      'arrange',
      'open_panel',
      'compose_panel',
      'fill_panel',
      'run_panel_action',
      'export_document',
    ],
    allowedPanels: ['document'],
  });

  return {
    host,
    engine: engine,
    documentStore,
    exportDocument,
    bindPanelDocument(panelInstanceId: string): void {
      panelDocumentBindings.set(panelInstanceId, MERIDIAN_DOCUMENT_ID);
    },
  };
}

export function setMeridianGalleryHostBundle(bundle: MeridianGalleryHostBundle | null): void {
  activeBundle = bundle;
}

export function getMeridianGalleryHostBundle(): MeridianGalleryHostBundle | null {
  return activeBundle;
}

export function disposeMeridianGalleryHostBundle(): void {
  if (activeBundle === null) return;
  activeBundle.host.dispose();
  activeBundle = null;
  panelDocumentBindings.clear();
}

export { WORKSPACE_DOCUMENTS_SOURCE };
