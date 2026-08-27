/**
 * Career whiteboard wiring provider — registers with core without importing Lit embed.
 */
import {
  registerWhiteboardWiringProvider,
  type WhiteboardWiringProviderInput,
  type WhiteboardWiringProviderResult,
} from '../../../../src/embed/whiteboard/whiteboardWiringProviderRegistry';
import { registerCareerWhiteboard } from '../whiteboard/registerCareerWhiteboard';
import { createCareerNavFooterRenderer } from '../whiteboard/createCareerNavFooterRenderer';

let unregisterProvider: (() => void) | null = null;

/**
 * Career nav footer, owned by the pack rather than by core. Built once so the
 * renderer identity stays stable across resolves and the shell can memoize it.
 */
const renderCareerNavFooter = createCareerNavFooterRenderer();

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
    renderNavFooter: renderCareerNavFooter,
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
