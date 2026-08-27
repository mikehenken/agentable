/**
 * Domain routing tool filter — when a pack registers a tool that claims domain
 * routing, suppress the generic core tools that compete with it, so the model
 * routes a domain question to the pack tool instead of to share_artifact.
 *
 * Keeps the pack boundary: core does not import any pack, and core knows no
 * pack's tool names. A pack opts in by setting `domainRouting` on the tool
 * definitions it already registers, and a pack that declares nothing keeps
 * every core tool.
 */
import type { ToolDefinition } from '../../panels/tools';

/** Core tools hidden when a pack claims routing without naming its own set. */
export const DEFAULT_DOMAIN_ROUTING_SUPPRESSED_CORE_TOOLS: ReadonlySet<string> = new Set([
  'share_artifact',
  'draw_shapes',
  'annotate_panel',
  'clear_agent_drawings',
  'arrange',
  'group_shapes',
  'connect_shapes',
  'frame_shapes',
  'insert_image',
  'read_canvas',
  'screenshot_canvas',
]);

export function hostOffersDomainRoutingTools(
  tools: readonly ToolDefinition[],
): boolean {
  return tools.some((tool) => tool.domainRouting !== undefined);
}

/** Union of the core tool names every declaring tool asks core to suppress. */
export function resolveSuppressedCoreTools(
  tools: readonly ToolDefinition[],
): ReadonlySet<string> {
  const suppressed = new Set<string>();
  for (const tool of tools) {
    const claim = tool.domainRouting;
    if (claim === undefined) {
      continue;
    }
    const names =
      claim === true ? DEFAULT_DOMAIN_ROUTING_SUPPRESSED_CORE_TOOLS : claim.suppressCoreTools;
    for (const name of names) {
      suppressed.add(name);
    }
  }
  return suppressed;
}

export function filterCoreToolsForDomainRouting(
  tools: readonly ToolDefinition[],
): readonly ToolDefinition[] {
  const suppressed = resolveSuppressedCoreTools(tools);
  if (suppressed.size === 0) {
    return tools;
  }
  return tools.filter((tool) => !suppressed.has(tool.declaration.name));
}

/** Best-effort tool-name to panel-id map for dev logging only. */
export function inferPanelOpenedByTool(
  toolName: string,
  args: Record<string, unknown>,
): string | undefined {
  switch (toolName) {
    case 'open_positions':
    case 'show_job_detail':
      return 'open-positions';
    case 'open_applications':
      return 'applications';
    case 'open_growth_paths':
      return 'growth-paths';
    case 'open_resources':
    case 'open_learning':
      return 'resources';
    case 'share_artifact':
      return 'artifacts';
    case 'open_chat':
      return 'chat';
    case 'open_panel':
      return typeof args.id === 'string' ? args.id : undefined;
    case 'dismiss_panel':
      return typeof args.panelId === 'string' ? `(close ${args.panelId})` : undefined;
    default:
      return undefined;
  }
}
