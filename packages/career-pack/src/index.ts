export {
  DEFAULT_CAREER_AGENT_JOBS_GUIDE,
  enrichCareerAgentSystemPrompt,
} from './careerToolGrounding';

export {
  resolveCareerChatBundle,
  resolveCareerSystemPrompt,
  CAREER_SUPPRESSED_CORE_TOOLS,
  HELIOS_STARTER_PROMPTS_WITH_TOOLS,
  ARCHIPELAGO_STARTER_PROMPTS_WITH_TOOLS,
  type CareerChatBundle,
  type CareerSuppressedCoreTool,
} from './careerChatBundle';

export { HELIOS_CAREER_SYSTEM_PROMPT } from './prompts/heliosSystemPrompt';
export { ARCHIPELAGO_CAREER_SYSTEM_PROMPT, ARCHIPELAGO_VOICE_GREETING } from './prompts/archipelagoSystemPrompt';

export {
  CAREER_PANEL_IDS,
  CAREER_SOURCE_NAMES,
  CAREER_TOOL_NAMES,
  type CareerPanelId,
  type CareerSourceName,
  type CareerToolName,
} from './constants';

export {
  createCareerPack,
  extendCareerPack,
  resolveCareerHostConfig,
  toEmbedConfigDocument,
  toReactHostConfig,
  createCareerTools,
  createCareerPanelDefinitions,
  createCareerPersonaScaffold,
  type CareerToolRuntime,
} from './pack';

export {
  createStaticCareerAdapter,
  resolveCareerDatasetInput,
  type StaticCareerAdapterOptions,
  type StaticCareerDatasetInput,
} from './adapters/staticCareerAdapter';

export {
  careerDatasetToPanelData,
  coalesceCareerPanelDataPayload,
  isCareerDatasetPanelPayload,
  type CareerPanelDataPayload,
} from './adapters/careerDatasetToPanelData';

export {
  parseCareerDataset,
  validateCareerDataset,
  careerDatasetSchema,
  type ParsedCareerDataset,
} from './schema/careerDatasetSchema';

export type {
  CareerAdapterMutateSource,
  CareerAdapterQuerySource,
  CareerAdapterSourceContract,
  CareerApplyMutatePayload,
  CareerJobQueryParams,
  CareerJobsQueryParams,
  AtsWorkerBackedAdapterSource,
  FixtureOnlyAdapterSource,
} from './schema/adapterSourceContract';

export type {
  AtsCreateApplicationRequest,
  AtsCreateApplicationResponse,
  AtsGetJobResponse,
  AtsListApplicationsQueryParams,
  AtsListApplicationsResponse,
  AtsListJobsQueryParams,
  AtsListJobsResponse,
  AtsSyncStatusResponse,
  AtsWorkerApplicationRecord,
  AtsWorkerEndpointSourceMap,
  AtsWorkerJobRecord,
  AtsWorkerTenantId,
} from './schema/workerEndpointTypes';

export {
  CAREER_WORKER_FORWARD_COMPAT_PROOF_COUNT,
  type CareerWorkerForwardCompatProof,
} from './schema/forwardCompat.assert';

export { convertHeliosPanelData, convertArchipelagoCareerData } from './fixtures/convert-from-sources';

export type { CareerPackExtensions, CareerPackExtensionPoints } from './extension-points';

export type {
  CareerApplication,
  CareerDataset,
  CareerGrowthPath,
  CareerHostConfig,
  CareerJob,
  CareerNavItem,
  CareerPack,
  CareerPackOptions,
  CareerPersonaScaffold,
  CareerResource,
} from './types';

export { MINIMAL_CAREER_DATASET } from './fixtures/minimal-dataset';
export { HELIOS_CAREER_DATASET } from './fixtures/helios-dataset';
export { ARCHIPELAGO_CAREER_DATASET } from './fixtures/archipelago-dataset';

export {
  HELIOS_STARTER_PROMPTS,
  HELIOS_STARTER_PROMPTS_ES,
  HELIOS_PERSONA_EN,
  HELIOS_PERSONA_ES,
  createHeliosEmbedConfig,
  resolveHeliosPersona,
  type HeliosLocaleTag,
  type HeliosPersonaLocale,
  type CreateHeliosEmbedConfigInput,
} from './tenants/helios';

export {
  registerCareerWhiteboard,
  type RegisterCareerWhiteboardInput,
  type RegisterCareerWhiteboardResult,
  type RegisterCareerWhiteboardOutput,
} from './whiteboard/registerCareerWhiteboard';

export {
  useCareerWhiteboardWiring,
  disposeCareerWiringSession,
  type UseCareerWhiteboardWiringInput,
  type CareerWhiteboardWiring,
} from './whiteboard/useCareerWhiteboardWiring';

export {
  applyCareerHomepageFirstPaint,
  type ApplyCareerHomepageFirstPaintOptions,
} from './whiteboard/applyCareerHomepageFirstPaint';

export {
  DEFAULT_CAREER_BOUNDED_MODE,
  DEFAULT_CAREER_EMBED_CANVAS_ATTRS,
  DEFAULT_CAREER_TOOLBAR_CONFIG,
  DEFAULT_CAREER_HOST_CHROME,
  CAREER_HOMEPAGE_EMBED_PERSISTENCE_SCOPE,
  applyCareerEmbedDefaults,
  resolveCareerWhiteboardShellDefaults,
  resolveCareerHostChrome,
  resolveCareerHomepageEmbedHostChrome,
  type WhiteboardHostChromeConfig,
} from './whiteboard/careerCanvasDefaults';

export { createCareerNavFooterRenderer } from './whiteboard/createCareerNavFooterRenderer';
export { CareerNavFooter } from './whiteboard/CareerNavFooter';

export {
  ARCHIPELAGO_STARTER_PROMPTS,
  ARCHIPELAGO_STARTER_PROMPTS_ES,
  ARCHIPELAGO_PERSONA_EN,
  ARCHIPELAGO_PERSONA_ES,
  ARCHIPELAGO_BRAND_LOGO,
  createArchipelagoEmbedConfig,
  resolveArchipelagoPersona,
  type ArchipelagoLocaleTag,
  type ArchipelagoPersonaLocale,
  type CreateArchipelagoEmbedConfigInput,
} from './tenants/archipelago';

export {
  CAREER_TENANT_PRIMARY_COLORS,
  CAREER_TENANT_TOKEN_NOTES,
  applyCareerTenantBrandTokens,
  resolveCareerTenantPrimaryColor,
  type CareerTenantPrimaryId,
} from './tenants/careerTenantTokens';
