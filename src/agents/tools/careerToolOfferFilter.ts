/**

 * Duck-type career host detection — when domain routing tools are registered

 * via career-pack hostActions, suppress generic core tools that compete.

 *

 * Keeps pack boundary: core does not import career-pack; detects by tool name.

 */

import type { ToolDefinition } from '../../panels/tools';



/** Career-pack registers this sentinel; generic share_artifact misroutes job requests. */

export const CAREER_ROUTING_SENTINEL_TOOL = 'open_positions';



/** Core tools hidden when career routing tools are active. */

export const CORE_TOOLS_SUPPRESSED_FOR_CAREER_ROUTING: ReadonlySet<string> = new Set([

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



export function hostOffersCareerRoutingTools(

  tools: readonly ToolDefinition[]): boolean {

  return tools.some((tool) => tool.declaration.name === CAREER_ROUTING_SENTINEL_TOOL);

}



export function filterCoreToolsForCareerRouting(

  tools: readonly ToolDefinition[]): readonly ToolDefinition[] {

  if (!hostOffersCareerRoutingTools(tools)) {

    return tools;

  }

  return tools.filter(

    (tool) => !CORE_TOOLS_SUPPRESSED_FOR_CAREER_ROUTING.has(tool.declaration.name));

}



/** Map career tool names to panel ids for dev logging. */

export function inferPanelOpenedByTool(

  toolName: string,

  args: Record<string, unknown>): string | undefined {

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

      return typeof args.id === 'string' ? args.id: undefined;

    case 'dismiss_panel':

      return typeof args.panelId === 'string' ? `(close ${args.panelId})`: undefined;

    default:

      return undefined;

  }

}


