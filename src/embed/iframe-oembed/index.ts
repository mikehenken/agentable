/** Public exports for iframe + oEmbed fallback. */
export {
  EMBED_BRIDGE_VERSION,
  IFRAME_EMBED_SANDBOX,
  IFRAME_EMBED_DEFAULT_WIDTH,
  IFRAME_EMBED_DEFAULT_HEIGHT,
  createBridgeEnvelope,
  parseBridgeEnvelope,
  isParentBridgeCommand,
  isChildBridgeEvent,
  type EmbedBridgeEnvelope,
  type EmbedBridgeSurface,
  type EmbedBridgeMessageType,
} from './iframe/embedBridgeProtocol';

export {
  parseAllowedOrigins,
  isOriginAllowed,
  resolveParentOriginFromReferrer,
} from './iframe/originValidation';

export {
  createIframeChildBridge,
  readParentOriginAllowlistFromSearchParams,
  createBridgeIdFromParams,
  type IframeChildBridge,
  type IframeChildBridgeOptions,
} from './iframe/iframeChildBridge';

export {
  applySandboxedIframeAttributes,
  createIframeParentBridge,
  type IframeParentBridge,
  type IframeParentBridgeOptions,
} from './iframe/iframeParentBridge';

export {
  buildIframeHostUrl,
  parseIframeHostUrl,
  buildSandboxedIframeHtml,
  readIframeHostParamsFromSearchParams,
  type IframeHostEmbedParams,
} from './iframe/iframeHostUrl';

export { bootstrapIframeHostPage } from './iframe/iframeHostBootstrap';

export {
  buildOEmbedDiscoveryLink,
  renderOEmbedDiscoveryLinkTag,
  buildOEmbedResponseForIframeParams,
  handleOEmbedRequest,
  parseOEmbedQuery,
  serializeOEmbedResponse,
  createOEmbedHttpHandler,
  resolveOEmbedTitle,
} from './oembed/oEmbedDiscovery';

export type {
  OEmbedDiscoveryLink,
  OEmbedRichResponse,
  OEmbedErrorResponse,
  OEmbedResponse,
  OEmbedRequestParams,
} from './oembed/oEmbedTypes';

export { AgentableIframeEmbedElement } from './agentable-iframe-embed';
