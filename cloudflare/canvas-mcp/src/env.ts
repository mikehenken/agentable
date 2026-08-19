/**
 * Canvas-over-MCP worker env.
 * Secret values are bound by name in wrangler — never logged or committed.
 */
import type { CanvasMcpOAuthEnv } from '../../src/mcp/auth';

export interface Env extends CanvasMcpOAuthEnv {
  // MCP_OAUTH_ISSUER?: string;
  // MCP_RESOURCE_URI?: string;
  // MCP_CREDENTIAL_PEPPER?: string;
  // CANVAS_MCP_OAUTH_KV?: KVNamespace;
}

export const CANVAS_MCP_ROUTE = '/canvas/mcp';

export function canvasMcpEnvKeyNames(env: Env): string[] {
  return [
    'MCP_OAUTH_ISSUER',
    'MCP_RESOURCE_URI',
    'MCP_CREDENTIAL_PEPPER',
    'CANVAS_MCP_OAUTH_KV',
  ].filter((key) => env[key as keyof Env] !== undefined);
}
