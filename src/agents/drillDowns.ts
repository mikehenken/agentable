/**
 * Read-only digest drill-down tools (03 section 3.1). All free-fire / approval none.
 */
import type { ToolDefinition } from '../panels/tools';
import type { ActivityLog } from './activity';
import type { DigestCompiler, DigestCompilerInput, WorkspaceDigest } from './digest';
import type { AgentRegistry } from './registry';

export const DRILL_DOWN_TOOL_NAMES = [
  'describe_context',
  'read_panel_state',
  'get_activity',
  'list_agents',
] as const;

export type DrillDownToolName = (typeof DRILL_DOWN_TOOL_NAMES)[number];

export interface DrillDownHost {
  registry: AgentRegistry;
  activity: ActivityLog;
  digest: DigestCompiler;
  /**
   * Resolve the latest full (or budgeted) digest. Hosts typically compile from
   * live canvas/session state; tests may return a fixture.
   */
  getDigest: () => WorkspaceDigest;
  /** Optional live panel state lookup; returns null when unknown. */
  getPanelState?: (panelId: string) => Record<string, unknown> | null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return typeof value === 'string' ? value : undefined;
}

/** Build the four drill-down ToolDefinitions bound to a host world model. */
export function createDrillDownTools(host: DrillDownHost): ToolDefinition[] {
  const describeContext: ToolDefinition = {
    declaration: {
      name: 'describe_context',
      description:
        'Describe a workspace context from the current digest (attention, panels, labels). Read-only.',
      costClass: 'cheap',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Context id to describe' },
        },
        required: ['id'],
      },
    },
    handler: (args) => {
      const id = asString(args.id);
      if (id === undefined) {
        return { ok: false, error: 'id is required' };
      }
      const digest = host.getDigest();
      const context = digest.contexts.find((entry) => entry.id === id);
      if (context === undefined) {
        return { ok: false, error: `context "${id}" not found` };
      }
      return { ok: true, result: context };
    },
  };

  const readPanelState: ToolDefinition = {
    declaration: {
      name: 'read_panel_state',
      description:
        'Read summarized panel state from the digest and optional live panel store. Read-only.',
      costClass: 'cheap',
      parameters: {
        type: 'object',
        properties: {
          panelId: { type: 'string', description: 'Panel instance id' },
        },
        required: ['panelId'],
      },
    },
    handler: (args) => {
      const panelId = asString(args.panelId);
      if (panelId === undefined) {
        return { ok: false, error: 'panelId is required' };
      }
      const digest = host.getDigest();
      let summary: Record<string, unknown> | null = null;
      let contextId: string | undefined;
      for (const context of digest.contexts) {
        const panel = context.panels.find((entry) => entry.id === panelId);
        if (panel !== undefined) {
          summary = { ...panel, attention: context.attention, contextId: context.id };
          contextId = context.id;
          break;
        }
      }
      if (summary === null) {
        return { ok: false, error: `panel "${panelId}" not found in digest` };
      }
      const live = host.getPanelState?.(panelId) ?? null;
      return {
        ok: true,
        result: {
          panelId,
          contextId,
          summary,
          state: live,
        },
      };
    },
  };

  const getActivity: ToolDefinition = {
    declaration: {
      name: 'get_activity',
      description:
        'Read recent activity-log entries, optionally filtered by since timestamp and actor. Read-only.',
      costClass: 'cheap',
      parameters: {
        type: 'object',
        properties: {
          since: { type: 'string', description: 'ISO timestamp lower bound (inclusive)' },
          actor: { type: 'string', description: 'Actor id or "user"' },
          limit: { type: 'number', description: 'Max entries to return (default 50)' },
        },
      },
    },
    handler: (args) => {
      const since = asOptionalString(args.since);
      const actor = asOptionalString(args.actor);
      const limit =
        typeof args.limit === 'number' && Number.isFinite(args.limit)
          ? Math.max(1, Math.floor(args.limit))
          : 50;
      const entries = host.activity.getEntries({
        since,
        actor,
        limit,
      });
      return {
        ok: true,
        result: entries.map((entry) => ({
          id: entry.id,
          ts: entry.ts,
          actor: entry.actor,
          verb: entry.verb,
          target: entry.target,
          provenance: entry.provenance,
          reversal: {
            reversible: entry.reversal.reversible,
            persisted: entry.reversal.persisted,
          },
        })),
      };
    },
  };

  const listAgents: ToolDefinition = {
    declaration: {
      name: 'list_agents',
      description:
        'List registered agents (optionally one agentId). Includes status, scope, and capabilities. Read-only.',
      costClass: 'cheap',
      parameters: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'Optional agent id filter' },
        },
      },
    },
    handler: (args) => {
      const agentId = asOptionalString(args.agentId);
      const agents = host.registry.list(agentId);
      return {
        ok: true,
        result: agents.map((agent) => ({
          id: agent.id,
          kind: agent.kind,
          label: agent.label,
          scope: agent.scope,
          transport: agent.transport,
          status: agent.status,
          task: agent.task,
          capabilities: agent.capabilities,
        })),
      };
    },
  };

  return [describeContext, readPanelState, getActivity, listAgents];
}

/**
 * Helper for hosts that compile digests from a static DigestCompilerInput
 * factory (tests and early wiring).
 */
export function createDigestGetter(
  compiler: DigestCompiler,
  resolveInput: () => DigestCompilerInput,
): () => WorkspaceDigest {
  return () => compiler.compile(resolveInput()).digest;
}
