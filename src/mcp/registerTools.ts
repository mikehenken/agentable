/**
 * Register canvas-over-MCP tools on an MCP server instance.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CanvasMcpAuthContext, CanvasMcpAuthStore } from './auth';
import { formatAuthScopeDenied } from './auth';
import { isToolAllowedByTokenScope } from './scopes';
import { MCP_TOOL_SCHEMAS, type McpToolSchemaName } from './toolSchemas';
import {
  buildMcpToolCatalog,
  executeWorkspaceToolWithAuth,
  type LiveWorkspaceBridge,
} from './workspaceBridge';
import { getWorkspaceDigestSchema } from './toolSchemas';

export interface RegisterCanvasMcpToolsOptions {
  server: McpServer;
  bridge: LiveWorkspaceBridge;
  authStore: CanvasMcpAuthStore;
  /** Bearer token for the connected MCP client session. */
  accessToken: string;
}

function formatMcpToolResult(outcome: Awaited<ReturnType<typeof executeWorkspaceToolWithAuth>>) {
  if (!outcome.ok) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, error: outcome.error, code: outcome.code }) }],
      isError: true as const,
    };
  }
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, result: outcome.result }) }],
  };
}

function digestInputFromBridge(bridge: LiveWorkspaceBridge) {
  return {
    user: { id: 'mcp-client' },
    contexts: [],
    agents: bridge.registry.list().map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      label: entry.label,
      scope: entry.scope,
      status: entry.status,
      task: entry.task,
    })),
    recentActivity: bridge.activity.getEntries({ limit: 15 }),
  };
}

function registerDigestTool(
  options: RegisterCanvasMcpToolsOptions,
  auth: CanvasMcpAuthContext): void {
  options.server.registerTool(
    'get_workspace_digest',
    {
      description:
        'Read the current workspace digest (attention tiers, panels, agents, activity). Read-only.',
      inputSchema: getWorkspaceDigestSchema,
    },
    async (args) => {
      if (!isToolAllowedByTokenScope('get_workspace_digest', auth.scopes)) {
        return formatMcpToolResult({
          ok: false,
          error: formatAuthScopeDenied('get_workspace_digest'),
          code: 'AUTH_SCOPE_DENIED',
        });
      }

      const mode = typeof args.mode === 'string' ? args.mode: 'delta';
      if (mode === 'full') {
        const full = options.bridge.digest.full(digestInputFromBridge(options.bridge));
        return formatMcpToolResult({ ok: true, result: full.digest });
      }

      const { result, delta } = options.bridge.digest.deltaFor(
        auth.agentId,
        digestInputFromBridge(options.bridge));
      return formatMcpToolResult({
        ok: true,
        result: { digest: result.digest, delta },
      });
    });
}

export function registerCanvasMcpTools(options: RegisterCanvasMcpToolsOptions): void {
  const catalog = buildMcpToolCatalog(options.bridge);
  const authResult = options.authStore.get(options.accessToken.replace(/^Bearer\s+/i, ''));
  if (authResult === undefined) {
    throw new Error('registerCanvasMcpTools: access token not found in auth store');
  }
  const auth: CanvasMcpAuthContext = {
    workspaceId: authResult.workspaceId,
    agentId: authResult.agentId,
    scopes: authResult.scopes,
    resource: authResult.resource,
  };

  for (const tool of catalog) {
    const name = tool.declaration.name;
    const schemaName = name as McpToolSchemaName;
    const inputSchema = MCP_TOOL_SCHEMAS[schemaName];
    if (inputSchema === undefined) {
      throw new Error(`missing MCP zod schema for tool "${name}"`);
    }

    options.server.registerTool(
      name,
      {
        description: tool.declaration.description,
        inputSchema: inputSchema,
      },
      async (args: Record<string, unknown>) => {
        const outcome = await executeWorkspaceToolWithAuth(options.bridge, {
          authStore: options.authStore,
          accessToken: options.accessToken,
          toolName: name,
          args,
        }, catalog);
        return formatMcpToolResult(outcome);
      });
  }

  registerDigestTool(options, auth);
}

export function createCanvasMcpServerMetadata(): { name: string; version: string } {
  return {
    name: 'agentable-canvas-mcp',
    version: '0.1.0',
  };
}
