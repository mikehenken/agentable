export {
  SUPPORT_INBOX_PANEL_IDS,
  SUPPORT_INBOX_SOURCE_NAMES,
  SUPPORT_INBOX_TOOL_NAMES,
  type SupportInboxPanelId,
  type SupportInboxSourceName,
  type SupportInboxToolName,
} from './constants';

export {
  createSupportInboxPack,
  extendSupportInboxPack,
  resolveSupportInboxHostConfig,
  toEmbedConfigDocument,
  toReactHostConfig,
  createSupportInboxTools,
  createSupportInboxPanelDefinitions,
  createSupportInboxPersonaScaffold,
  type SupportInboxToolRuntime,
} from './pack';

export {
  createStaticSupportInboxAdapter,
  resolveSupportDatasetInput,
  type StaticSupportInboxAdapterOptions,
  type StaticSupportInboxDatasetInput,
} from './adapters/staticSupportInboxAdapter';

export {
  supportDatasetToPanelData,
  coalesceSupportPanelDataPayload,
  isSupportDatasetPanelPayload,
} from './adapters/supportDatasetToPanelData';

export {
  parseSupportDataset,
  validateSupportDataset,
  isSupportDatasetDocument,
  supportDatasetSchema,
  type ParsedSupportDataset,
} from './schema/supportDatasetSchema';

export type {
  SupportInboxAdapterMutateSource,
  SupportInboxAdapterQuerySource,
  SupportInboxAdapterSourceContract,
  SupportMacrosQueryParams,
  SupportMessagesQueryParams,
  SupportReplyMutatePayload,
  SupportTicketQueryParams,
  SupportTicketsQueryParams,
} from './schema/adapterSourceContract';

export type { SupportInboxPackExtensions, SupportInboxPackExtensionPoints } from './extension-points';

export type {
  SupportDataset,
  SupportInboxHostConfig,
  SupportInboxNavItem,
  SupportInboxPack,
  SupportInboxPackOptions,
  SupportInboxPersonaScaffold,
  SupportMacro,
  SupportMessage,
  SupportTicket,
  SupportTicketPriority,
  SupportTicketStatus,
} from './types';

export { MINIMAL_SUPPORT_DATASET } from './fixtures/minimal-dataset';
