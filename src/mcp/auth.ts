/**
 * Canvas-over-MCP auth pattern.
 * Reuses the landing-editor NAS OAuth stack *pattern* (RFC 9728/8414 scopes,
 * Bearer tokens, KV-backed session records) — not landi platform routes.
 *
 * Secrets are referenced by key name only; values never appear in logs or tests.
 */
import {
  ALL_CANVAS_MCP_SCOPES,
  DEFAULT_CANVAS_MCP_API_KEY_SCOPES,
  sanitizeRequestedScopes,
  type CanvasMcpScope,
} from './scopes';

export const AUTH_SCOPE_DENIED_CODE = 'AUTH_SCOPE_DENIED';
export const AUTH_MISSING_TOKEN_CODE = 'AUTH_MISSING_TOKEN';
export const AUTH_INVALID_TOKEN_CODE = 'AUTH_INVALID_TOKEN';

export const CANVAS_MCP_ACCESS_TOKEN_PREFIX = 'canvas_mcp_at_';
export const CANVAS_MCP_REFRESH_TOKEN_PREFIX = 'canvas_mcp_rt_';

/** Env keys for wrangler Cloudflare ( — names only). */
export const CANVAS_MCP_OAUTH_ENV_KEY_NAMES = [
  'MCP_OAUTH_ISSUER',
  'MCP_RESOURCE_URI',
  'MCP_CREDENTIAL_PEPPER',
  'CANVAS_MCP_OAUTH_KV',
] as const;

export type CanvasMcpOAuthEnvKeyName = (typeof CANVAS_MCP_OAUTH_ENV_KEY_NAMES)[number];

export interface CanvasMcpOAuthEnv {
  // MCP_OAUTH_ISSUER?: string;
  // MCP_RESOURCE_URI?: string;
  // MCP_CREDENTIAL_PEPPER?: string;
  // CANVAS_MCP_OAUTH_KV?: KVNamespace;
}

export interface CanvasMcpTokenRecord {
  accessToken: string;
  refreshToken?: string;
  workspaceId: string;
  agentId: string;
  scopes: string[];
  resource: string;
  expiresAtMs: number;
}

export interface CanvasMcpAuthContext {
  workspaceId: string;
  agentId: string;
  scopes: readonly string[];
  resource: string;
}

export interface CanvasMcpAuthStore {
  get(accessToken: string): CanvasMcpTokenRecord | undefined;
  set(record: CanvasMcpTokenRecord): void;
}

export function createInMemoryCanvasMcpAuthStore(): CanvasMcpAuthStore {
  const records = new Map<string, CanvasMcpTokenRecord>();
  return {
    get(accessToken: string): CanvasMcpTokenRecord | undefined {
      const record = records.get(accessToken);
      if (record === undefined) {
        return undefined;
      }
      if (record.expiresAtMs <= Date.now()) {
        records.delete(accessToken);
        return undefined;
      }
      return record;
    },
    set(record: CanvasMcpTokenRecord): void {
      records.set(record.accessToken, record);
    },
  };
}

export interface MintTestTokenInput {
  workspaceId: string;
  agentId?: string;
  scopes?: readonly string[];
  resource?: string;
  ttlMs?: number;
  nowMs?: number;
}

let testTokenCounter = 0;

/** Deterministic-enough test token minting — no live secrets required. */
export function mintTestAccessToken(
  store: CanvasMcpAuthStore,
  input: MintTestTokenInput): string {
  testTokenCounter += 1;
  const nowMs = input.nowMs ?? Date.now();
  const accessToken = `${CANVAS_MCP_ACCESS_TOKEN_PREFIX}test_${testTokenCounter}`;
  const record: CanvasMcpTokenRecord = {
    accessToken,
    workspaceId: input.workspaceId,
    agentId: input.agentId ?? 'mcp-external-client',
    scopes: sanitizeRequestedScopes([...(input.scopes ?? DEFAULT_CANVAS_MCP_API_KEY_SCOPES)]),
    resource: input.resource ?? 'https://canvas-mcp.dev/canvas/mcp',
    expiresAtMs: nowMs + (input.ttlMs ?? 60 * 60 * 1000),
  };
  store.set(record);
  return accessToken;
}

export function resetTestTokenCounterForTests(): void {
  testTokenCounter = 0;
}

export function parseBearerToken(authorizationHeader: string | null): string | null {
  if (authorizationHeader === null) {
    return null;
  }
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorizationHeader.trim());
  return match?.[1] ?? null;
}

export function authenticateAccessToken(
  store: CanvasMcpAuthStore,
  accessToken: string | null,
  options?: { workspaceId?: string; nowMs?: number }): CanvasMcpAuthContext | { code: typeof AUTH_MISSING_TOKEN_CODE | typeof AUTH_INVALID_TOKEN_CODE } {
  if (accessToken === null || accessToken.length === 0) {
    return { code: AUTH_MISSING_TOKEN_CODE };
  }
  const record = store.get(accessToken);
  const nowMs = options?.nowMs ?? Date.now();
  if (record === undefined || record.expiresAtMs <= nowMs) {
    return { code: AUTH_INVALID_TOKEN_CODE };
  }
  if (options?.workspaceId !== undefined && record.workspaceId !== options.workspaceId) {
    return { code: AUTH_INVALID_TOKEN_CODE };
  }
  return {
    workspaceId: record.workspaceId,
    agentId: record.agentId,
    scopes: record.scopes,
    resource: record.resource,
  };
}

export function resolveIssuer(
  env: Pick<CanvasMcpOAuthEnv, 'MCP_OAUTH_ISSUER'>,
  requestUrl: URL): string {
  return (env.MCP_OAUTH_ISSUER ?? `${requestUrl.protocol}${requestUrl.host}`).replace(/\/$/, '');
}

export function resolveResourceUri(
  env: Pick<CanvasMcpOAuthEnv, 'MCP_OAUTH_ISSUER' | 'MCP_RESOURCE_URI'>,
  requestUrl: URL): string {
  if (env.MCP_RESOURCE_URI?.trim()) {
    return env.MCP_RESOURCE_URI.replace(/\/$/, '');
  }
  const issuer = resolveIssuer(env, requestUrl);
  return `${issuer}/canvas/mcp`;
}

export function protectedResourceMetadata(
  env: CanvasMcpOAuthEnv,
  requestUrl: URL): Record<string, unknown> {
  const resource = resolveResourceUri(env, requestUrl);
  const issuer = resolveIssuer(env, requestUrl);
  return {
    resource,
    authorization_servers: [issuer],
    scopes_supported: ALL_CANVAS_MCP_SCOPES,
    bearer_methods_supported: ['header'],
  };
}

export function authorizationServerMetadata(
  env: CanvasMcpOAuthEnv,
  requestUrl: URL): Record<string, unknown> {
  const issuer = resolveIssuer(env, requestUrl);
  return {
    issuer,
    authorization_endpoint: `${issuer}/canvas/oauth/authorize`,
    token_endpoint: `${issuer}/canvas/oauth/token`,
    registration_endpoint: `${issuer}/canvas/oauth/register`,
    revocation_endpoint: `${issuer}/canvas/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ALL_CANVAS_MCP_SCOPES,
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
  };
}

export function formatAuthScopeDenied(toolName: string): string {
  return `${AUTH_SCOPE_DENIED_CODE}: token lacks scope for "${toolName}"`;
}

export type { CanvasMcpScope };
