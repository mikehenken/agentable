/**
 * Node-side open-agent-canvas gallery scenario — core + PDF export checks.
 */
import { MERIDIAN_DOCUMENT_ID } from '../../../examples/12-open-agent-canvas/fixtures/meridianLabs';
import {
  createExportDocumentHostAction,
  createPanelDocumentResolver,
  createPersistedDocumentStore,
  DOCUMENT_EXPORT_EPOCH,
  exportDocument,
  sha256Bytes,
} from '../../../src/panels/document';
import { EXPORT_DOCUMENT_HOST_ACTION_ID } from '../../../src/panels/document/exportTypes';
import {
  runOpenAgentCanvasScenarioCore,
  type OpenAgentCanvasE2eCheck,
  type OpenAgentCanvasE2eResult,
} from './openAgentCanvasScenarioCore';

export type { OpenAgentCanvasE2eCheck, OpenAgentCanvasE2eResult };

const PERSISTENCE_KEY = 'p12-t7-open-agent-canvas-gallery';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function runOpenAgentCanvasE2eScenario(): Promise<OpenAgentCanvasE2eResult> {
  const panelDocumentBindings = new Map<string, string>();
  const documentStore = createPersistedDocumentStore({
    persistenceKey: PERSISTENCE_KEY,
    seed: {
      [MERIDIAN_DOCUMENT_ID]: {
        documentId: MERIDIAN_DOCUMENT_ID,
        title: 'Meridian Labs Product Brief',
        blocks: [],
      },
    },
  });

  const exportHostAction = createExportDocumentHostAction({
    resolveDocument: createPanelDocumentResolver(
      (panelId) => {
        const documentId = panelDocumentBindings.get(panelId);
        return documentId !== undefined ? { documentId }: null;
      },
      documentStore),
  });

  const coreResult = await runOpenAgentCanvasScenarioCore({
    hostActions: [exportHostAction],
    usePersistedDocumentStore: true,
    persistenceKey: PERSISTENCE_KEY,
    documentStore,
    onDocumentReady: async ({ panelId, builtDocument }) => {
      panelDocumentBindings.set(panelId, MERIDIAN_DOCUMENT_ID);

      const extraChecks: OpenAgentCanvasE2eCheck[] = [];

      const exportFirst = await exportHostAction.handler({ panelId, format: 'pdf' });
      const exportSecond = await exportHostAction.handler({ panelId, format: 'pdf' });

      const firstSha =
        exportFirst.ok && isRecord(exportFirst.result) && typeof exportFirst.result.sha256 === 'string'
          ? exportFirst.result.sha256: undefined;
      const secondSha =
        exportSecond.ok && isRecord(exportSecond.result) && typeof exportSecond.result.sha256 === 'string'
          ? exportSecond.result.sha256: undefined;

      extraChecks.push({
        name: 'export_document returns PDF under open policy',
        ok: exportFirst.ok === true && firstSha !== undefined && firstSha.length === 64,
        detail: exportFirst.ok ? `sha256=${firstSha}`: exportFirst.error,
      });

      extraChecks.push({
        name: 'export bytes are stable on repeat export',
        ok:
          exportFirst.ok === true &&
          exportSecond.ok === true &&
          firstSha !== undefined &&
          firstSha === secondSha,
      });

      extraChecks.push({
        name: 'export_document host action id is stable ',
        ok: EXPORT_DOCUMENT_HOST_ACTION_ID === 'export_document',
      });

      const directExport = await exportDocument(builtDocument, 'pdf', {
        fixedTimestamp: DOCUMENT_EXPORT_EPOCH,
      });
      extraChecks.push({
        name: 'block-model export uses fixed epoch (no HTML round-trip)',
        ok: sha256Bytes(directExport.bytes) === directExport.sha256,
        detail: directExport.filename,
      });

      return extraChecks;
    },
  });

  return coreResult;
}
