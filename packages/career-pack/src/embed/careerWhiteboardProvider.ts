/**
 * Career whiteboard wiring provider — registers with core without importing Lit embed.
 */
import {
  registerWhiteboardWiringProvider,
  type WhiteboardWiringProviderInput,
  type WhiteboardWiringProviderResult,
} from '../../../../src/embed/whiteboard/whiteboardWiringProviderRegistry';
import { registerCareerWhiteboard } from '../whiteboard/registerCareerWhiteboard';

let unregisterProvider: (() => void) | null = null;

function resolveCareerEmbedWiring(
  input: WhiteboardWiringProviderInput,
): WhiteboardWiringProviderResult | null {
  const result = registerCareerWhiteboard({
    tenantConfig: input.tenantConfig,
    configDocument: input.configDocument,
    panelDataRaw: input.panelDataRaw,
    fetchFn: input.fetchFn,
  });

  if (result.host === undefined || result.panels === undefined) {
    return null;
  }

  return {
    host: result.host,
    navItems: result.navItems,
    panels: result.panels,
    adapterSources: result.adapterSources,
    dispose: result.dispose,
  };
}

/** Idempotent — call after `<agentable-whiteboard>` / `<agentable-canvas>` script loads. */
export function ensureCareerWhiteboardEmbedProviderRegistered(): void {
  if (unregisterProvider !== null) {
    return;
  }
  unregisterProvider = registerWhiteboardWiringProvider(resolveCareerEmbedWiring);
}

/** Test helper — tear down provider registration. */
export function unregisterCareerWhiteboardEmbedProvider(): void {
  unregisterProvider?.();
  unregisterProvider = null;
}
