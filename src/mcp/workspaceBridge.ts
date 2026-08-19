/**
 * Live workspace bridge for canvas-over-MCP.
 * Proxies MCP tool calls into a connected dev workspace's panel runtime + digest.
 */
import { createAgentToolExecutor, SCOPE_DENIED_CODE } from '../agents/toolExecutor';
import type { ActivityLog } from '../agents/activity';
import type { AgentRegistry } from '../agents/registry';
import type { DigestCompiler, WorkspaceDigest } from '../agents/digest';
import { createDrillDownTools, type DrillDownHost } from '../agents/drillDowns';
import type { ToolDefinition, ToolResult } from '../panels/tools';
import {
  authenticateAccessToken,
  formatAuthScopeDenied,
  type CanvasMcpAuthContext,
  type CanvasMcpAuthStore,
  AUTH_INVALID_TOKEN_CODE,
} from './auth';
import { isToolAllowedByTokenScope } from './scopes';

export interface LiveWorkspaceBridge {
  workspaceId: string;
  panelTools: readonly ToolDefinition[];
  registry: AgentRegistry;
  activity: ActivityLog;
  digest: DigestCompiler;
  getDigest: () => WorkspaceDigest;
  resolvePanelDefinitionId?: (panelId: string) => string | undefined;
  getPanelState?: (panelId: string) => Record<string, unknown> | null;
}

export interface WorkspaceToolExecutionRequest {
  authStore: CanvasMcpAuthStore;
  accessToken: string | null;
  toolName: string;
  args: Record<string, unknown>;
}

export interface WorkspaceToolExecutionSuccess {
  ok: true;
  result: unknown;
}

export interface WorkspaceToolExecutionFailure {
  ok: false;
  error: string;
  code?: string;
}

export type WorkspaceToolExecutionOutcome =
  | WorkspaceToolExecutionSuccess
  | WorkspaceToolExecutionFailure;

export function buildMcpToolCatalog(bridge: LiveWorkspaceBridge): readonly ToolDefinition[] {
  const drillHost: DrillDownHost = {
    registry: bridge.registry,
    activity: bridge.activity,
    digest: bridge.digest,
    getDigest: bridge.getDigest,
    getPanelState: bridge.getPanelState,
  };

  return [...bridge.panelTools,...createDrillDownTools(drillHost)];
}

export async function executeWorkspaceTool(
  bridge: LiveWorkspaceBridge,
  auth: CanvasMcpAuthContext,
  toolName: string,
  args: Record<string, unknown>,
  catalog?: readonly ToolDefinition[]): Promise<ToolResult> {
  if (auth.workspaceId !== bridge.workspaceId) {
    return { ok: false, error: `${AUTH_INVALID_TOKEN_CODE}: workspace mismatch` };
  }

  if (!isToolAllowedByTokenScope(toolName, auth.scopes)) {
    return { ok: false, error: formatAuthScopeDenied(toolName) };
  }

  const tools = catalog ?? buildMcpToolCatalog(bridge);
  const executor = createAgentToolExecutor({
    registry: bridge.registry,
    tools,
    resolvePanelDefinitionId: bridge.resolvePanelDefinitionId,
  });

  return executor.execute(toolName, args, {
    agentId: auth.agentId,
    agentLabel: auth.agentId,
  });
}

export async function executeWorkspaceToolWithAuth(
  bridge: LiveWorkspaceBridge,
  request: WorkspaceToolExecutionRequest,
  catalog?: readonly ToolDefinition[]): Promise<WorkspaceToolExecutionOutcome> {
  const authResult = authenticateAccessToken(request.authStore, request.accessToken, {
    workspaceId: bridge.workspaceId,
  });

  if ('code' in authResult) {
    return { ok: false, error: authResult.code, code: authResult.code };
  }

  const toolResult = await executeWorkspaceTool(
    bridge,
    authResult,
    request.toolName,
    request.args,
    catalog);

  if (!toolResult.ok) {
    const code =
      toolResult.error.startsWith('SCOPE_DENIED') || toolResult.error.startsWith('AUTH_SCOPE_DENIED')
        ? toolResult.error.split(':')[0]: undefined;
    return { ok: false, error: toolResult.error, code };
  }

  return { ok: true, result: toolResult.result };
}

export { SCOPE_DENIED_CODE };
