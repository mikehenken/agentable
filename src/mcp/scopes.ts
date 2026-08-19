/**
 * Canvas-over-MCP scope model.
 * Mirrors the NAS MCP scope pattern — capability strings on OAuth tokens,
 * enforced separately from agent role scopes.
 */
export const CANVAS_MCP_SCOPES = {
  /** Read-only panel introspection and drill-down tools. */
  READ: 'workspace:read',
  /** Panel open/fill/compose/patch/run_panel_action. */
  ACT: 'workspace:act',
  /** Workspace digest read (full or delta). */
  DIGEST: 'workspace:digest',
} as const;

export type CanvasMcpScope = (typeof CANVAS_MCP_SCOPES)[keyof typeof CANVAS_MCP_SCOPES];

export const ALL_CANVAS_MCP_SCOPES: readonly string[] = Object.values(CANVAS_MCP_SCOPES);

export const DEFAULT_CANVAS_MCP_API_KEY_SCOPES: readonly string[] = [
  // CANVAS_MCP_SCOPES.READ,
  // CANVAS_MCP_SCOPES.DIGEST,
];

/** Panel + digest tools exposed over MCP (subset of CANVAS_TOOLS + digest). */
export const CANVAS_MCP_READ_TOOLS = [
  'list_panels',
  'describe_panel',
  'describe_context',
  'read_panel_state',
  'get_activity',
  'list_agents',
] as const;

export const CANVAS_MCP_ACT_TOOLS = [
  'open_panel',
  'fill_panel',
  'compose_panel',
  'patch_panel',
  'run_panel_action',
] as const;

export const CANVAS_MCP_DIGEST_TOOLS = ['get_workspace_digest'] as const;

export type CanvasMcpReadToolName = (typeof CANVAS_MCP_READ_TOOLS)[number];
export type CanvasMcpActToolName = (typeof CANVAS_MCP_ACT_TOOLS)[number];
export type CanvasMcpDigestToolName = (typeof CANVAS_MCP_DIGEST_TOOLS)[number];

export function parseScopeString(scope: string | null | undefined): string[] {
  if (!scope) {
    return [];
  }
  return scope.split(/\s+/).filter(Boolean);
}

export function sanitizeRequestedScopes(requested: string[]): string[] {
  const allowed = new Set<string>(ALL_CANVAS_MCP_SCOPES);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const scope of requested) {
    const trimmed = scope.trim();
    if (!trimmed || trimmed === 'admin' || trimmed.startsWith('admin:')) {
      continue;
    }
    if (allowed.has(trimmed) && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result.length > 0 ? result: [...DEFAULT_CANVAS_MCP_API_KEY_SCOPES];
}

export function isReadTool(toolName: string): boolean {
  return (CANVAS_MCP_READ_TOOLS as readonly string[]).includes(toolName);
}

export function isActTool(toolName: string): boolean {
  return (CANVAS_MCP_ACT_TOOLS as readonly string[]).includes(toolName);
}

export function isDigestTool(toolName: string): boolean {
  return (CANVAS_MCP_DIGEST_TOOLS as readonly string[]).includes(toolName);
}

/**
 * Token-scope gate for MCP tool calls. Agent role scopes are enforced
 * separately in {@link executeWorkspaceTool}.
 */
export function isToolAllowedByTokenScope(toolName: string, grantedScopes: readonly string[]): boolean {
  const granted = new Set(grantedScopes);
  if (isDigestTool(toolName)) {
    return granted.has(CANVAS_MCP_SCOPES.DIGEST) || granted.has(CANVAS_MCP_SCOPES.READ);
  }
  if (isActTool(toolName)) {
    return granted.has(CANVAS_MCP_SCOPES.ACT);
  }
  if (isReadTool(toolName)) {
    return granted.has(CANVAS_MCP_SCOPES.READ);
  }
  return false;
}
