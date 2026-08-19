/**
 * Streamable HTTP MCP worker entry.
 * Dev/preview scaffold — deploy gated; no secrets in repo.
 *
 * Live workspace panel tools attach through the dev bridge (browser host → worker).
 * Vitest uses InMemoryTransport against the same registration code in src/mcp/.
 */
import { CANVAS_MCP_ROUTE, type Env } from './env';
import { routeCanvasMcpOAuth } from './oauth/routes';
import { AUTH_MISSING_TOKEN_CODE, parseBearerToken } from '../../../src/mcp/auth';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    const oauth = await routeCanvasMcpOAuth(request, env);
    if (oauth.kind === 'response') {
      return oauth.response;
    }

    if (url.pathname === CANVAS_MCP_ROUTE || url.pathname.startsWith(`${CANVAS_MCP_ROUTE}/`)) {
      const token = parseBearerToken(request.headers.get('Authorization'));
      if (token === null) {
        return Response.json(
          { error: AUTH_MISSING_TOKEN_CODE, message: 'Bearer token required' },
          { status: 401, headers: { 'WWW-Authenticate': 'Bearer resource="/canvas/mcp"' } });
      }

       // Streamable HTTP MCP session attaches when a live workspace registers.
       // Full DO + agents/mcp wiring ships with preview deploy — tests use InMemoryTransport.
      return Response.json(
        {
          error: 'WORKSPACE_NOT_ATTACHED',
          message:
            'Canvas MCP worker scaffold is up; connect a live dev workspace bridge to enable tool execution.',
          mcp_route: CANVAS_MCP_ROUTE,
          account_id: 'dd84ae290b8a011725410e223c0ea928',
        },
        { status: 503 });
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return Response.json({ ok: true, service: 'agentable-canvas-mcp' });
    }

    return new Response('Not Found', { status: 404 });
  },
};
