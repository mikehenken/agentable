/**
 * OAuth discovery route scaffold (pattern-only).
 * Full PKCE flow mirrors landing-editor NAS OAuth — not wired to Supabase in v1.
 */
import {
  authorizationServerMetadata,
  protectedResourceMetadata,
  type CanvasMcpOAuthEnv,
} from '../../../src/mcp/auth';

export type OAuthRouteResult =
  | { kind: 'response'; response: Response }
  | { kind: 'not_found' };

export async function routeCanvasMcpOAuth(
  request: Request,
  env: CanvasMcpOAuthEnv): Promise<OAuthRouteResult> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/.well-known/oauth-protected-resource/canvas/mcp' && request.method === 'GET') {
    return {
      kind: 'response',
      response: Response.json(protectedResourceMetadata(env, url)),
    };
  }

  if (path === '/.well-known/oauth-authorization-server' && request.method === 'GET') {
    return {
      kind: 'response',
      response: Response.json(authorizationServerMetadata(env, url)),
    };
  }

  if (path === '/canvas/oauth/health' && request.method === 'GET') {
    return {
      kind: 'response',
      response: Response.json({
        ok: true,
        service: 'agentable-canvas-mcp-oauth',
        pattern: 'landing-editor-nas-oauth',
        note: 'Token minting scaffold — attach live workspace via dev bridge',
      }),
    };
  }

  return { kind: 'not_found' };
}
