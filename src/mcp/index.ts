export {
  CANVAS_MCP_SCOPES,
  ALL_CANVAS_MCP_SCOPES,
  DEFAULT_CANVAS_MCP_API_KEY_SCOPES,
  CANVAS_MCP_READ_TOOLS,
  CANVAS_MCP_ACT_TOOLS,
  CANVAS_MCP_DIGEST_TOOLS,
  parseScopeString,
  sanitizeRequestedScopes,
  isToolAllowedByTokenScope,
  isReadTool,
  isActTool,
  isDigestTool,
} from './scopes';

export {
  AUTH_SCOPE_DENIED_CODE,
  AUTH_MISSING_TOKEN_CODE,
  AUTH_INVALID_TOKEN_CODE,
  CANVAS_MCP_ACCESS_TOKEN_PREFIX,
  CANVAS_MCP_OAUTH_ENV_KEY_NAMES,
  createInMemoryCanvasMcpAuthStore,
  mintTestAccessToken,
  resetTestTokenCounterForTests,
  parseBearerToken,
  authenticateAccessToken,
  resolveIssuer,
  resolveResourceUri,
  protectedResourceMetadata,
  authorizationServerMetadata,
  formatAuthScopeDenied,
  type CanvasMcpAuthContext,
  type CanvasMcpAuthStore,
  type CanvasMcpOAuthEnv,
  type CanvasMcpTokenRecord,
} from './auth';

export {
  buildMcpToolCatalog,
  executeWorkspaceTool,
  executeWorkspaceToolWithAuth,
  SCOPE_DENIED_CODE,
  type LiveWorkspaceBridge,
  type WorkspaceToolExecutionOutcome,
} from './workspaceBridge';

export { MCP_TOOL_SCHEMAS } from './toolSchemas';

export {
  registerCanvasMcpTools,
  createCanvasMcpServerMetadata,
} from './registerTools';

export {
  createCanvasMcpFixture,
  callCanvasMcpTool,
  type CanvasMcpFixture,
} from './fixture';
