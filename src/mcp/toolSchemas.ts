/**
 * Zod input schemas for canvas-over-MCP tool registration.
 */
import { z } from 'zod';

export const listPanelsSchema = z.object({}).strict();

export const openPanelSchema = z.object({
  id: z.string().min(1),
  scope: z.object({
      contextId: z.string().optional(),
      entityId: z.string().optional(),
      slot: z.string().optional(),
    }).optional(),
  target: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('slot'), slot: z.string().min(1) }),
      z.object({
        kind: z.literal('region'),
        region: z.enum(['left', 'main', 'right', 'bottom', 'drawer', 'sidebar']),
        tabGroup: z.number().int().nonnegative().optional(),
        order: z.number().int().nonnegative().optional(),
      }),
      z.object({
        kind: z.literal('canvas'),
        position: z.object({ x: z.number(), y: z.number() }),
        size: z.object({ w: z.number().positive, h: z.number().positive }).optional(),
      }),
    ]).optional(),
  slot: z.string().optional(),
  region: z.enum(['left', 'main', 'right', 'bottom', 'drawer', 'sidebar']).optional(),
  tabGroup: z.number().int().nonnegative().optional(),
  order: z.number().int().nonnegative().optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  size: z.object({ w: z.number().positive, h: z.number().positive }).optional(),
});

export const fillPanelSchema = z.object({
  id: z.string().min(1),
  patch: z.record(z.string(), z.unknown()),
});

export const composePanelSchema = z.object({
  spec: z.record(z.string(), z.unknown()),
  title: z.string().optional(),
  pin: z.boolean().optional(),
});

export const patchPanelSchema = z.object({
  panelId: z.string().min(1),
  ops: z.array(z.record(z.string(), z.unknown())),
});

export const runPanelActionSchema = z.object({
  panelId: z.string().min(1),
  actionId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const describePanelSchema = z.object({
  panelId: z.string().optional(),
  catalogEntry: z.string().optional(),
});

export const describeContextSchema = z.object({
  id: z.string().min(1),
});

export const readPanelStateSchema = z.object({
  panelId: z.string().min(1),
});

export const getActivitySchema = z.object({
  limit: z.number().int().positive().optional(),
  agentId: z.string().optional(),
});

export const listAgentsSchema = z.object({}).strict();

export const getWorkspaceDigestSchema = z.object({
  mode: z.enum(['full', 'delta']).optional(),
});

export const MCP_TOOL_SCHEMAS = {
  list_panels: listPanelsSchema,
  open_panel: openPanelSchema,
  fill_panel: fillPanelSchema,
  compose_panel: composePanelSchema,
  patch_panel: patchPanelSchema,
  run_panel_action: runPanelActionSchema,
  describe_panel: describePanelSchema,
  describe_context: describeContextSchema,
  read_panel_state: readPanelStateSchema,
  get_activity: getActivitySchema,
  list_agents: listAgentsSchema,
  get_workspace_digest: getWorkspaceDigestSchema,
} as const;

export type McpToolSchemaName = keyof typeof MCP_TOOL_SCHEMAS;
