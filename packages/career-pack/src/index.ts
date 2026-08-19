export {
  DEFAULT_CAREER_AGENT_JOBS_GUIDE,
  enrichCareerAgentSystemPrompt,
} from './careerToolGrounding';

export {
  resolveCareerChatBundle,
  resolveCareerSystemPrompt,
  CAREER_SUPPRESSED_CORE_TOOLS,
  MOSS_STARTER_PROMPTS_WITH_TOOLS,
  SANDALS_STARTER_PROMPTS_WITH_TOOLS,
  type CareerChatBundle,
  type CareerSuppressedCoreTool,
} from './careerChatBundle';

export { MOSS_CAREER_SYSTEM_PROMPT } from './prompts/mossSystemPrompt';
export { SANDALS_CAREER_SYSTEM_PROMPT, SANDALS_VOICE_GREETING } from './prompts/sandalsSystemPrompt';

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

export { convertMossPanelData, convertSandalsCareerData } from './fixtures/convert-from-sources';

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
export { MOSS_CAREER_DATASET } from './fixtures/moss-dataset';
export { SANDALS_CAREER_DATASET } from './fixtures/sandals-dataset';

export {
  MOSS_STARTER_PROMPTS,
  MOSS_STARTER_PROMPTS_ES,
  MOSS_PERSONA_EN,
  MOSS_PERSONA_ES,
  createMossEmbedConfig,
  resolveMossPersona,
  type MossLocaleTag,
  type MossPersonaLocale,
  type CreateMossEmbedConfigInput,
} from './tenants/moss';

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
  SANDALS_STARTER_PROMPTS,
  SANDALS_STARTER_PROMPTS_ES,
  SANDALS_PERSONA_EN,
  SANDALS_PERSONA_ES,
  SANDALS_BRAND_LOGO,
  createSandalsEmbedConfig,
  resolveSandalsPersona,
  type SandalsLocaleTag,
  type SandalsPersonaLocale,
  type CreateSandalsEmbedConfigInput,
} from './tenants/sandals';

export {
  CAREER_TENANT_PRIMARY_COLORS,
  CAREER_TENANT_TOKEN_NOTES,
  applyCareerTenantBrandTokens,
  resolveCareerTenantPrimaryColor,
  type CareerTenantPrimaryId,
} from './tenants/careerTenantTokens';
