/**
 * — documented career whiteboard entry point (core-typed return values only).
 */
import type { PartialCanvasTenantConfig } from '../../../../src/config/CanvasContext';
import type { RawPanelDataPayload } from '../../../../src/config/panelDataNormalize';
import type { NavItemConfig } from '../../../../src/components/chrome/navItems';
import type { CanvasHost } from '../../../../src/panels/host';
import type { WhiteboardPanelRegistry } from '../../../../src/engines/tldraw/shapes/whiteboardPanelRegistry';
import type { EmbedConfigDocument } from '../../../../src/embed/types/embedConfig';
import {
  createCareerWhiteboardHostBundle,
  disposeCareerWhiteboardHostBundle,
  shouldRegisterCareerWhiteboardPanels,
  KNOWN_CAREER_TENANT_IDS,
  type CareerWhiteboardHostBundle,
  type CreateCareerWhiteboardHostBundleInput,
} from './createCareerWhiteboardHostBundle';
import {
  resolveCareerChatBundle,
  resolveCareerSystemPrompt,
} from '../careerChatBundle';

export interface RegisterCareerWhiteboardInput {
  tenantConfig: PartialCanvasTenantConfig;
  configDocument: EmbedConfigDocument | null;
  panelDataRaw: RawPanelDataPayload | null;
  fetchFn?: typeof fetch;
}

export interface RegisterCareerWhiteboardResult {
  host: CanvasHost;
  navItems: NavItemConfig[];
  panels: WhiteboardPanelRegistry;
  adapterSources: readonly string[];
  dispose: () => void;
}

export interface RegisterCareerWhiteboardEmptyResult {
  host?: undefined;
  navItems: NavItemConfig[];
  panels?: undefined;
  dispose: () => void;
}

export type RegisterCareerWhiteboardOutput =
  | RegisterCareerWhiteboardResult
  | RegisterCareerWhiteboardEmptyResult;

function toBundleInput(input: RegisterCareerWhiteboardInput): CreateCareerWhiteboardHostBundleInput {
  const tenant = input.tenantConfig.tenant ?? 'career-default';
  const normalizedTenant = tenant.trim().toLowerCase();
  const panelData = input.panelDataRaw ?? input.tenantConfig.panelData ?? null;
  const agentJobsGuide =
    panelData !== null &&
    typeof panelData === 'object' &&
    'agentJobsGuide' in panelData &&
    typeof (panelData as { agentJobsGuide?: unknown }).agentJobsGuide === 'string'
      ? (panelData as { agentJobsGuide: string }).agentJobsGuide: undefined;

  const chatBundle = resolveCareerChatBundle(tenant);
  const effectiveBase = resolveCareerSystemPrompt(
    tenant,
    input.tenantConfig.persona?.systemPrompt);
  const enrichedPrompt = chatBundle.enrichSystemPrompt(effectiveBase, agentJobsGuide);

  const tenantConfig: PartialCanvasTenantConfig = {...input.tenantConfig,
    tenant,
    persona: {...input.tenantConfig.persona,
      systemPrompt: enrichedPrompt,
      starterPrompts: KNOWN_CAREER_TENANT_IDS.has(normalizedTenant)
        ? [...chatBundle.starterPrompts]: (input.tenantConfig.persona?.starterPrompts ?? [...chatBundle.starterPrompts]),
    },
  };

  return {
    configDocument: input.configDocument,
    tenantConfig,
    panelDataRaw: input.panelDataRaw,
    tenant,
    fetchFn: input.fetchFn,
  };
}

/**
 * Register career panels, nav, and host for a whiteboard embed or React wrapper.
 * Returns empty wiring when career registration predicates are not met.
 */
export function registerCareerWhiteboard(
  input: RegisterCareerWhiteboardInput): RegisterCareerWhiteboardOutput {
  const bundleInput = toBundleInput(input);
  if (!shouldRegisterCareerWhiteboardPanels(bundleInput)) {
    return {
      navItems: [],
      dispose: () => {},
    };
  }

  const bundle = createCareerWhiteboardHostBundle(bundleInput);
  return {
    host: bundle.host,
    navItems: bundle.navItems,
    panels: bundle.panelLoaders,
    adapterSources: bundle.adapterSources,
    dispose: () => disposeCareerWhiteboardHostBundle(bundle),
  };
}

/** @internal Retained for tests and embed provider wiring. */
export {
  createCareerWhiteboardHostBundle,
  disposeCareerWhiteboardHostBundle,
  shouldRegisterCareerWhiteboardPanels,
  type CareerWhiteboardHostBundle,
  type CreateCareerWhiteboardHostBundleInput,
};

export { resolveCareerChatBundle, type CareerChatBundle } from '../careerChatBundle';
