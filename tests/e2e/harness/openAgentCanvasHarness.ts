/**
 * Browser entry: open-agent-canvas core scenario + export contract check (no node:crypto).
 */
import { EXPORT_DOCUMENT_HOST_ACTION_ID } from '../../../src/panels/document/exportTypes';
import {
  runOpenAgentCanvasScenarioCore,
  type OpenAgentCanvasE2eResult,
} from './openAgentCanvasScenarioCore';

declare global {
  interface Window {
    __openAgentCanvasE2eResult?: OpenAgentCanvasE2eResult;
    __runOpenAgentCanvasE2e?: () => Promise<OpenAgentCanvasE2eResult>;
  }
}

async function runOpenAgentCanvasBrowserScenario(): Promise<OpenAgentCanvasE2eResult> {
  const core = await runOpenAgentCanvasScenarioCore({ usePersistedDocumentStore: false });
  const checks = [...core.checks,
    {
      name: 'export_document host action contract declared ',
      ok: EXPORT_DOCUMENT_HOST_ACTION_ID === 'export_document',
    },
  ];
  return {
    ok: checks.every((check) => check.ok),
    checks,
    brand: core.brand,
  };
}

window.__runOpenAgentCanvasE2e = runOpenAgentCanvasBrowserScenario;

void runOpenAgentCanvasBrowserScenario().then((result) => {
  window.__openAgentCanvasE2eResult = result;
});
